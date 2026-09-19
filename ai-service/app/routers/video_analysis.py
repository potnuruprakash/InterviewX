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
    MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100 MB limit
    CHUNK_SIZE = 1024 * 1024  # 1 MB chunk

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



@router.get("/video-model-info")
async def video_model_info():
    """
    Returns empirical model performance, verified dataset audit,
    and capability specifications for the Video Analysis pipeline.
    """
    audit = video_service.get_model_audit_report()
    return {"success": True, "data": audit}

