"""Audio analysis router — Phase 5 (MFCC + feature extraction)

Changes from previous version:
  - Do NOT raise HTTP 400 when audioFeaturesAvailable=False.  The previous
    behaviour caused the backend's aiService.js to treat the upload as a
    non-retryable 4xx error and return ai_service_unavailable — which the
    asyncJobService then logged as 'JOB_DONE' even though analysis failed.
  - Instead return HTTP 200 with audioFeaturesAvailable=false and a clear
    reason.  The backend asyncJobService now inspects this flag and marks
    the job 'failed' explicitly.
  - Handle InferenceTimeoutError → 504 with modelStatus='timed_out'.
  - Structured JSON logging at each stage.
  - Validate MIME type more leniently: browser recordings vary.
"""
import os
import time
import json
import logging
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.services import audio_service
from app.services.inference_scheduler import run_media_inference, InferenceTimeoutError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["Audio Analysis"])

# Browser recordings can arrive with various MIME types; accept generously and
# let ffmpeg/librosa determine decodability.
_ALLOWED_CONTENT_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/mp4",
    "audio/mpeg",
    "audio/aac",
    "audio/flac",
    "video/webm",  # some browsers record combined av/webm under video/* MIME
    "application/octet-stream",
}
_ALLOWED_EXTENSIONS = {".webm", ".ogg", ".wav", ".mp4", ".mp3", ".m4a", ".aac", ".flac"}


def _log(level: str, event: str, **kwargs):
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **kwargs}
    msg = json.dumps(entry, default=str)
    if level == "error":
        logger.error(msg)
    elif level == "warning":
        logger.warning(msg)
    else:
        logger.info(msg)


def _is_acceptable_audio(upload: UploadFile) -> bool:
    """Return True if MIME type or filename extension suggests an audio/video container."""
    ct = (upload.content_type or "").lower().split(";")[0].strip()
    if ct in _ALLOWED_CONTENT_TYPES:
        return True
    fn = upload.filename or ""
    ext = os.path.splitext(fn)[1].lower()
    return ext in _ALLOWED_EXTENSIONS


@router.post("/audio-analyze")
async def audio_analyze(audio: UploadFile = File(...)):
    """
    Analyze candidate audio for speech delivery indicators.

    Input: multipart/form-data with audio file (webm, wav, ogg, mp4)

    Output (success):
      audioFeaturesAvailable: true
      modelStatus: str
      speakingDuration: float (seconds)
      pauseDuration: float (seconds)
      speechRate: float or null
      mfccSummary: dict
      energyCharacteristics: dict
      pitchStatistics: dict
      speechDeliveryIndicators: dict

    Output (analysis unavailable — HTTP 200 with audioFeaturesAvailable: false):
      audioFeaturesAvailable: false
      modelStatus: 'unavailable'
      reason: str  — machine-readable failure category
    """
    req_start = time.monotonic()
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    tmp_path = None
    MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50 MB

    # Validate content type leniently — reject only clearly non-audio uploads
    if not _is_acceptable_audio(audio):
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "INVALID_AUDIO",
                "message": f"Unsupported audio format: content_type={audio.content_type!r} filename={audio.filename!r}",
                "modelStatus": "invalid_format",
                "audioFeaturesAvailable": False,
            },
        )

    try:
        # ── Save upload ──────────────────────────────────────────────────────
        save_start = time.monotonic()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            total_bytes = 0
            CHUNK_SIZE = 1024 * 1024
            while chunk := await audio.read(CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > MAX_AUDIO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail={
                            "success": False,
                            "error": "FILE_TOO_LARGE",
                            "message": "Audio exceeds 50 MB limit.",
                            "modelStatus": "file_too_large",
                            "audioFeaturesAvailable": False,
                        },
                    )
                tmp.write(chunk)

        save_seconds = time.monotonic() - save_start

        if total_bytes == 0:
            # Return 200 with audioFeaturesAvailable=false rather than raising an exception.
            # This keeps the backend asyncJobService on the success path so it can persist
            # the unavailable result and NOT retry, instead of treating a 4xx as a hard error.
            _log("warning", "audio_empty_file", suffix=suffix)
            return {
                "success": True,
                "data": {
                    "audioFeaturesAvailable": False,
                    "modelStatus": "unavailable",
                    "reason": "empty_file",
                    "speechScore": None,
                },
            }

        _log(
            "info",
            "audio_upload_saved",
            bytes=total_bytes,
            save_seconds=round(save_seconds, 2),
            suffix=suffix,
        )

        # ── Run feature extraction (off event loop, with timeout) ─────────────
        result = await run_media_inference("audio", audio_service.extract_features, tmp_path)

        total_seconds = time.monotonic() - req_start
        features_available = result.get("audioFeaturesAvailable", False)
        model_status = result.get("modelStatus", "unknown")

        _log(
            "info",
            "audio_analyze_done",
            total_seconds=round(total_seconds, 2),
            save_seconds=round(save_seconds, 2),
            features_available=features_available,
            model_status=model_status,
            bytes=total_bytes,
        )

        # Return 200 regardless — the backend decides whether to mark the job failed
        # by inspecting audioFeaturesAvailable in the response body.
        return {"success": True, "data": result}

    except HTTPException:
        raise

    except InferenceTimeoutError as te:
        total_seconds = time.monotonic() - req_start
        _log("error", "audio_analyze_timeout", total_seconds=round(total_seconds, 2), error=str(te))
        return JSONResponse(
            status_code=504,
            content={
                "success": False,
                "error": "INFERENCE_TIMEOUT",
                "message": str(te),
                "modelStatus": "timed_out",
                "audioFeaturesAvailable": False,
            },
        )

    except Exception as e:
        total_seconds = time.monotonic() - req_start
        _log("error", "audio_analyze_error", total_seconds=round(total_seconds, 2), error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "AUDIO_ERROR",
                "message": str(e),
                "modelStatus": "analysis_failed",
                "audioFeaturesAvailable": False,
            },
        )

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as unlink_err:
                logger.warning("[AudioRequest] Failed to remove temp file %s: %s", tmp_path, unlink_err)
