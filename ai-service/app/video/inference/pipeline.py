"""
Video Analysis Pipeline Orchestrator
Connects frame sampling, YOLOv8 person detection, face orientation,
facial expression analysis, and temporal aggregation into a single reliable service.
"""

import os
import logging
from typing import Dict, Any, Optional

from app.video.preprocessing.frame_sampler import extract_sampled_frames, DEFAULT_SAMPLE_FPS
from app.video.detector.yolo_detector import get_yolo_detector
from app.video.landmarks.face_analyzer import get_face_analyzer
from app.video.expression.expression_classifier import get_expression_classifier
from app.video.tracking.temporal_tracker import TemporalTracker, FrameTimelineEvent
from app.video.metrics.temporal_metrics import compute_video_metrics

logger = logging.getLogger(__name__)


class VideoAnalysisPipeline:
    """Orchestrates end-to-end video analysis."""

    def __init__(self):
        self.yolo_detector = get_yolo_detector()
        self.face_analyzer = get_face_analyzer()
        self.expression_classifier = get_expression_classifier()
        logger.info("[VideoPipeline] Video Analysis Pipeline initialized successfully.")

    def get_audit_report(self) -> Dict[str, Any]:
        """Returns verified model and dataset audit information."""
        return {
            "dataset": "RAVDESS (referenced externally; no raw dataset files present in repo)",
            "model_task": "detect (Object Detection for candidate presence & framing)",
            "yolo_model": self.yolo_detector.model_path,
            "yolo_status": self.yolo_detector.status,
            "expression_model_status": self.expression_classifier.status,
            "is_custom_expression_model_verified": self.expression_classifier.is_verified,
            "supported_expression_classes": self.expression_classifier.supported_classes,
            "verification_statement": self.expression_classifier.audit_note,
            "actor_independent_split_status": "Not applicable — standard COCO pretrained detection weights are active.",
            "metrics_available": {
                "person_presence": True,
                "framing_quality": True,
                "multi_person_detection": True,
                "camera_orientation": True,
                "expression_distribution": True,
                "psychological_or_personality_inferences": False,  # Explicitly forbidden
            },
            "limitations": [
                "RAVDESS contains acted, laboratory emotional recordings which do not directly reflect natural candidate responses in technical interviews.",
                "YOLOv8n object detection identifies person presence and bounds, but standard detection weights do not perform emotion classification.",
                "Classification confidence is a statistical measure of model certainty, never candidate emotional confidence or competence.",
            ],
        }

    def process_video(self, video_path: str, fps: int = DEFAULT_SAMPLE_FPS) -> Dict[str, Any]:
        """
        Executes the full video analysis workflow on a video file.
        """
        if not os.path.exists(video_path):
            return {
                "success": False,
                "modelStatus": "file_not_found",
                "note": f"Video file not found at path: {video_path}",
                "metrics": None,
            }

        frames = extract_sampled_frames(video_path, fps=fps)
        if not frames:
            return {
                "success": False,
                "modelStatus": "frame_extraction_failed",
                "note": "Could not extract frames from video file.",
                "metrics": None,
            }

        tracker = TemporalTracker()

        for frame_sample in frames:
            # 1. YOLOv8 Person & Framing Detection
            detection = self.yolo_detector.detect_frame(frame_sample.image)

            # 2. Face & Orientation Analysis
            face_result = self.face_analyzer.analyze_head_region(
                frame_sample.image,
                head_bbox=detection.head_bbox,
                person_bbox=detection.pixel_bbox,
            )

            # 3. Facial Expression Analysis
            expr_result = self.expression_classifier.classify_face(
                frame_sample.image,
                face_bbox=face_result.face_bbox,
                smile_detected=face_result.smile_expressive_detected,
            )

            # 4. Record to Temporal Tracker
            tracker.record_frame(
                FrameTimelineEvent(
                    timestamp_sec=frame_sample.timestamp_sec,
                    frame_index=frame_sample.frame_index,
                    person_detected=detection.person_detected,
                    person_count=detection.person_count,
                    face_detected=face_result.face_detected,
                    good_framing=detection.good_framing,
                    camera_orientation=face_result.camera_orientation,
                    gaze_alignment_score=face_result.gaze_alignment_score,
                    expression=expr_result.predicted_expression,
                    expression_confidence=expr_result.confidence,
                    bbox=detection.bbox,
                )
            )

        # 5. Compute Final Temporal Metrics
        metrics = compute_video_metrics(
            tracker=tracker,
            audit_note=self.expression_classifier.audit_note,
            is_custom_model=self.expression_classifier.is_verified,
        )

        # Build backward-compatible fields alongside enhanced metrics
        return {
            "success": True,
            "modelStatus": "analyzed",
            "framesProcessed": metrics["valid_frames_analyzed"],
            "personDetectedFrames": sum(1 for e in tracker.events if e.person_detected),
            "personDetectionRatio": metrics["person_visibility"],
            "faceVisibilityRatio": metrics["face_visibility"],
            "videoQualityIndicator": "good" if metrics["good_framing"] >= 0.70 else "fair" if metrics["good_framing"] >= 0.40 else "poor",
            "processingConfidence": metrics["expression_classification_confidence"],
            "modelName": self.yolo_detector.model_path,
            "note": "Observable presence, framing, and expression statistics. No psychological inferences.",
            # Enhanced Empirical Metrics
            "metrics": metrics,
            "audit": self.get_audit_report(),
        }


# Global pipeline singleton
_pipeline_instance: Optional[VideoAnalysisPipeline] = None


def get_video_pipeline() -> VideoAnalysisPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = VideoAnalysisPipeline()
    return _pipeline_instance
