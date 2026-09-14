"""
YOLOv8 Candidate Presence & Framing Detector
Runs YOLOv8 object detection strictly for person detection, candidate framing, and multi-person tracking.
Does NOT fabricate emotion or psychological inferences.
"""

import os
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")


@dataclass
class DetectionResult:
    person_detected: bool
    person_count: int
    confidence: float
    bbox: Optional[List[float]]  # Normalized [x1, y1, x2, y2]
    pixel_bbox: Optional[List[int]]  # Pixel [x1, y1, x2, y2]
    head_bbox: Optional[List[int]]  # Pixel [x1, y1, x2, y2] for face region
    good_framing: bool
    framing_notes: List[str]


class YOLODetector:
    """Singleton-ready YOLOv8 detector for candidate presence and framing."""

    def __init__(self, model_path: str = YOLO_MODEL_PATH):
        self.model_path = model_path
        self._model = None
        self._status = "not_loaded"
        self._load_model()

    def _load_model(self):
        """Loads the YOLOv8 model once."""
        if self._model is not None:
            return

        try:
            from ultralytics import YOLO
            logger.info(f"[YOLODetector] Loading YOLO model from {self.model_path}...")
            self._model = YOLO(self.model_path)
            self._status = "loaded"
            logger.info(f"[YOLODetector] Model loaded successfully (Task: {self._model.task}).")
        except ImportError:
            self._status = "ultralytics_not_installed"
            logger.warning("[YOLODetector] ultralytics package not installed.")
        except Exception as e:
            self._status = f"load_error: {str(e)}"
            logger.error(f"[YOLODetector] Failed to load YOLO model: {e}")

    @property
    def status(self) -> str:
        return self._status

    @property
    def is_available(self) -> bool:
        return self._model is not None

    def detect_frame(self, frame_bgr, min_confidence: float = 0.35) -> DetectionResult:
        """
        Executes person detection on a single frame.

        Args:
            frame_bgr: OpenCV BGR image numpy array.
            min_confidence: Confidence threshold for person detection.

        Returns:
            DetectionResult dataclass.
        """
        if self._model is None or frame_bgr is None:
            return DetectionResult(
                person_detected=False,
                person_count=0,
                confidence=0.0,
                bbox=None,
                pixel_bbox=None,
                head_bbox=None,
                good_framing=False,
                framing_notes=["YOLO model unavailable or invalid frame."],
            )

        h, w = frame_bgr.shape[:2]
        frame_area = max(1, w * h)

        try:
            # Class 0 is person in standard COCO
            results = self._model(frame_bgr, verbose=False, classes=[0], conf=min_confidence)
            if not results or len(results) == 0:
                return DetectionResult(
                    person_detected=False,
                    person_count=0,
                    confidence=0.0,
                    bbox=None,
                    pixel_bbox=None,
                    head_bbox=None,
                    good_framing=False,
                    framing_notes=["No person detected in frame."],
                )

            boxes = results[0].boxes
            if boxes is None or len(boxes) == 0:
                return DetectionResult(
                    person_detected=False,
                    person_count=0,
                    confidence=0.0,
                    bbox=None,
                    pixel_bbox=None,
                    head_bbox=None,
                    good_framing=False,
                    framing_notes=["No person detected in frame."],
                )

            person_count = len(boxes)
            confs = boxes.conf.cpu().numpy()
            xyxy = boxes.xyxy.cpu().numpy()

            # Find primary candidate box (highest confidence or largest area)
            best_idx = 0
            if person_count > 1:
                # Rank by area * confidence
                scores = [
                    ((b[2] - b[0]) * (b[3] - b[1])) * confs[i]
                    for i, b in enumerate(xyxy)
                ]
                best_idx = scores.index(max(scores))

            primary_box = xyxy[best_idx]
            primary_conf = float(confs[best_idx])

            x1, y1, x2, y2 = [int(v) for v in primary_box]
            x1 = max(0, min(w - 1, x1))
            y1 = max(0, min(h - 1, y1))
            x2 = max(x1 + 1, min(w, x2))
            y2 = max(y1 + 1, min(h, y2))

            # Normalized bounding box
            norm_bbox = [round(x1 / w, 4), round(y1 / h, 4), round(x2 / w, 4), round(y2 / h, 4)]
            pixel_bbox = [x1, y1, x2, y2]

            # Candidate head / face region estimate (upper 35% of person detection box)
            head_height = int((y2 - y1) * 0.35)
            head_y2 = min(y2, y1 + head_height)
            head_bbox = [x1, y1, x2, head_y2]

            # Framing checks
            framing_notes = []
            box_w = x2 - x1
            box_h = y2 - y1
            box_area = box_w * box_h
            area_ratio = box_area / frame_area
            center_x = (x1 + x2) / 2.0 / w

            is_centered = 0.22 <= center_x <= 0.78
            is_scale_good = 0.12 <= area_ratio <= 0.85

            if not is_centered:
                framing_notes.append("Candidate positioned off-center.")
            if area_ratio < 0.12:
                framing_notes.append("Candidate positioned too far from camera.")
            elif area_ratio > 0.85:
                framing_notes.append("Candidate too close to camera edges.")

            if person_count > 1:
                framing_notes.append(f"Multiple people ({person_count}) detected in frame.")

            good_framing = is_centered and is_scale_good and (person_count == 1)

            return DetectionResult(
                person_detected=True,
                person_count=person_count,
                confidence=round(primary_conf, 3),
                bbox=norm_bbox,
                pixel_bbox=pixel_bbox,
                head_bbox=head_bbox,
                good_framing=good_framing,
                framing_notes=framing_notes,
            )

        except Exception as e:
            logger.error(f"[YOLODetector] Inference error: {e}")
            return DetectionResult(
                person_detected=False,
                person_count=0,
                confidence=0.0,
                bbox=None,
                pixel_bbox=None,
                head_bbox=None,
                good_framing=False,
                framing_notes=[f"Detection error: {str(e)}"],
            )


# Global singleton detector instance
_detector_instance: Optional[YOLODetector] = None


def get_yolo_detector() -> YOLODetector:
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = YOLODetector()
    return _detector_instance
