"""
Frame Sampling & Video Preprocessing Module
Extracts frames at a controlled sample rate (2-5 FPS) with exact timestamp tracking.
"""

import os
import cv2
import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)

DEFAULT_SAMPLE_FPS = int(os.getenv("VIDEO_FRAME_SAMPLE_FPS", "2"))
MAX_FRAMES_TO_ANALYZE = int(os.getenv("VIDEO_MAX_FRAMES", "120"))


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
    Decodes video and extracts frames at the specified sample rate.
    
    Args:
        video_path: Path to the local video file.
        fps: Target sampling rate (frames per second, 2-5 recommended).
        max_frames: Hard ceiling on sampled frames to guard server memory.
        
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

    frame_interval = max(1, int(round(video_fps / max(1, fps))))
    sampled_frames: List[FrameSample] = []
    current_frame_idx = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if current_frame_idx % frame_interval == 0:
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
                if len(sampled_frames) >= max_frames:
                    logger.info(f"[FrameSampler] Reached maximum sample ceiling ({max_frames} frames).")
                    break

            current_frame_idx += 1

    except Exception as e:
        logger.error(f"[FrameSampler] Error while reading video frames: {e}")
    finally:
        cap.release()

    logger.info(
        f"[FrameSampler] Sampled {len(sampled_frames)} frames from {video_path} "
        f"(video_fps={video_fps:.1f}, interval={frame_interval})"
    )
    return sampled_frames
