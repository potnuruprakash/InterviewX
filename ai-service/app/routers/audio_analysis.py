"""Audio analysis router — Phase 5 (MFCC + feature extraction)"""
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services import audio_service

router = APIRouter(prefix="/api/ai", tags=["Audio Analysis"])


@router.post("/audio-analyze")
async def audio_analyze(audio: UploadFile = File(...)):
    """
    Analyze candidate audio for speech delivery indicators.

    Input: multipart/form-data with audio file (webm, wav, ogg, mp4)

    Output:
      audioFeaturesAvailable: bool
      modelStatus: str (CNN-LSTM status — "not_trained" if no weights)
      speechScore: null (not fabricated if model not trained)
      speakingDuration: float (seconds)
      pauseDuration: float (seconds)
      speechRate: float (syllables/sec estimate)
      mfccSummary: dict
      energyCharacteristics: dict
      pitchStatistics: dict
      speechDeliveryIndicators: dict
    """
    # Validate file type
    allowed = ["audio/webm", "audio/ogg", "audio/wav", "audio/mp4", "audio/mpeg", "application/octet-stream"]
    if audio.content_type and audio.content_type not in allowed:
        if not audio.filename or not any(audio.filename.endswith(ext) for ext in [".webm", ".ogg", ".wav", ".mp4", ".mp3"]):
            raise HTTPException(status_code=400, detail={"success": False, "error": "INVALID_AUDIO", "message": "Unsupported audio format."})

    # Save to temp file using chunked streaming
    suffix = os.path.splitext(audio.filename or "audio.webm")[-1] or ".webm"
    tmp_path = None
    MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50 MB limit
    CHUNK_SIZE = 1024 * 1024  # 1 MB chunk

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            total_bytes = 0
            while chunk := await audio.read(CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > MAX_AUDIO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail={"success": False, "error": "FILE_TOO_LARGE", "message": "Audio exceeds 50MB limit."},
                    )
                tmp.write(chunk)

            if total_bytes == 0:
                raise HTTPException(
                    status_code=400,
                    detail={"success": False, "error": "EMPTY_AUDIO", "message": "Audio file is empty."},
                )

        result = audio_service.extract_features(tmp_path)
        if not result.get("audioFeaturesAvailable", True):
            raise HTTPException(
                status_code=400,
                detail={"success": False, "error": "CORRUPTED_AUDIO", "message": result.get("reason", "Could not process audio.")},
            )
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "error": "AUDIO_ERROR", "message": str(e)})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

