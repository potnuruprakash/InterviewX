"""Text evaluation router — Phase 4 (SBERT)"""
from fastapi import APIRouter, HTTPException
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
    try:
        result = sbert_service.evaluate_text(
            question=request.question,
            answer=request.answer,
            expected_concepts=request.expectedConcepts,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "error": "EVALUATION_ERROR", "message": str(e)})
