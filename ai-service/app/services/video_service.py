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
import threading
import time
from typing import List, Optional

logger = logging.getLogger(__name__)

YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
FRAME_SAMPLE_FPS = int(os.getenv("VIDEO_FRAME_SAMPLE_FPS", "1"))

_yolo_model = None
_yolo_model_status = "not_loaded"

# Concurrency guard for pipeline singleton creation
_pipeline_lock = threading.Lock()
_pipeline_loading = False  # True while pipeline/__init is executing


# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────

def get_video_pipeline():
    """
    Concurrency-safe accessor for the VideoAnalysisPipeline singleton.
    Multiple simultaneous first-requests will serialize through _pipeline_lock.
    """
    global _pipeline_loading

    import app.video.inference.pipeline as _pl_mod
    if _pl_mod._pipeline_instance is not None:
        return _pl_mod._pipeline_instance

    with _pipeline_lock:
        # Double-checked locking
        if _pl_mod._pipeline_instance is not None:
            return _pl_mod._pipeline_instance
        _pipeline_loading = True
        try:
            from app.video import get_video_pipeline as _get_video_pipeline_raw
            return _get_video_pipeline_raw()
        finally:
            _pipeline_loading = False


def load_yolo_model():
    """Trigger pipeline initialization. Called from background startup task."""
    init_start = time.monotonic()
    logger.info("[VideoService] Initializing video pipeline (YOLO + face analyzer) ...")
    pipeline = get_video_pipeline()
    init_seconds = time.monotonic() - init_start
    logger.info(f"[VideoService] Pipeline ready in {init_seconds:.2f}s. YOLO status: {pipeline.yolo_detector.status}")


def is_loading() -> bool:
    """True while the pipeline is currently being created in the background."""
    return _pipeline_loading


def is_ready() -> bool:
    """True when the pipeline singleton has been fully created."""
    import app.video.inference.pipeline as _pl_mod
    return _pl_mod._pipeline_instance is not None


def get_yolo_status() -> str:
    """Return YOLO model status without triggering pipeline initialization."""
    import app.video.inference.pipeline as _pl_mod
    if _pl_mod._pipeline_instance is None:
        return "loading" if _pipeline_loading else "not_loaded"
    return _pl_mod._pipeline_instance.yolo_detector.status


def get_video_model_status() -> dict:
    """Return per-model video readiness without triggering initialization."""
    import app.video.inference.pipeline as _pl_mod
    if _pl_mod._pipeline_instance is None:
        return {
            "pipeline": "loading" if _pipeline_loading else "not_loaded",
            "yolo": get_yolo_status(),
            "face": "not_loaded",
            "pose": "not_loaded",
        }

    pipeline = _pl_mod._pipeline_instance
    return {
        "pipeline": "ready",
        "yolo": pipeline.yolo_detector.status,
        "face": pipeline.face_analyzer.status,
        "pose": pipeline.pose_analyzer.status,
    }


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
    start_time = time.monotonic()
    pipeline = get_video_pipeline()
    result = pipeline.process_video(video_path, fps=FRAME_SAMPLE_FPS)
    duration = time.monotonic() - start_time
    logger.info(f"[VideoService] Video analysis finished in {duration:.2f}s for {video_path}")
    return result

