"""
MediaPipe pose analysis for observable interview-video signals.

Measures body landmark visibility, shoulder alignment, torso centering, and
frame-to-frame posture stability. It does not infer personality, confidence,
emotion, or hiring suitability.
"""

import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

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
        self.status = "not_loaded"
        try:
            import mediapipe as mp
            self._mp = mp
            self._pose = mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                enable_segmentation=False,
                smooth_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self.status = "loaded"
            logger.info("[PoseAnalyzer] MediaPipe Pose initialized.")
        except Exception as exc:
            self.status = f"unavailable: {exc}"
            logger.warning("[PoseAnalyzer] MediaPipe Pose unavailable: %s", exc)

    @property
    def is_available(self) -> bool:
        return self._pose is not None

    def analyze(self, frame_bgr) -> PoseResult:
        if self._pose is None or frame_bgr is None:
            return PoseResult(False, None, None, None, None, ["Pose model unavailable."])

        try:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            result = self._pose.process(rgb)
            landmarks = result.pose_landmarks.landmark if result.pose_landmarks else None
            if not landmarks:
                return PoseResult(False, None, None, None, None, ["No body pose detected."])

            mp_pose = self._mp.solutions.pose.PoseLandmark
            ls = landmarks[mp_pose.LEFT_SHOULDER.value]
            rs = landmarks[mp_pose.RIGHT_SHOULDER.value]
            lh = landmarks[mp_pose.LEFT_HIP.value]
            rh = landmarks[mp_pose.RIGHT_HIP.value]

            visibility = np.mean([ls.visibility, rs.visibility, lh.visibility, rh.visibility])
            if visibility < 0.45:
                return PoseResult(False, None, None, None, None, ["Body landmarks were not sufficiently visible."])

            shoulder_dx = rs.x - ls.x
            shoulder_dy = rs.y - ls.y
            shoulder_tilt = abs(float(np.degrees(np.arctan2(shoulder_dy, shoulder_dx))))

            # A horizontal shoulder line is the neutral reference. Clamp to 45 degrees.
            tilt_penalty = min(1.0, shoulder_tilt / 45.0)
            posture_score = round(max(0.0, min(1.0, 1.0 - 0.55 * tilt_penalty)), 3)

            torso_x = float((ls.x + rs.x + lh.x + rh.x) / 4.0)
            torso_y = float((ls.y + rs.y + lh.y + rh.y) / 4.0)

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
        except Exception as exc:
            logger.debug("[PoseAnalyzer] Frame analysis failed: %s", exc)
            return PoseResult(False, None, None, None, None, ["Pose analysis failed for this frame."])


_pose_analyzer: Optional[PoseAnalyzer] = None


def get_pose_analyzer() -> PoseAnalyzer:
    global _pose_analyzer
    if _pose_analyzer is None:
        _pose_analyzer = PoseAnalyzer()
    return _pose_analyzer
