"""
Face and gaze landmark analysis.

Uses MediaPipe Face Mesh/Iris when available for observable eye-gaze alignment
and face visibility. OpenCV Haar remains a fallback for face presence.
No emotion, personality, confidence, or hiring-suitability inference is made.
"""

import cv2
import numpy as np
import logging
from dataclasses import dataclass
from typing import Optional, List

logger = logging.getLogger(__name__)


@dataclass
class FaceOrientationResult:
    face_detected: bool
    face_bbox: Optional[List[int]]
    camera_orientation: str
    gaze_alignment_score: float
    mouth_region_activity: bool
    smile_expressive_detected: bool
    observable_notes: List[str]
    gaze_method: str = "unavailable"


class FaceAnalyzer:
    def __init__(self):
        self._cascade = None
        self._mesh = None
        self._mp = None

        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            loaded = cv2.CascadeClassifier(cascade_path)
            if not loaded.empty():
                self._cascade = loaded
        except Exception as exc:
            logger.warning("[FaceAnalyzer] Haar initialization failed: %s", exc)

        try:
            import mediapipe as mp
            self._mp = mp
            self._mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            logger.info("[FaceAnalyzer] MediaPipe Face Mesh/Iris initialized.")
        except Exception as exc:
            logger.warning("[FaceAnalyzer] MediaPipe Face Mesh unavailable: %s", exc)

    def _fallback(
        self, frame_bgr, x1, y1, x2, y2, note="No reliable facial landmarks."
    ):
        crop = frame_bgr[y1:y2, x1:x2]
        if crop.size == 0:
            return FaceOrientationResult(False, None, "unknown", 0.0, False, False, [note])

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        face_detected = False
        detected = [x1, y1, x2, y2]

        if self._cascade is not None:
            try:
                faces = self._cascade.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=4, minSize=(24, 24)
                )
                if len(faces):
                    fx, fy, fw, fh = faces[0]
                    detected = [x1 + int(fx), y1 + int(fy), x1 + int(fx + fw), y1 + int(fy + fh)]
                    face_detected = True
            except Exception:
                pass

        if not face_detected:
            ycrcb = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
            cr, cb = ycrcb[:, :, 1], ycrcb[:, :, 2]
            skin = (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
            face_detected = float(np.mean(skin)) >= 0.18

        return FaceOrientationResult(
            face_detected=face_detected,
            face_bbox=detected if face_detected else None,
            camera_orientation="unknown",
            gaze_alignment_score=0.0,
            mouth_region_activity=False,
            smile_expressive_detected=False,
            observable_notes=[note],
            gaze_method="fallback_face_detection",
        )

    def analyze_head_region(self, frame_bgr, head_bbox, person_bbox=None):
        if frame_bgr is None or head_bbox is None:
            return FaceOrientationResult(False, None, "unknown", 0.0, False, False, ["No candidate head region available."])

        h, w = frame_bgr.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in head_bbox]
        x1, y1 = max(0, min(w - 1, x1)), max(0, min(h - 1, y1))
        x2, y2 = max(x1 + 1, min(w, x2)), max(y1 + 1, min(h, y2))

        if self._mesh is None:
            return self._fallback(frame_bgr, x1, y1, x2, y2)

        try:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            result = self._mesh.process(rgb)
            face = result.multi_face_landmarks[0] if result.multi_face_landmarks else None
            if face is None:
                return self._fallback(frame_bgr, x1, y1, x2, y2, "MediaPipe did not detect a face.")

            lm = face.landmark
            # MediaPipe Face Mesh/Iris landmarks: left/right iris centers and eye corners.
            # These indices are stable in the 468+10 landmark topology.
            iris_l = [474, 475, 476, 477]
            iris_r = [469, 470, 471, 472]
            left_eye_corners = (33, 133)
            right_eye_corners = (362, 263)

            def pt(idx):
                return np.array([lm[idx].x, lm[idx].y], dtype=np.float32)

            def ratio(iris_ids, corners):
                iris = np.mean([pt(i) for i in iris_ids], axis=0)
                a, b = pt(corners[0]), pt(corners[1])
                denom = max(1e-6, abs(float(b[0] - a[0])))
                return float((iris[0] - min(a[0], b[0])) / denom)

            gaze_values = [ratio(iris_l, left_eye_corners), ratio(iris_r, right_eye_corners)]
            gaze_x = float(np.mean(gaze_values))
            gaze_alignment = max(0.0, min(1.0, 1.0 - abs(gaze_x - 0.5) * 2.0))

            # Face box from normalized landmarks.
            xs, ys = [p.x for p in lm], [p.y for p in lm]
            fx1, fx2 = int(max(0, min(xs)) * w), int(min(1, max(xs)) * w)
            fy1, fy2 = int(max(0, min(ys)) * h), int(min(1, max(ys)) * h)
            face_bbox = [fx1, fy1, max(fx1 + 1, fx2), max(fy1 + 1, fy2)]

            # Head orientation proxy: nose relative to eye midpoint.
            nose = pt(1)
            eye_mid = (pt(33) + pt(263)) / 2.0
            yaw_delta = float(nose[0] - eye_mid[0])
            pitch_delta = float(nose[1] - eye_mid[1])

            if abs(yaw_delta) > 0.055:
                orientation = "left" if yaw_delta < 0 else "right"
            elif pitch_delta < -0.035:
                orientation = "up"
            elif pitch_delta > 0.055:
                orientation = "down"
            else:
                orientation = "centered"

            # Mouth activity remains an observable articulation cue.
            mouth_open = abs(float(pt(13)[1] - pt(14)[1])) > 0.018

            notes = [
                f"Eye-iris gaze alignment estimated from MediaPipe landmarks: {gaze_alignment:.2f}.",
                f"Head orientation estimated from facial landmarks: {orientation}.",
            ]

            return FaceOrientationResult(
                face_detected=True,
                face_bbox=face_bbox,
                camera_orientation=orientation,
                gaze_alignment_score=round(gaze_alignment, 3),
                mouth_region_activity=mouth_open,
                smile_expressive_detected=mouth_open,
                observable_notes=notes,
                gaze_method="mediapipe_face_mesh_iris",
            )
        except Exception as exc:
            logger.debug("[FaceAnalyzer] Landmark analysis failed: %s", exc)
            return self._fallback(frame_bgr, x1, y1, x2, y2, "Landmark analysis failed; fallback face detection used.")


_face_analyzer: Optional[FaceAnalyzer] = None


def get_face_analyzer() -> FaceAnalyzer:
    global _face_analyzer
    if _face_analyzer is None:
        _face_analyzer = FaceAnalyzer()
    return _face_analyzer
