"""
Video analysis pipeline.

YOLO: person presence/framing/multi-person detection.
MediaPipe Face Mesh/Iris: face visibility, head orientation, gaze alignment.
MediaPipe Pose: observable shoulder/torso posture and movement.
Expression classification is optional and only reported when a verified model exists.
"""

import os
import logging
import time
from typing import Dict, Any, Optional

from app.video.preprocessing.frame_sampler import extract_sampled_frames, DEFAULT_SAMPLE_FPS
from app.video.detector.yolo_detector import get_yolo_detector
from app.video.landmarks.face_analyzer import get_face_analyzer
from app.video.landmarks.pose_analyzer import get_pose_analyzer
from app.video.expression.expression_classifier import get_expression_classifier
from app.video.tracking.temporal_tracker import TemporalTracker, FrameTimelineEvent
from app.video.metrics.temporal_metrics import compute_video_metrics

logger = logging.getLogger(__name__)


class VideoAnalysisPipeline:
    def __init__(self):
        self.yolo_detector = get_yolo_detector()
        self.face_analyzer = get_face_analyzer()
        self.pose_analyzer = get_pose_analyzer()
        self.expression_classifier = get_expression_classifier()
        logger.info("[VideoPipeline] Initialized.")

    def get_audit_report(self) -> Dict[str, Any]:
        return {
            "dataset": "No interview-specific video dataset is bundled in the repository.",
            "models": {
                "person_detection": self.yolo_detector.model_path,
                "face_gaze": "MediaPipe Face Mesh/Iris",
                "pose": "MediaPipe Pose",
                "expression": self.expression_classifier.model_path or None,
            },
            "model_status": {
                "yolo": self.yolo_detector.status,
                "face_gaze": self.face_analyzer.status,
                "pose": self.pose_analyzer.status,
                "expression": self.expression_classifier.status,
            },
            "metrics_available": {
                "person_presence": True,
                "framing_quality": True,
                "multi_person_detection": True,
                "face_visibility": True,
                "gaze_alignment": self.face_analyzer.is_available,
                "head_orientation": self.face_analyzer.is_available,
                "pose_alignment": self.pose_analyzer.is_available,
                "posture_stability": self.pose_analyzer.is_available,
                "psychological_or_personality_inferences": False,
            },
            "limitations": [
                "Gaze is an observable screen/camera alignment estimate, not a measure of attention, honesty, confidence, or competence.",
                "Posture is an observable landmark alignment/stability signal, not a personality or hiring-fitness score.",
                "Expression classification is omitted unless verified custom classification weights are configured.",
            ],
        }

    def process_video(self, video_path: str, fps: int = DEFAULT_SAMPLE_FPS) -> Dict[str, Any]:
        if not os.path.exists(video_path):
            return {"success": False, "modelStatus": "file_not_found", "note": f"Video not found: {video_path}", "metrics": None}

        extraction_started = time.monotonic()
        frames = extract_sampled_frames(video_path, fps=fps)
        extraction_seconds = time.monotonic() - extraction_started
        if not frames:
            logger.error(
                "[VideoPipeline] No frames extracted from %s after %.2fs; verify codec/container and OpenCV decoding.",
                video_path,
                extraction_seconds,
            )
            return {
                "success": False,
                "modelStatus": "frame_extraction_failed",
                "note": "Could not decode video frames. The uploaded video codec may be unsupported.",
                "framesProcessed": 0,
                "metrics": None,
            }

        tracker = TemporalTracker()
        yolo_seconds = 0.0
        face_seconds = 0.0
        pose_seconds = 0.0
        expression_seconds = 0.0
        inference_started = time.monotonic()

        for frame_sample in frames:
            stage_started = time.monotonic()
            detection = self.yolo_detector.detect_frame(frame_sample.image)
            yolo_seconds += time.monotonic() - stage_started

            stage_started = time.monotonic()
            face_result = self.face_analyzer.analyze_head_region(
                frame_sample.image,
                head_bbox=detection.head_bbox,
                person_bbox=detection.pixel_bbox,
            )
            face_seconds += time.monotonic() - stage_started

            stage_started = time.monotonic()
            pose_result = self.pose_analyzer.analyze(frame_sample.image)
            pose_seconds += time.monotonic() - stage_started

            stage_started = time.monotonic()
            expr_result = self.expression_classifier.classify_face(
                frame_sample.image,
                face_bbox=face_result.face_bbox,
                smile_detected=face_result.smile_expressive_detected,
            )
            expression_seconds += time.monotonic() - stage_started

            is_person = detection.person_detected or face_result.face_detected or pose_result.pose_detected
            person_cnt = max(detection.person_count, 1 if (face_result.face_detected or pose_result.pose_detected) else 0)

            tracker.record_frame(
                FrameTimelineEvent(
                    timestamp_sec=frame_sample.timestamp_sec,
                    frame_index=frame_sample.frame_index,
                    person_detected=is_person,
                    person_count=person_cnt,
                    face_detected=face_result.face_detected,
                    good_framing=detection.good_framing,
                    camera_orientation=face_result.camera_orientation,
                    gaze_alignment_score=face_result.gaze_alignment_score,
                    expression=expr_result.predicted_expression,
                    expression_confidence=expr_result.confidence,
                    bbox=detection.bbox,
                    pose_detected=pose_result.pose_detected,
                    posture_score=pose_result.posture_score,
                    shoulder_tilt_degrees=pose_result.shoulder_tilt_degrees,
                    torso_center_x=pose_result.torso_center_x,
                    torso_center_y=pose_result.torso_center_y,
                    gaze_method=face_result.gaze_method,
                )
            )

        metrics = compute_video_metrics(
            tracker=tracker,
            audit_note=self.expression_classifier.audit_note,
            is_custom_model=self.expression_classifier.is_verified,
        )

        logger.info(
            "[VideoPipeline] Completed frames=%d extraction_seconds=%.2f inference_seconds=%.2f "
            "yolo_seconds=%.2f face_seconds=%.2f pose_seconds=%.2f expression_seconds=%.2f",
            len(frames),
            extraction_seconds,
            time.monotonic() - inference_started,
            yolo_seconds,
            face_seconds,
            pose_seconds,
            expression_seconds,
        )

        quality = (
            "good"
            if (metrics["good_framing"] >= 0.60 or (metrics["face_visibility"] >= 0.70 and metrics["person_visibility"] >= 0.70))
            else "fair"
            if (metrics["good_framing"] >= 0.30 or metrics["face_visibility"] >= 0.40)
            else "poor"
        )

        return {
            "success": True,
            "modelStatus": "analyzed",
            "framesProcessed": metrics["valid_frames_analyzed"],
            "personDetectedFrames": sum(1 for e in tracker.events if e.person_detected),
            "personDetectionRatio": metrics["person_visibility"],
            "faceVisibilityRatio": metrics["face_visibility"],
            "gazeAttentionRatio": metrics["gaze_alignment_ratio"],
            "postureStability": metrics["posture_stability_label"],
            "postureStabilityIndex": metrics["posture_stability_index"],
            "postureScore": metrics["posture_score"],
            "shoulderTiltDegrees": metrics["average_shoulder_tilt_degrees"],
            "cameraEngagement": metrics["camera_engagement"],
            "videoQualityIndicator": quality,
            "processingConfidence": metrics["expression_classification_confidence"],
            "modelName": self.yolo_detector.model_path,
            "note": "Observable presence, framing, gaze alignment, head orientation, and pose statistics only.",
            "metrics": metrics,
            "audit": self.get_audit_report(),
        }


_pipeline_instance: Optional[VideoAnalysisPipeline] = None


def get_video_pipeline() -> VideoAnalysisPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = VideoAnalysisPipeline()
    return _pipeline_instance
