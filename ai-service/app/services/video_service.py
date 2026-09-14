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
from app.video import get_video_pipeline


# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────

def load_yolo_model():
    """Load YOLOv8 model. Called once at startup."""
    pipeline = get_video_pipeline()
    logger.info(f"[VideoService] Pipeline initialized with YOLO status: {pipeline.yolo_detector.status}")


def get_yolo_status() -> str:
    pipeline = get_video_pipeline()
    return pipeline.yolo_detector.status


def get_model_audit_report() -> dict:
    pipeline = get_video_pipeline()
    return pipeline.get_audit_report()


# ─────────────────────────────────────────────────────────────────────────────
# FRAME EXTRACTION (Legacy Helper)
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
# VIDEO ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────

def analyze_video(video_path: str) -> dict:
    """
    Analyzes candidate video using the verified VideoAnalysisPipeline.
    Returns measurable presence, framing, and facial expression statistics.
    No psychological inferences or candidate confidence assertions are made.
    """
    pipeline = get_video_pipeline()
    return pipeline.process_video(video_path, fps=FRAME_SAMPLE_FPS)

