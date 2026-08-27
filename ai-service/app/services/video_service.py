"""
Video Analysis Service — Phase 6

Uses YOLOv8 (pretrained) for person/face detection in video frames.

WHAT THIS DOES:
  - Extracts frames from video at a controlled rate (default: 1 FPS)
  - Runs YOLOv8 person detection on sampled frames
  - Returns frame statistics: person detection ratio, presence consistency

WHAT THIS DOES NOT DO:
  - Make psychological inferences
  - Claim "candidate is nervous/lying/confident"
  - Use custom trained weights (pretrained COCO weights only)

Model: yolov8n.pt (~6MB, auto-downloaded from Ultralytics on first use)
YOLO_MODEL_PATH env var can override with a custom weights file.
"""

import os
import logging
import tempfile
from typing import List, Optional

logger = logging.getLogger(__name__)

YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
FRAME_SAMPLE_FPS = int(os.getenv("VIDEO_FRAME_SAMPLE_FPS", "1"))

_yolo_model = None
_yolo_model_status = "not_loaded"


# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────

def load_yolo_model():
    """Load YOLOv8 model. Called once at startup."""
    global _yolo_model, _yolo_model_status
    if _yolo_model is not None:
        return

    try:
        from ultralytics import YOLO
        logger.info(f"[Video] Loading YOLO model: {YOLO_MODEL_PATH}")
        _yolo_model = YOLO(YOLO_MODEL_PATH)
        _yolo_model_status = "pretrained_loaded"
        logger.info("[Video] YOLO model loaded successfully.")
    except ImportError:
        _yolo_model_status = "ultralytics_not_installed"
        logger.warning("[Video] ultralytics not installed. Run: pip install ultralytics")
    except Exception as e:
        _yolo_model_status = f"load_error: {str(e)}"
        logger.error(f"[Video] YOLO model load failed: {e}")


def get_yolo_status() -> str:
    return _yolo_model_status


# ─────────────────────────────────────────────────────────────────────────────
# FRAME EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_frames(video_path: str, fps: int = FRAME_SAMPLE_FPS) -> List:
    """
    Extract frames from video at specified FPS rate.
    Returns list of (frame_index, frame_array) tuples.
    """
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"[Video] Cannot open video: {video_path}")
            return []

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_interval = max(1, int(video_fps / fps))

        frames = []
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_interval == 0:
                frames.append((frame_idx, frame))
            frame_idx += 1

        cap.release()
        # Cap at 60 frames to avoid excessive processing
        return frames[:60]

    except ImportError:
        logger.warning("[Video] opencv-python not installed.")
        return []
    except Exception as e:
        logger.error(f"[Video] Frame extraction error: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# YOLO INFERENCE
# ─────────────────────────────────────────────────────────────────────────────

def analyze_video(video_path: str) -> dict:
    """
    Analyze video for person detection using YOLOv8.

    Returns measurable frame-level statistics only.
    No psychological inferences are made.
    """
    if not os.path.exists(video_path):
        return _unavailable_result("Video file not found.")

    if _yolo_model is None:
        return {
            "framesProcessed": 0,
            "personDetectionRatio": None,
            "faceVisibilityRatio": None,
            "videoQualityIndicator": None,
            "modelStatus": _yolo_model_status,
            "processingConfidence": None,
            "note": "YOLO model not loaded. Cannot perform video analysis.",
        }

    frames = extract_frames(video_path, fps=FRAME_SAMPLE_FPS)
    if not frames:
        return _unavailable_result("Could not extract frames from video.")

    person_detected_frames = 0
    total_person_confidence = []

    try:
        for frame_idx, frame in frames:
            results = _yolo_model(frame, verbose=False, classes=[0])  # class 0 = person
            for result in results:
                if result.boxes and len(result.boxes) > 0:
                    person_detected_frames += 1
                    confs = result.boxes.conf.cpu().numpy().tolist()
                    total_person_confidence.extend(confs)
                    break  # count frame as person-detected

        frames_processed = len(frames)
        person_ratio = person_detected_frames / frames_processed if frames_processed > 0 else 0

        avg_confidence = (
            sum(total_person_confidence) / len(total_person_confidence)
            if total_person_confidence else None
        )

        # Video quality indicator (basic heuristic)
        quality = "good" if person_ratio >= 0.7 else "fair" if person_ratio >= 0.4 else "poor"

        return {
            "framesProcessed": frames_processed,
            "personDetectedFrames": person_detected_frames,
            "personDetectionRatio": round(person_ratio, 3),
            "faceVisibilityRatio": None,  # face keypoints need separate model
            "videoQualityIndicator": quality,
            "modelStatus": _yolo_model_status,
            "processingConfidence": round(avg_confidence, 3) if avg_confidence else None,
            "modelName": YOLO_MODEL_PATH,
            "note": "Person detection results only. No psychological inferences made.",
        }

    except Exception as e:
        logger.error(f"[Video] YOLO inference error: {e}")
        return _unavailable_result(f"YOLO inference failed: {str(e)}")


def _unavailable_result(reason: str) -> dict:
    return {
        "framesProcessed": 0,
        "personDetectionRatio": None,
        "faceVisibilityRatio": None,
        "videoQualityIndicator": None,
        "modelStatus": "unavailable",
        "processingConfidence": None,
        "reason": reason,
    }
