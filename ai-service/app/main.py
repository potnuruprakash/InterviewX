"""
Main FastAPI application — InterviewX AI Service

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
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.routers import health
from app.routers import text_evaluation, audio_analysis, video_analysis, multimodal
from app.services import sbert_service, video_service

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models at startup — once, not per request."""
    logger.info("[Startup] Loading AI models...")

    # Load SBERT
    sbert_service.load_model()
    logger.info(f"[Startup] SBERT status: {sbert_service.get_model_status()}")

    # Load YOLOv8
    video_service.load_yolo_model()
    logger.info(f"[Startup] YOLO status: {video_service.get_yolo_status()}")

    logger.info("[Startup] AI models initialization complete.")
    yield
    logger.info("[Shutdown] AI service shutting down.")


app = FastAPI(
    title="InterviewX AI Service",
    description=(
        "Python FastAPI microservice for AI/ML analysis.\n\n"
        "**Phase 4**: SBERT semantic text evaluation\n"
        "**Phase 5**: Audio MFCC feature analysis\n"
        "**Phase 6**: YOLOv8 video frame analysis\n"
        "**Phase 7**: Multimodal fusion\n\n"
        "**Note**: CNN-LSTM audio model is not trained — returns feature data only.\n"
        "YOLOv8 uses pretrained COCO weights for person detection."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

# CORS — allow backend service and localhost
allowed_origins_str = os.getenv("BACKEND_URL", "http://localhost:5000")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",")]
allowed_origins.append("http://localhost:5173")  # frontend dev server

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            "sbert": {
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
