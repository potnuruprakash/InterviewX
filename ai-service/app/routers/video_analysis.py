"""Video analysis router — Phase 6 (YOLOv8 + MediaPipe)

Changes from previous version:
  - Handle InferenceTimeoutError separately → 504 with modelStatus='timed_out'.
  - Distinguish frame_extraction_failed from timed_out so the backend queue
    can mark the job 'failed' with a specific reason rather than the generic
    ai_service_unavailable fallback.
  - Log structured timing info at each stage for Render log diagnostics.
  - Return framesProcessed=0 explicitly when no frames were analyzed so the
    backend never confuses a 0-frame result with "not submitted".
"""
import os
import time
import json
import logging
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.services import video_service
from app.services.inference_scheduler import run_media_inference, InferenceTimeoutError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["Video Analysis"])


def _log(level: str, event: str, **kwargs):
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **kwargs}
    msg = json.dumps(entry, default=str)
    if level == "error":
        logger.error(msg)
    elif level == "warning":
        logger.warning(msg)
    else:
        logger.info(msg)


@router.post("/video-analyze")
async def video_analyze(video: UploadFile = File(...)):
    """
    Analyze candidate video using YOLOv8 + MediaPipe.

    Input: multipart/form-data with video file (webm, mp4, ogg)

    Output:
      framesProcessed: int   — frames actually analyzed (0 if extraction failed)
      personDetectedFrames: int
      personDetectionRatio: float (0-1)
      faceVisibilityRatio: float (0-1)
      gazeAttentionRatio: float or null
      postureScore: float or null
      shoulderTiltDegrees: float or null
      cameraEngagement: str
      videoQualityIndicator: str (good/fair/poor)
      modelStatus: str
      processingConfidence: float or null
    """
    request_start = time.monotonic()
    suffix = os.path.splitext(video.filename or "video.webm")[-1] or ".webm"
    tmp_path = None
    MAX_VIDEO_SIZE = int(os.getenv("MAX_VIDEO_SIZE_BYTES", str(100 * 1024 * 1024)))  # 100 MB
    CHUNK_SIZE = 1024 * 1024  # 1 MB chunks

    # Return 503 while the pipeline is still warming up so the backend can retry
    if video_service.is_loading():
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "MODEL_WARMING_UP",
                "message": "Video analysis pipeline is still loading. Please retry in a few seconds.",
                "modelStatus": "loading",
                "retryAfterSeconds": 15,
            },
        )

    try:
        # ── Save upload to temp file ─────────────────────────────────────────
        save_start = time.monotonic()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            total_bytes = 0
            while chunk := await video.read(CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > MAX_VIDEO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail={
                            "success": False,
                            "error": "FILE_TOO_LARGE",
                            "message": "Video exceeds 100 MB limit.",
                            "modelStatus": "file_too_large",
                        },
                    )
                tmp.write(chunk)

        save_seconds = time.monotonic() - save_start

        if total_bytes == 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "error": "EMPTY_VIDEO",
                    "message": "Uploaded video file is empty.",
                    "modelStatus": "empty_file",
                    "framesProcessed": 0,
                },
            )

        _log(
            "info",
            "video_upload_saved",
            bytes=total_bytes,
            save_seconds=round(save_seconds, 2),
            suffix=suffix,
        )

        # ── Run inference (off event loop, with timeout) ──────────────────────
        result = await run_media_inference("video", video_service.analyze_video, tmp_path)

        total_seconds = time.monotonic() - request_start
        frames_processed = result.get("framesProcessed", 0)
        model_status = result.get("modelStatus", "unknown")

        _log(
            "info",
            "video_analyze_done",
            total_seconds=round(total_seconds, 2),
            save_seconds=round(save_seconds, 2),
            frames_processed=frames_processed,
            model_status=model_status,
            bytes=total_bytes,
        )

        # Frame extraction succeeded but zero frames decoded — treat as failure
        # so the backend queue marks the job 'failed' rather than 'completed' with 0 frames.
        if model_status == "frame_extraction_failed" or frames_processed == 0:
            return JSONResponse(
                status_code=422,
                content={
                    "success": False,
                    "error": "FRAME_EXTRACTION_FAILED",
                    "message": result.get(
                        "note",
                        "Could not decode video frames. The codec or container may be unsupported.",
                    ),
                    "modelStatus": "frame_extraction_failed",
                    "framesProcessed": 0,
                    "data": result,
                },
            )

        return {"success": True, "data": result}

    except HTTPException:
        raise

    except InferenceTimeoutError as te:
        total_seconds = time.monotonic() - request_start
        _log(
            "error",
            "video_analyze_timeout",
            total_seconds=round(total_seconds, 2),
            error=str(te),
        )
        return JSONResponse(
            status_code=504,
            content={
                "success": False,
                "error": "INFERENCE_TIMEOUT",
                "message": str(te),
                "modelStatus": "timed_out",
                "framesProcessed": 0,
            },
        )

    except Exception as e:
        total_seconds = time.monotonic() - request_start
        _log("error", "video_analyze_error", total_seconds=round(total_seconds, 2), error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "VIDEO_ERROR",
                "message": str(e),
                "modelStatus": "analysis_failed",
                "framesProcessed": 0,
            },
        )

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
