"""Text evaluation router — Phase 4 (SBERT)"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from app.schemas.schemas import TextEvaluationRequest
from app.services import sbert_service

router = APIRouter(prefix="/api/ai", tags=["Text Evaluation"])


@router.post("/text-evaluate")
async def text_evaluate(request: TextEvaluationRequest):
    """
    Evaluate a candidate's text answer using SBERT semantic similarity.

    Input:
      question: str
      answer: str
      expectedConcepts: List[str]

    Output:
      semanticScore: 0-100 (cosine similarity of answer vs question)
      conceptCoverage: 0-100 (coverage of expected concepts)
      textScore: 0-100 (combined: 0.5*semantic + 0.5*concept)
      feedback: str
      strengths: List[str]
      missingConcepts: List[str]
      improvementSuggestion: str
      confidence: 0-1
      modelStatus: str
    """
    # Return 503 while the model is warming up so callers can retry
    if sbert_service.is_loading():
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "MODEL_WARMING_UP",
                "message": "SBERT model is still loading. Please retry in a few seconds.",
                "modelStatus": sbert_service.get_model_status(),
            },
        )

    try:
        # Lazy-load SBERT on demand instead of consuming startup memory.
        if sbert_service.get_model_status() == "not_loaded":
            sbert_service.load_model()

        if sbert_service.get_model_status() != "loaded":
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "error": "MODEL_UNAVAILABLE",
                    "message": "SBERT model is not available yet. Please retry.",
                    "modelStatus": sbert_service.get_model_status(),
                },
            )

        result = sbert_service.evaluate_text(
            question=request.question,
            answer=request.answer,
            expected_concepts=request.expectedConcepts,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "error": "EVALUATION_ERROR", "message": str(e)})

