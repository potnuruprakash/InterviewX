"""
Video Analysis Module — InterviewX
Modular, empirical video presence, framing, and facial expression analysis pipeline.
"""

from app.video.inference.pipeline import VideoAnalysisPipeline, get_video_pipeline

__all__ = ["VideoAnalysisPipeline", "get_video_pipeline"]
