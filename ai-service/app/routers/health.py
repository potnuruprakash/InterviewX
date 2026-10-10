"""Health and readiness router

Mode-aware health & readiness probes:
  GET /health  - Extremely fast liveness probe (<10ms). Render uses this.
                 Does NOT run any ML inference.
  GET /ready   - Readiness check: verifies active mode's models are loaded/available.
                 Used by backend/deployment checks.
"""
import os
import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


def _get_service_mode() -> str:
    return os.getenv("AI_SERVICE_MODE", "core").lower().strip()


@router.get("/health")
async def health():
    """Ultra-fast liveness probe. Never runs inference. Used by Render health checks."""
    mode = _get_service_mode()

    data = {
        "status": "ok",
        "service": "interviewx-ai",
        "mode": mode,
        "phases": {},
        "models": {},
    }

    if mode in ("core", "full", "all"):
        try:
            from app.services import sbert_service
            sbert_status = sbert_service.get_model_status()
        except Exception as e:
            sbert_status = f"error: {str(e)}"

        data["phases"].update({
            "phase_4_sbert": sbert_status,
            "phase_5_audio": "librosa_feature_extraction",
            "phase_7_fusion": "active",
            "cnn_lstm": "not_trained",
        })
        data["models"].update({
            "sbert": sbert_status,
            "audio": "librosa_ready",
        })

    if mode in ("video", "full", "all"):
        try:
            from app.services import video_service
            yolo_status = video_service.get_yolo_status()
            video_models = video_service.get_video_model_status()
        except Exception as e:
            yolo_status = f"error: {str(e)}"
            video_models = {"error": str(e)}

        data["phases"]["phase_6_video"] = yolo_status
        data["video_models"] = video_models
        data["models"].update({
            "yolo": yolo_status,
            "mediaPipe": "lazy",
        })

    return data


@router.get("/ready")
async def ready():
    """
    Readiness probe: indicates whether AI models for the current runtime mode
    are loaded and ready to serve. Returns 200 when ready, 503 when still loading/degraded.
    """
    mode = _get_service_mode()

    if mode == "video":
        from app.services import video_service
        yolo_status = video_service.get_yolo_status()
        video_loading = video_service.is_loading()
        is_ready = (yolo_status == "loaded") and not video_loading

        response_body = {
            "status": "ready" if is_ready else ("loading" if video_loading else "degraded"),
            "service": "interviewx-ai",
            "mode": mode,
            "models": {
                "yolo": yolo_status,
                "video_models": video_service.get_video_model_status(),
            },
            "ready": is_ready,
        }
        if not is_ready:
            return JSONResponse(status_code=503, content=response_body)
        return response_body

    elif mode == "core":
        from app.services import sbert_service
        sbert_status = sbert_service.get_model_status()
        sbert_loading = sbert_service.is_loading()
        # SBERT is lazy-loaded on demand; not_loaded or loaded are operational states.
        # Degraded only when an error occurs during loading.
        is_ready = not sbert_loading and not sbert_status.startswith("load_error")

        response_body = {
            "status": "ready" if is_ready else ("loading" if sbert_loading else "degraded"),
            "service": "interviewx-ai",
            "mode": mode,
            "models": {
                "sbert": sbert_status,
                "audio": "librosa_ready",
            },
            "ready": is_ready,
        }
        if not is_ready:
            return JSONResponse(status_code=503, content=response_body)
        return response_body

    else:  # full or all
        from app.services import sbert_service, video_service
        sbert_status = sbert_service.get_model_status()
        yolo_status = video_service.get_yolo_status()
        sbert_loading = sbert_service.is_loading()
        video_loading = video_service.is_loading()

        sbert_ready = not sbert_loading and not sbert_status.startswith("load_error")
        video_ready = (yolo_status == "loaded") and not video_loading
        all_ready = sbert_ready and video_ready
        any_loading = sbert_loading or video_loading

        response_body = {
            "status": "ready" if all_ready else ("loading" if any_loading else "degraded"),
            "service": "interviewx-ai",
            "mode": mode,
            "models": {
                "sbert": sbert_status,
                "yolo": yolo_status,
                "audio": "librosa_ready",
                "video_models": video_service.get_video_model_status(),
            },
            "ready": all_ready,
        }
        if not all_ready:
            return JSONResponse(status_code=503, content=response_body)
        return response_body

