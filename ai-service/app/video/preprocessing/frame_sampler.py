"""
Frame Sampling & Video Preprocessing Module
Extracts frames at a controlled sample rate with exact timestamp tracking.

Low-memory defaults for CPU-only hosting: sample at 1 FPS, analyze at most 8 frames,
and resize each frame to at most 384px before YOLO/MediaPipe inference. These are
intentional hard caps for small instances; increasing the environment variables alone
will not raise these limits. Change the constants below deliberately and load-test
memory/latency before raising them.
"""

import os
import cv2
import logging
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)

# Sampling frequency can be configured, while inference work remains hard-capped.
DEFAULT_SAMPLE_FPS = max(1, min(2, int(os.getenv("VIDEO_FRAME_SAMPLE_FPS", "1"))))
MAX_FRAMES_TO_ANALYZE = min(8, max(1, int(os.getenv("VIDEO_MAX_FRAMES", "8"))))
# Downscale decoded frames before expensive YOLO/MediaPipe processing.
MAX_FRAME_DIMENSION = min(
    384,
    max(160, int(os.getenv("VIDEO_MAX_DIMENSION", os.getenv("VIDEO_MAX_FRAME_DIM", "384")))),
)


@dataclass
class FrameSample:
    frame_index: int
    timestamp_sec: float
    image: any  # numpy array (BGR)
    width: int
    height: int


def extract_sampled_frames(
    video_path: str,
    fps: int = DEFAULT_SAMPLE_FPS,
    max_frames: int = MAX_FRAMES_TO_ANALYZE
) -> List[FrameSample]:
    """
    Decode a video and extract frames at a controlled sample rate.

    Args:
        video_path: Path to the local video file.
        fps: Target sampling rate (1-2 frames per second).
        max_frames: Requested maximum; the service hard-caps this at 8 frames.

    Returns:
        List of FrameSample dataclasses with timestamps and resolution metadata.
    """
    if not os.path.exists(video_path):
        logger.warning(f"[FrameSampler] File does not exist: {video_path}")
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.warning(f"[FrameSampler] Failed to open video stream: {video_path}")
        return []

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if not video_fps or video_fps <= 0 or video_fps > 120:
        video_fps = 30.0  # Safe standard fallback

    effective_fps = max(1, min(2, int(fps)))
    effective_max_frames = min(MAX_FRAMES_TO_ANALYZE, max(1, int(max_frames)))
    frame_interval = max(1, int(round(video_fps / effective_fps)))
    sampled_frames: List[FrameSample] = []
    current_frame_idx = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if current_frame_idx % frame_interval == 0:
                h, w = frame.shape[:2]
                max_dim = max(h, w)
                if MAX_FRAME_DIMENSION > 0 and max_dim > MAX_FRAME_DIMENSION:
                    scale = MAX_FRAME_DIMENSION / float(max_dim)
                    frame = cv2.resize(
                        frame,
                        (max(1, int(w * scale)), max(1, int(h * scale))),
                        interpolation=cv2.INTER_AREA,
                    )
                    h, w = frame.shape[:2]
                timestamp = round(current_frame_idx / video_fps, 2)
                sampled_frames.append(
                    FrameSample(
                        frame_index=current_frame_idx,
                        timestamp_sec=timestamp,
                        image=frame,
                        width=w,
                        height=h,
                    )
                )
                if len(sampled_frames) >= effective_max_frames:
                    logger.info(
                        f"[FrameSampler] Reached maximum sample ceiling ({effective_max_frames} frames)."
                    )
                    break

            current_frame_idx += 1

    except Exception as e:
        logger.error(f"[FrameSampler] Error while reading video frames: {e}")
    finally:
        cap.release()

    logger.info(
        f"[FrameSampler] Sampled {len(sampled_frames)} frames from {video_path} "
        f"(video_fps={video_fps:.1f}, interval={frame_interval}, max_dim={MAX_FRAME_DIMENSION})"
    )
    return sampled_frames
