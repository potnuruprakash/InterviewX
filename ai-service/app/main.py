"""
Main FastAPI application — InterviewX AI Service
Supports split runtime modes via AI_SERVICE_MODE:
  - 'core':  SBERT text evaluation, Librosa audio feature extraction, multimodal fusion.
  - 'video': YOLOv8 person detection, MediaPipe face/gaze/pose analysis, frame sampling.
  - 'full':  Unified single-instance mode (backward compatibility).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

AI_SERVICE_MODE = os.getenv("AI_SERVICE_MODE", "core").lower().strip()
if AI_SERVICE_MODE not in ("core", "video", "full", "all"):
    logger.warning("[Config] Unknown AI_SERVICE_MODE='%s'. Defaulting to 'core'.", AI_SERVICE_MODE)
    AI_SERVICE_MODE = "core"


async def _load_video_models_background():
    """
    Load YOLOv8 and initialize video pipeline in background thread after HTTP server starts.
    This allows Render to bind $PORT and answer health probes immediately.
    """
    loop = asyncio.get_event_loop()
    logger.info("[Startup] Video background task: initializing YOLOv8 / video pipeline ...")
    try:
        from app.services import video_service
        await loop.run_in_executor(None, video_service.load_yolo_model)
        logger.info(
            "[Startup] Video pipeline ready. YOLO=%s Face=%s Pose=%s",
            video_service.get_yolo_status(),
            video_service.get_video_model_status().get("face"),
            video_service.get_video_model_status().get("pose"),
        )
    except Exception as exc:
        logger.error("[Startup] Video pipeline load error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler.
    Starts only the background workers appropriate for the current AI_SERVICE_MODE.
    """
    logger.info("[Startup] InterviewX AI Service starting in mode='%s' -- binding port now.", AI_SERVICE_MODE)

    _bg_task = None
    if AI_SERVICE_MODE in ("video", "full", "all"):
        logger.info("[Startup] Scheduling video pipeline background initialization.")
        _bg_task = asyncio.create_task(_load_video_models_background())
    else:
        logger.info("[Startup] Core mode active: SBERT is lazy-loaded on demand; audio feature extraction ready.")

    yield  # Uvicorn binds $PORT and starts serving here

    # Shutdown
    logger.info("[Shutdown] AI service (mode='%s') shutting down.", AI_SERVICE_MODE)
    if _bg_task and not _bg_task.done():
        _bg_task.cancel()
        try:
            await _bg_task
        except asyncio.CancelledError:
            pass


# Dynamic title based on mode
title_map = {
    "core": "InterviewX Core AI Service",
    "video": "InterviewX Video AI Service",
    "full": "InterviewX AI Service (Unified)",
    "all": "InterviewX AI Service (Unified)",
}

app = FastAPI(
    title=title_map.get(AI_SERVICE_MODE, "InterviewX AI Service"),
    description=(
        f"FastAPI microservice running in **{AI_SERVICE_MODE}** mode.\n\n"
        "- **core mode**: SBERT text evaluation, Librosa audio analysis, multimodal fusion\n"
        "- **video mode**: YOLOv8 person detection, MediaPipe face/gaze/pose analysis\n"
    ),
    version="3.1.0",
    lifespan=lifespan,
)

# CORS -- allow configured backend microservice origins
allowed_origins_str = os.getenv("BACKEND_URL", "http://localhost:5000")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def verify_internal_service_key(request, call_next):
    """
    Ensure all /api/ai endpoints require verified internal service authentication.
    Prevents unauthorized direct access from internet/browsers.
    """
    path = request.url.path
    if path.startswith("/api/ai"):
        expected_key = os.getenv("AI_SERVICE_SECRET_KEY")
        if not expected_key:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": "SERVICE_MISCONFIGURED",
                    "message": "AI service secret key is not configured.",
                },
            )

        import hmac
        provided_key = request.headers.get("x-internal-service-key") or ""
        auth_header = request.headers.get("authorization") or ""
        if auth_header.startswith("Bearer "):
            provided_key = auth_header[7:].strip()

        if not hmac.compare_digest(provided_key, expected_key):
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": "UNAUTHORIZED_SERVICE",
                    "message": "Invalid or missing internal service key.",
                },
            )
    return await call_next(request)


# ─────────────────────────────────────────────────────────────────────────────
# ROUTER REGISTRATION PER RUNTIME MODE
# ─────────────────────────────────────────────────────────────────────────────

from app.routers import health
app.include_router(health.router)

if AI_SERVICE_MODE in ("core", "full", "all"):
    from app.routers import text_evaluation, audio_analysis, multimodal
    app.include_router(text_evaluation.router)
    app.include_router(audio_analysis.router)
    app.include_router(multimodal.router)

if AI_SERVICE_MODE in ("video", "full", "all"):
    from app.routers import video_analysis
    app.include_router(video_analysis.router)

# Explicit 404 handlers for endpoints unsupported in the current mode
if AI_SERVICE_MODE == "core":
    @app.api_route(
        "/api/ai/video-{path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        include_in_schema=False,
    )
    async def unsupported_video_endpoint(path: str):
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "ENDPOINT_NOT_SUPPORTED",
                "message": (
                    "Video analysis endpoints are not supported in Core AI service mode. "
                    "Route video requests to the InterviewX Video AI service."
                ),
                "active_mode": "core",
            },
        )

elif AI_SERVICE_MODE == "video":
    @app.api_route(
        "/api/ai/text-{path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        include_in_schema=False,
    )
    @app.api_route(
        "/api/ai/audio-{path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        include_in_schema=False,
    )
    @app.api_route(
        "/api/ai/multimodal-{path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        include_in_schema=False,
    )
    async def unsupported_core_endpoint(path: str):
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "ENDPOINT_NOT_SUPPORTED",
                "message": (
                    "Text and audio evaluation endpoints are not supported in Video AI service mode. "
                    "Route text and audio requests to the InterviewX Core AI service."
                ),
                "active_mode": "video",
            },
        )


@app.get("/")
async def root():
    endpoints = {
        "health": "/health",
        "ready": "/ready",
        "docs": "/docs",
    }
    models = {}

    if AI_SERVICE_MODE in ("core", "full", "all"):
        from app.services import sbert_service
        endpoints["text_evaluate"] = "/api/ai/text-evaluate"
        endpoints["audio_analyze"] = "/api/ai/audio-analyze"
        endpoints["multimodal_evaluate"] = "/api/ai/multimodal-evaluate"
        models["sbert"] = {
            "model": sbert_service.get_model_name(),
            "status": sbert_service.get_model_status(),
        }
        models["cnn_lstm"] = {
            "status": "not_trained",
            "note": "Librosa audio feature extraction active. No trained CNN-LSTM weights loaded.",
        }

    if AI_SERVICE_MODE in ("video", "full", "all"):
        from app.services import video_service
        endpoints["video_analyze"] = "/api/ai/video-analyze"
        endpoints["video_model_info"] = "/api/ai/video-model-info"
        models["yolo"] = {
            "model": os.getenv("YOLO_MODEL_PATH", "yolov8n.pt"),
            "status": video_service.get_yolo_status(),
        }
        models["video_models"] = video_service.get_video_model_status()

    return {
        "service": "InterviewX AI Service",
        "mode": AI_SERVICE_MODE,
        "version": "3.1.0",
        "status": "running",
        "endpoints": endpoints,
        "models": models,
    }
