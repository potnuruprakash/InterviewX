"""
Main FastAPI application   InterviewX AI Service

Phase 4: SBERT text evaluation
Phase 5: Audio MFCC analysis
Phase 6: YOLOv8 video analysis
Phase 7: Multimodal fusion
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.routers import health
from app.routers import text_evaluation, audio_analysis, video_analysis, multimodal
from app.services import sbert_service, video_service

load_dotenv()


async def _load_models_background():
    """
    Load all heavy AI models in the background after the HTTP server has started.

    Each model is loaded in a thread-pool executor so the blocking C-extension
    code (Torch / Transformers / Ultralytics) never stalls the asyncio event loop.
    Uvicorn has already bound $PORT and is accepting connections by the time this
    coroutine runs, so Render's port-scan succeeds immediately.
    """
    loop = asyncio.get_event_loop()

    # ‖ Phase 4: SBERT
    logger.info("[Startup] Background task: loading SBERT model ...")
    try:
        await loop.run_in_executor(None, sbert_service.load_model)
        logger.info(f"[Startup] SBERT ready -- status: {sbert_service.get_model_status()}")
    except Exception as exc:
        logger.error(f"[Startup] SBERT load error: {exc}")

    # ₆ Phase 6: YOLOv8 + Video Pipeline
    logger.info("[Startup] Background task: loading YOLOv8 / video pipeline ...")
    try:
        await loop.run_in_executor(None, video_service.load_yolo_model)
        logger.info(f"[Startup] YOLO ready -- status: {video_service.get_yolo_status()}")
    except Exception as exc:
        logger.error(f"[Startup] YOLO load error: {exc}")

    logger.info("[Startup] All AI models initialised. Service fully operational.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler.

    KEY BEHAVIOUR:
      * asyncio.create_task() is called BEFORE yield so the background model-
        load task is scheduled immediately, but it only starts running once
        the event loop iterates -- i.e. AFTER Uvicorn finishes binding the port.
      * yield returns control to Uvicorn, which binds $PORT and answers
        Render's health-check probe within seconds.
      * Heavy AI libraries (Torch / Transformers / Ultralytics) run in a
        thread-pool executor so they never block the async event loop.
    """
    logger.info("[Startup] InterviewX AI Service starting -- binding port now.")
    logger.info("[Startup] AI model loading will begin in background after server is ready.")

    # Schedule background loading.  The task won't actually start until the
    # first await point after yield hands control back to the event loop.
    _bg_task = asyncio.create_task(_load_models_background())

    yield  # Uvicorn binds $PORT and starts serving here

    # Shutdown
    logger.info("[Shutdown] AI service shutting down.")
    if not _bg_task.done():
        _bg_task.cancel()
        try:
            await _bg_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="InterviewX AI Service",
    description=(
        "Python FastAPI microservice for AI/ML analysis.\n\n"
        "**Phase 4**: SBERT semantic text evaluation\n"
        "**Phase 5**: Audio MFCC feature analysis\n"
        "**Phase 6**: YOLOv8 video frame analysis\n"
        "**Phase 7**: Multimodal fusion\n\n"
        "**Note**: CNN-LSTM audio model is not trained -- returns feature data only.\n"
        "YOLOv8 uses pretrained COCO weights for person detection."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

# CORS -- allow only backend microservice
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
            from fastapi.responses import JSONResponse
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
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": "UNAUTHORIZED_SERVICE",
                    "message": "Invalid or missing internal service key.",
                },
            )
    return await call_next(request)


# Routers
app.include_router(health.router)
app.include_router(text_evaluation.router)
app.include_router(audio_analysis.router)
app.include_router(video_analysis.router)
app.include_router(multimodal.router)


@app.get("/")
async def root():
    return {
        "service": "InterviewX AI Service",
        "version": "3.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "text_evaluate": "/api/ai/text-evaluate",
            "audio_analyze": "/api/ai/audio-analyze",
            "video_analyze": "/api/ai/video-analyze",
            "multimodal_evaluate": "/api/ai/multimodal-evaluate",
            "docs": "/docs",
        },
        "models": {
            "sbert":{
                "model": sbert_service.get_model_name(),
                "status": sbert_service.get_model_status(),
            },
            "yolo": {
                "model": os.getenv("YOLO_MODEL_PATH", "yolov8n.pt"),
                "status": video_service.get_yolo_status(),
            },
            "cnn_lstm": {
                "status": "not_trained",
                "note": "CNN-LSTM model interface available. No trained weights loaded.",
            },
        },
    }
