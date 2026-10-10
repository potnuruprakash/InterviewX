"""Video analysis router — Phase 6 (YOLOv8 pretrained)"""
import os
import time
import logging
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.services import video_service
from app.services.inference_scheduler import run_media_inference

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["Video Analysis"])


@router.post("/video-analyze")
async def video_analyze(video: UploadFile = File(...)):
    """
    Analyze candidate video using YOLOv8 for person detection.

    Input: multipart/form-data with video file (webm, mp4, ogg)

    Output:
      framesProcessed: int
      personDetectedFrames: int
      personDetectionRatio: float (0-1)
      videoQualityIndicator: str (good/fair/poor)
      modelStatus: str
      processingConfidence: float (avg YOLO detection confidence)
      note: str (no psychological inferences)
    """
    request_start = time.monotonic()
    suffix = os.path.splitext(video.filename or "video.webm")[-1] or ".webm"
    tmp_path = None
    MAX_VIDEO_SIZE = int(os.getenv("MAX_VIDEO_SIZE_BYTES", str(100 * 1024 * 1024)))  # 100 MB limit
    CHUNK_SIZE = 1024 * 1024  # 1 MB chunk

    # Return 503 while the pipeline is still warming up
    if video_service.is_loading():
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "MODEL_WARMING_UP",
                "message": "Video analysis pipeline is still loading. Please retry in a few seconds.",
                "modelStatus": video_service.get_yolo_status(),
            },
        )

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            total_bytes = 0
            while chunk := await video.read(CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > MAX_VIDEO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail={"success": False, "error": "FILE_TOO_LARGE", "message": "Video exceeds 100MB limit."},
                    )
                tmp.write(chunk)

            if total_bytes == 0:
                raise HTTPException(
                    status_code=400,
                    detail={"success": False, "error": "EMPTY_VIDEO", "message": "Video file is empty."},
                )

        logger.info("[VideoRequest] Saved upload to %s (%d bytes)", tmp_path, total_bytes)
        result = await run_media_inference("video", video_service.analyze_video, tmp_path)
        total_seconds = time.monotonic() - request_start
        logger.info(
            "[VideoRequest] COMPLETED in %.2fs. framesProcessed=%s modelStatus=%s",
            total_seconds,
            result.get("framesProcessed", 0),
            result.get("modelStatus", "unknown"),
        )
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        total_seconds = time.monotonic() - request_start
        logger.error("[VideoRequest] FAILED after %.2fs: %s", total_seconds, e)
        raise HTTPException(status_code=500, detail={"success": False, "error": "VIDEO_ERROR", "message": str(e)})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as unlink_err:
                logger.warning("[VideoRequest] Failed to remove temp file %s: %s", tmp_path, unlink_err)



@router.get("/video-model-info")
async def video_model_info():
    """
    Returns empirical model performance, verified dataset audit,
    and capability specifications for the Video Analysis pipeline.
    """
    if video_service.is_loading():
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "MODEL_WARMING_UP",
                "message": "Video pipeline is still loading. Please retry in a few seconds.",
                "modelStatus": video_service.get_yolo_status(),
            },
        )
    audit = video_service.get_model_audit_report()
    return {"success": True, "data": audit}

