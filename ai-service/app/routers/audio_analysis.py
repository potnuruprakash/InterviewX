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

    # Save to temp file
    suffix = os.path.splitext(audio.filename or "audio.webm")[-1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        result = audio_service.extract_features(tmp_path)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "error": "AUDIO_ERROR", "message": str(e)})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
