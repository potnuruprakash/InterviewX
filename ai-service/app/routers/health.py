"""Health and readiness router

Phase 15 optimization:
  GET /health  - Extremely fast liveness probe (<10ms). Render uses this.
               Does NOT run any ML inference.
  GET /ready   - Readiness check: shows which models are available.
               Used by backend/frontend to check AI capability.
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.services import sbert_service, video_service
import os

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health():
    """Ultra-fast liveness probe. Never runs inference. Used by Render health checks."""
    # Compute model statuses without any blocking calls
    sbert_status = sbert_service.get_model_status()
    yolo_status = video_service.get_yolo_status()

    # Service is 'ok' as long as HTTP is reachable, regardless of model state
    return {
        "status": "ok",
        "service": "interviewx-ai",
        "phases": {
            "phase_4_sbert": sbert_service.get_model_status(),
            "phase_5_audio": "librosa_feature_extraction",
            "phase_6_video": video_service.get_yolo_status(),
            "phase_7_fusion": "active",
            "cnn_lstm": "not_trained",
        },
        "video_models": video_service.get_video_model_status() if hasattr(video_service, "get_video_model_status") else {},
        "models": {
            "sbert": sbert_status,
            "yolo": yolo_status,
            "mediaPipe": "lazy",
            "audio": "librosa_ready",
        },
    }


@router.get("/ready")
async def ready():
    """
    Readiness probe: indicates whether AI models are loaded and ready to serve.
    Returns 200 when all core models are ready, 503 when still loading.
    """
    sbert_ready = sbert_service.get_model_status() == "loaded"
    yolo_ready = video_service.get_yolo_status() == "loaded"
    sbert_loading = sbert_service.is_loading()
    video_loading = video_service.is_loading()

    all_ready = sbert_ready and yolo_ready
    any_loading = sbert_loading or video_loading

    response_body = {
        "status": "ready" if all_ready else ("loading" if any_loading else "degraded"),
        "service": "interviewx-ai",
        "models": {
            "sbert": sbert_service.get_model_status(),
            "yolo": video_service.get_yolo_status(),
            "mediaPipe": "lazy",
            "audio": "librosa_ready",
        },
        "ready": all_ready,
    }

    if not all_ready:
        return JSONResponse(status_code=503, content=response_body)
    return response_body
