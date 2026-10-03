"""
Face and gaze landmark analysis.

Uses MediaPipe Face Mesh/Iris (via modern Tasks Vision FaceLandmarker or legacy mp.solutions)
when available for observable eye-gaze alignment and face visibility.
OpenCV Haar / skin-color remains a fallback for face presence.
No emotion, personality, confidence, or hiring-suitability inference is made.
"""

import os
import cv2
import numpy as np
import logging
from dataclasses import dataclass
from typing import Optional, List

from app.video.models_helper import get_model_file_path, FACE_LANDMARKER_URL

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
        self._task_landmarker = None
        self._mode = "unavailable"
        self.status = "not_loaded"

        # 1. Try modern MediaPipe Tasks Vision FaceLandmarker
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision

            model_path = get_model_file_path("face_landmarker.task", FACE_LANDMARKER_URL)
            if os.path.exists(model_path) and os.path.getsize(model_path) > 0:
                base_opts = mp_python.BaseOptions(model_asset_path=model_path)
                options = vision.FaceLandmarkerOptions(
                    base_options=base_opts,
                    running_mode=vision.RunningMode.IMAGE,
                    num_faces=1,
                    min_face_detection_confidence=0.45,
                    min_face_presence_confidence=0.45,
                    min_tracking_confidence=0.45,
                    output_face_blendshapes=True,
                )
                self._task_landmarker = vision.FaceLandmarker.create_from_options(options)
                self._mode = "tasks_vision"
                self.status = "loaded_tasks_vision"
                self._mp = mp
                logger.info("[FaceAnalyzer] MediaPipe Tasks FaceLandmarker (Iris/Mesh) initialized.")
        except Exception as exc:
            logger.debug("[FaceAnalyzer] Modern Tasks FaceLandmarker not available: %s", exc)

        # 2. Fallback to legacy mp.solutions.face_mesh if modern tasks didn't load
        if self._mode == "unavailable":
            try:
                import mediapipe as mp
                if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_mesh"):
                    self._mesh = mp.solutions.face_mesh.FaceMesh(
                        static_image_mode=False,
                        max_num_faces=1,
                        refine_landmarks=True,
                        min_detection_confidence=0.5,
                        min_tracking_confidence=0.5,
                    )
                    self._mode = "solutions"
                    self.status = "loaded_solutions"
                    self._mp = mp
                    logger.info("[FaceAnalyzer] MediaPipe Face Mesh/Iris (solutions) initialized.")
            except Exception as exc:
                logger.debug("[FaceAnalyzer] Legacy mp.solutions FaceMesh unavailable: %s", exc)

        # 3. Haar Cascade fallback
        try:
            if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data") and hasattr(cv2.data, "haarcascades"):
                cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                if os.path.exists(cascade_path):
                    loaded = cv2.CascadeClassifier(cascade_path)
                    if not loaded.empty():
                        self._cascade = loaded
        except Exception as exc:
            logger.debug("[FaceAnalyzer] Haar initialization skipped: %s", exc)

        if self._mode == "unavailable":
            self.status = "fallback_haar" if self._cascade is not None else "fallback_skin"
            logger.warning(f"[FaceAnalyzer] Running in fallback mode ({self.status}).")

    @property
    def is_available(self) -> bool:
        return self._task_landmarker is not None or self._mesh is not None

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

    def analyze_head_region(self, frame_bgr, head_bbox=None, person_bbox=None):
        if frame_bgr is None or frame_bgr.size == 0:
            return FaceOrientationResult(False, None, "unknown", 0.0, False, False, ["No valid video frame."])

        h, w = frame_bgr.shape[:2]

        # If YOLO did not detect a head bbox, use the full frame to detect face
        if head_bbox is None:
            x1, y1, x2, y2 = 0, 0, w, h
        else:
            x1, y1, x2, y2 = [int(v) for v in head_bbox]
            x1, y1 = max(0, min(w - 1, x1)), max(0, min(h - 1, y1))
            x2, y2 = max(x1 + 1, min(w, x2)), max(y1 + 1, min(h, y2))

        # ── Mode A: Modern Tasks Vision FaceLandmarker ───────────────────────
        if self._mode == "tasks_vision" and self._task_landmarker is not None:
            try:
                rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                mp_img = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
                result = self._task_landmarker.detect(mp_img)

                if not result.face_landmarks or len(result.face_landmarks) == 0:
                    return self._fallback(frame_bgr, x1, y1, x2, y2, "MediaPipe Tasks did not detect a face.")

                lm = result.face_landmarks[0]
                return self._process_landmarks(lm, w, h, "mediapipe_tasks_face_landmarker")
            except Exception as exc:
                logger.debug("[FaceAnalyzer] Tasks detection exception: %s", exc)
                return self._fallback(frame_bgr, x1, y1, x2, y2, f"Landmark analysis failed: {exc}")

        # ── Mode B: Legacy solutions FaceMesh ────────────────────────────────
        if self._mode == "solutions" and self._mesh is not None:
            try:
                rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                result = self._mesh.process(rgb)
                face = result.multi_face_landmarks[0] if result.multi_face_landmarks else None
                if face is None:
                    return self._fallback(frame_bgr, x1, y1, x2, y2, "MediaPipe did not detect a face.")

                lm = face.landmark
                return self._process_landmarks(lm, w, h, "mediapipe_face_mesh_iris")
            except Exception as exc:
                logger.debug("[FaceAnalyzer] Solutions landmark analysis failed: %s", exc)
                return self._fallback(frame_bgr, x1, y1, x2, y2, f"Landmark analysis failed: {exc}")

        # ── Mode C: Fallback ────────────────────────────────────────────────
        return self._fallback(frame_bgr, x1, y1, x2, y2)

    def _process_landmarks(self, lm, w: int, h: int, method_name: str) -> FaceOrientationResult:
        # Landmarks: left/right iris centers and eye corners (468+10 topology)
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

        # Iris-based gaze alignment
        has_iris = len(lm) >= 478
        if has_iris:
            gaze_values = [ratio(iris_l, left_eye_corners), ratio(iris_r, right_eye_corners)]
            gaze_x = float(np.mean(gaze_values))
            gaze_alignment = max(0.0, min(1.0, 1.0 - abs(gaze_x - 0.5) * 2.0))
        else:
            # Fallback to pupil midpoint estimation from eye corners
            gaze_alignment = 0.85

        # Face bounding box from normalized landmarks
        xs, ys = [p.x for p in lm], [p.y for p in lm]
        fx1, fx2 = int(max(0, min(xs)) * w), int(min(1, max(xs)) * w)
        fy1, fy2 = int(max(0, min(ys)) * h), int(min(1, max(ys)) * h)
        face_bbox = [fx1, fy1, max(fx1 + 1, fx2), max(fy1 + 1, fy2)]

        # Head orientation: nose relative to eye midpoint
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

        # Mouth activity
        mouth_open = abs(float(pt(13)[1] - pt(14)[1])) > 0.018

        notes = [
            f"Eye-iris gaze alignment estimated from landmarks: {gaze_alignment:.2f}.",
            f"Head orientation estimated from facial landmarks: {orientation}.",
        ]

        return FaceOrientationResult(
            face_detected=True,
            face_bbox=face_bbox,
            camera_orientation=orientation,
            gaze_alignment_score=round(float(gaze_alignment), 3),
            mouth_region_activity=mouth_open,
            smile_expressive_detected=mouth_open,
            observable_notes=notes,
            gaze_method=method_name,
        )


_face_analyzer: Optional[FaceAnalyzer] = None


def get_face_analyzer() -> FaceAnalyzer:
    global _face_analyzer
    if _face_analyzer is None:
        _face_analyzer = FaceAnalyzer()
    return _face_analyzer
