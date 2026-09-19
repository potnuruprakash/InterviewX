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
    mouth_region_activity: bool  # Observable mouth movement / speech articulation
    smile_expressive_detected: bool  # Backward-compat alias for observable articulation
    observable_notes: List[str]


class FaceAnalyzer:
    """Estimates face visibility and head orientation from candidate frame crops."""

    def __init__(self):
        # Load OpenCV's built-in Haar Cascade detector for robust face presence
        self._cascade = None
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            loaded = cv2.CascadeClassifier(cascade_path)
            if not loaded.empty():
                self._cascade = loaded
                logger.info("[FaceAnalyzer] Initialized OpenCV Haar frontal face cascade detector.")
        except Exception as e:
            logger.warning(f"[FaceAnalyzer] Haar Cascade unavailable, using chromatic fallback: {e}")

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
                mouth_region_activity=False,
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
                mouth_region_activity=False,
                smile_expressive_detected=False,
                observable_notes=["Head region too small for reliable feature extraction."]
            )

        crop_h, crop_w = crop.shape[:2]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

        # 1. Face detection via OpenCV Haar Cascade with chromatic fallback
        face_detected = False
        detected_face_bbox = [x1, y1, x2, y2]

        if self._cascade is not None:
            try:
                faces = self._cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
                if len(faces) > 0:
                    face_detected = True
                    fx, fy, fw, fh = faces[0]
                    detected_face_bbox = [x1 + int(fx), y1 + int(fy), x1 + int(fx + fw), y1 + int(fy + fh)]
            except Exception:
                pass

        # Fallback to skin chromatic verification if cascade did not trigger
        if not face_detected:
            ycrcb = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
            cr = ycrcb[:, :, 1]
            cb = ycrcb[:, :, 2]
            skin_mask = (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
            skin_ratio = float(np.sum(skin_mask)) / float(crop_h * crop_w)
            face_detected = skin_ratio >= 0.18

        # 2. Horizontal orientation estimation (Left vs Center vs Right)
        mid_x = crop_w // 2
        left_hemisphere = gray[:, :mid_x]
        right_hemisphere = gray[:, mid_x:]

        mean_left = float(np.mean(left_hemisphere))
        mean_right = float(np.mean(right_hemisphere))

        diff_ratio = (mean_left - mean_right) / max(1.0, (mean_left + mean_right))

        # Position relative to overall frame center
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

        # 3. Detect mouth region activity / articulation (observable gradient variance)
        # Note: Measures physical mouth movement/articulation during speech, NOT certified emotion/psychology
        mouth_y1 = int(crop_h * 0.65)
        mouth_crop = gray[mouth_y1:, :]
        mouth_std = float(np.std(mouth_crop)) if mouth_crop.size > 0 else 0.0
        mouth_activity = mouth_std > 28.0

        return FaceOrientationResult(
            face_detected=face_detected,
            face_bbox=detected_face_bbox,
            camera_orientation=orientation,
            gaze_alignment_score=round(gaze_alignment, 2),
            mouth_region_activity=mouth_activity,
            smile_expressive_detected=mouth_activity,  # Backward compatibility
            observable_notes=notes,
        )



# Global singleton instance
_face_analyzer: Optional[FaceAnalyzer] = None


def get_face_analyzer() -> FaceAnalyzer:
    global _face_analyzer
    if _face_analyzer is None:
        _face_analyzer = FaceAnalyzer()
    return _face_analyzer
