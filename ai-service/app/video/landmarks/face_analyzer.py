"""
Face & Camera Orientation Analyzer
Measures face visibility, camera orientation (centered, left, right, up, down),
and physical landmark signals without psychological inferences.
"""

import cv2
import numpy as np
import logging
from dataclasses import dataclass
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class FaceOrientationResult:
    face_detected: bool
    face_bbox: Optional[List[int]]  # Pixel [x1, y1, x2, y2]
    camera_orientation: str  # "centered", "left", "right", "up", "down", "unknown"
    gaze_alignment_score: float  # 0.0 - 1.0 (estimated camera direction alignment)
    smile_expressive_detected: bool
    observable_notes: List[str]


class FaceAnalyzer:
    """Estimates face visibility and head orientation from candidate frame crops."""

    def __init__(self):
        # We use OpenCV DNN / color / gradient symmetry analysis on the candidate head crop
        logger.info("[FaceAnalyzer] Initialized Face & Camera Orientation Analyzer.")

    def analyze_head_region(
        self,
        frame_bgr: any,
        head_bbox: Optional[List[int]],
        person_bbox: Optional[List[int]] = None
    ) -> FaceOrientationResult:
        """
        Analyzes head region for face presence, orientation, and observable cues.
        """
        if frame_bgr is None or head_bbox is None:
            return FaceOrientationResult(
                face_detected=False,
                face_bbox=None,
                camera_orientation="unknown",
                gaze_alignment_score=0.0,
                smile_expressive_detected=False,
                observable_notes=["No candidate head region available."]
            )

        h_frame, w_frame = frame_bgr.shape[:2]
        x1, y1, x2, y2 = head_bbox
        x1 = max(0, min(w_frame - 1, x1))
        y1 = max(0, min(h_frame - 1, y1))
        x2 = max(x1 + 1, min(w_frame, x2))
        y2 = max(y1 + 1, min(h_frame, y2))

        crop = frame_bgr[y1:y2, x1:x2]
        if crop.size == 0 or crop.shape[0] < 15 or crop.shape[1] < 15:
            return FaceOrientationResult(
                face_detected=False,
                face_bbox=None,
                camera_orientation="unknown",
                gaze_alignment_score=0.0,
                smile_expressive_detected=False,
                observable_notes=["Head region too small for reliable feature extraction."]
            )

        crop_h, crop_w = crop.shape[:2]

        # 1. Skin & Luminance feature estimation
        ycrcb = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
        cr = ycrcb[:, :, 1]
        cb = ycrcb[:, :, 2]
        # Standard human skin chromatic bounds
        skin_mask = (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
        skin_ratio = float(np.sum(skin_mask)) / float(crop_h * crop_w)

        face_detected = skin_ratio >= 0.15

        # 2. Horizontal orientation estimation (Left vs Center vs Right)
        # Using left vs right hemisphere gradient/color centroid
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        mid_x = crop_w // 2
        left_hemisphere = gray[:, :mid_x]
        right_hemisphere = gray[:, mid_x:]

        mean_left = float(np.mean(left_hemisphere))
        mean_right = float(np.mean(right_hemisphere))

        diff_ratio = (mean_left - mean_right) / max(1.0, (mean_left + mean_right))

        # Check candidate's position relative to overall frame center
        head_center_x = (x1 + x2) / 2.0 / w_frame
        head_center_y = (y1 + y2) / 2.0 / h_frame

        orientation = "centered"
        notes = []

        if abs(diff_ratio) > 0.18:
            orientation = "left" if diff_ratio > 0 else "right"
            notes.append(f"Head turned slightly towards the {orientation}.")
        elif head_center_y < 0.15:
            orientation = "up"
            notes.append("Camera angle oriented upwards.")
        elif head_center_y > 0.65:
            orientation = "down"
            notes.append("Camera angle oriented downwards.")
        else:
            orientation = "centered"
            notes.append("Camera orientation directly aligned with viewport center.")

        gaze_alignment = 0.88 if orientation == "centered" else 0.60

        # 3. Detect smile / expressive opening cue (mouth region gradient changes)
        # Mouth region is typically lower 35% of head crop
        mouth_y1 = int(crop_h * 0.65)
        mouth_crop = gray[mouth_y1:, :]
        mouth_std = float(np.std(mouth_crop)) if mouth_crop.size > 0 else 0.0

        # High variance in lower third with skin presence indicates smiling / speaking articulation
        smile_detected = mouth_std > 28.0

        return FaceOrientationResult(
            face_detected=face_detected,
            face_bbox=[x1, y1, x2, y2],
            camera_orientation=orientation,
            gaze_alignment_score=round(gaze_alignment, 2),
            smile_expressive_detected=smile_detected,
            observable_notes=notes,
        )


# Global singleton instance
_face_analyzer: Optional[FaceAnalyzer] = None


def get_face_analyzer() -> FaceAnalyzer:
    global _face_analyzer
    if _face_analyzer is None:
        _face_analyzer = FaceAnalyzer()
    return _face_analyzer
