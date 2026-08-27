"""Multimodal fusion router — Phase 7"""
from fastapi import APIRouter, HTTPException
from app.schemas.schemas import MultimodalRequest

router = APIRouter(prefix="/api/ai", tags=["Multimodal Fusion"])

DEFAULT_WEIGHTS = {"text": 0.5, "audio": 0.25, "video": 0.25}


@router.post("/multimodal-evaluate")
async def multimodal_evaluate(request: MultimodalRequest):
    """
    Combine text, audio, and video scores into a weighted overall score.
    Only uses modalities with valid scores — never fabricates missing scores.

    Formula:
      overallScore = sum(score * weight) / sum(available_weights)
    """
    try:
        available = {}
        if request.textScore is not None:
            available["text"] = request.textScore
        if request.audioResult and request.audioResult.get("speechScore") is not None:
            available["audio"] = request.audioResult["speechScore"]
        if request.videoResult and request.videoResult.get("videoScore") is not None:
            available["video"] = request.videoResult["videoScore"]

        if not available:
            return {
                "success": True,
                "data": {
                    "overallScore": None,
                    "modalitiesUsed": [],
                    "scoringNote": "No modality scores available for fusion.",
                }
            }

        total_weight = sum(DEFAULT_WEIGHTS.get(m, 0) for m in available)
        weighted_sum = sum(score * DEFAULT_WEIGHTS.get(m, 0) for m, score in available.items())
        overall = round(weighted_sum / total_weight, 1) if total_weight > 0 else None

        missing = [m for m in DEFAULT_WEIGHTS if m not in available]
        note = f"Score from: {', '.join(available.keys())}."
        if missing:
            note += f" Not available: {', '.join(missing)}."

        return {
            "success": True,
            "data": {
                "overallScore": overall,
                "modalitiesUsed": list(available.keys()),
                "scoringNote": note,
                "weights": {m: DEFAULT_WEIGHTS[m] for m in available},
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "error": "FUSION_ERROR", "message": str(e)})
