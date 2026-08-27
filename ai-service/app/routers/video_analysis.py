"""Video analysis router — Phase 6 (YOLOv8 pretrained)"""
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services import video_service

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
    suffix = os.path.splitext(video.filename or "video.webm")[-1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await video.read()
            if len(content) == 0:
                raise HTTPException(status_code=400, detail={"success": False, "error": "EMPTY_VIDEO", "message": "Video file is empty."})
            tmp.write(content)
            tmp_path = tmp.name

        result = video_service.analyze_video(tmp_path)
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "error": "VIDEO_ERROR", "message": str(e)})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
