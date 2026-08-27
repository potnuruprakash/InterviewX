"""Health check router"""
from fastapi import APIRouter
from app.services import sbert_service, video_service
import os

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "interviewx-ai-service",
        "version": "3.0.0",
        "phases": {
            "phase_4_sbert": sbert_service.get_model_status(),
            "phase_5_audio": "librosa_feature_extraction",
            "phase_6_video": video_service.get_yolo_status(),
            "phase_7_fusion": "active",
            "cnn_lstm": "not_trained",
        },
        "models": {
            "sbert_model": sbert_service.get_model_name(),
            "yolo_model": os.getenv("YOLO_MODEL_PATH", "yolov8n.pt"),
        },
    }

