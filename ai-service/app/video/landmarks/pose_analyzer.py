"""
MediaPipe pose analysis for observable interview-video signals.

Measures body landmark visibility, shoulder alignment, torso centering, and
frame-to-frame posture stability. Supports modern MediaPipe Tasks Vision and
legacy mp.solutions. It does not infer personality, confidence, emotion, or hiring suitability.
"""

import os
import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

from app.video.models_helper import get_model_file_path, POSE_LANDMARKER_URL

logger = logging.getLogger(__name__)


@dataclass
class PoseResult:
    pose_detected: bool
    posture_score: Optional[float]
    shoulder_tilt_degrees: Optional[float]
    torso_center_x: Optional[float]
    torso_center_y: Optional[float]
    notes: list


class PoseAnalyzer:
    def __init__(self):
        self._pose = None
        self._task_landmarker = None
        self._mode = "unavailable"
        self.status = "not_loaded"

        # 1. Try modern MediaPipe Tasks Vision PoseLandmarker
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision

            model_path = get_model_file_path("pose_landmarker_lite.task", POSE_LANDMARKER_URL)
            if os.path.exists(model_path) and os.path.getsize(model_path) > 0:
                base_opts = mp_python.BaseOptions(model_asset_path=model_path)
                options = vision.PoseLandmarkerOptions(
                    base_options=base_opts,
                    running_mode=vision.RunningMode.IMAGE,
                    num_poses=1,
                    min_pose_detection_confidence=0.45,
                    min_pose_presence_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                self._task_landmarker = vision.PoseLandmarker.create_from_options(options)
                self._mode = "tasks_vision"
                self.status = "loaded_tasks_vision"
                self._mp = mp
                logger.info("[PoseAnalyzer] MediaPipe Tasks PoseLandmarker initialized.")
        except Exception as exc:
            logger.debug("[PoseAnalyzer] Tasks PoseLandmarker unavailable: %s", exc)

        # 2. Fallback to legacy mp.solutions.pose
        if self._mode == "unavailable":
            try:
                import mediapipe as mp
                if hasattr(mp, "solutions") and hasattr(mp.solutions, "pose"):
                    self._pose = mp.solutions.pose.Pose(
                        static_image_mode=False,
                        model_complexity=1,
                        enable_segmentation=False,
                        smooth_landmarks=True,
                        min_detection_confidence=0.5,
                        min_tracking_confidence=0.5,
                    )
                    self._mode = "solutions"
                    self.status = "loaded_solutions"
                    self._mp = mp
                    logger.info("[PoseAnalyzer] MediaPipe Pose (solutions) initialized.")
            except Exception as exc:
                logger.debug("[PoseAnalyzer] Legacy mp.solutions Pose unavailable: %s", exc)

        if self._mode == "unavailable":
            self.status = "unavailable"
            logger.warning("[PoseAnalyzer] Pose model could not be initialized.")

    @property
    def is_available(self) -> bool:
        return self._task_landmarker is not None or self._pose is not None

    def analyze(self, frame_bgr) -> PoseResult:
        if not self.is_available or frame_bgr is None or frame_bgr.size == 0:
            return PoseResult(False, None, None, None, None, ["Pose model unavailable."])

        try:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

            # ── Mode A: Modern Tasks Vision ──────────────────────────────────
            if self._mode == "tasks_vision" and self._task_landmarker is not None:
                mp_img = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
                result = self._task_landmarker.detect(mp_img)
                if not result.pose_landmarks or len(result.pose_landmarks) == 0:
                    return PoseResult(False, None, None, None, None, ["No body pose detected."])

                landmarks = result.pose_landmarks[0]
                ls = landmarks[11]  # LEFT_SHOULDER
                rs = landmarks[12]  # RIGHT_SHOULDER
                lh = landmarks[23]  # LEFT_HIP
                rh = landmarks[24]  # RIGHT_HIP
                return self._compute_pose_metrics(ls, rs, lh, rh)

            # ── Mode B: Legacy solutions ─────────────────────────────────────
            if self._mode == "solutions" and self._pose is not None:
                result = self._pose.process(rgb)
                landmarks = result.pose_landmarks.landmark if result.pose_landmarks else None
                if not landmarks:
                    return PoseResult(False, None, None, None, None, ["No body pose detected."])

                mp_pose = self._mp.solutions.pose.PoseLandmark
                ls = landmarks[mp_pose.LEFT_SHOULDER.value]
                rs = landmarks[mp_pose.RIGHT_SHOULDER.value]
                lh = landmarks[mp_pose.LEFT_HIP.value]
                rh = landmarks[mp_pose.RIGHT_HIP.value]
                return self._compute_pose_metrics(ls, rs, lh, rh)

            return PoseResult(False, None, None, None, None, ["Pose model unavailable."])

        except Exception as exc:
            logger.debug("[PoseAnalyzer] Frame analysis failed: %s", exc)
            return PoseResult(False, None, None, None, None, [f"Pose analysis failed: {exc}"])

    def _compute_pose_metrics(self, ls, rs, lh, rh) -> PoseResult:
        ls_vis = getattr(ls, "visibility", 1.0)
        rs_vis = getattr(rs, "visibility", 1.0)
        lh_vis = getattr(lh, "visibility", 0.0)
        rh_vis = getattr(rh, "visibility", 0.0)

        # In webcam/desk framing, shoulders are the primary observable posture signal.
        shoulder_vis = (ls_vis + rs_vis) / 2.0
        if shoulder_vis < 0.35:
            return PoseResult(False, None, None, None, None, ["Shoulder landmarks were not sufficiently visible."])

        shoulder_dx = abs(rs.x - ls.x)
        shoulder_dy = abs(rs.y - ls.y)
        shoulder_tilt = abs(float(np.degrees(np.arctan2(shoulder_dy, max(1e-6, shoulder_dx)))))

        # A horizontal shoulder line is the neutral reference. Clamp to 45 degrees.
        tilt_penalty = min(1.0, shoulder_tilt / 45.0)
        posture_score = round(max(0.0, min(1.0, 1.0 - 0.55 * tilt_penalty)), 3)

        hip_vis = (lh_vis + rh_vis) / 2.0
        if hip_vis >= 0.35:
            torso_x = float((ls.x + rs.x + lh.x + rh.x) / 4.0)
            torso_y = float((ls.y + rs.y + lh.y + rh.y) / 4.0)
        else:
            # Desk framing fallback: upper torso center estimated from shoulders
            torso_x = float((ls.x + rs.x) / 2.0)
            torso_y = float((ls.y + rs.y) / 2.0)

        notes = []
        if shoulder_tilt > 12:
            notes.append("Shoulder line was noticeably tilted in this frame.")
        else:
            notes.append("Shoulder alignment was approximately level.")

        return PoseResult(
            True,
            posture_score,
            round(shoulder_tilt, 2),
            round(torso_x, 3),
            round(torso_y, 3),
            notes,
        )


_pose_analyzer: Optional[PoseAnalyzer] = None


def get_pose_analyzer() -> PoseAnalyzer:
    global _pose_analyzer
    if _pose_analyzer is None:
        _pose_analyzer = PoseAnalyzer()
    return _pose_analyzer
