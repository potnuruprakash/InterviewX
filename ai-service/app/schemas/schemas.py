"""
Pydantic schemas for AI service request/response validation.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Any


# ─────────────────────────────────────────────────────────────────────────────
# TEXT EVALUATION
# ─────────────────────────────────────────────────────────────────────────────

class TextEvaluationRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=2000)
    answer: str = Field(..., max_length=10000)
    expectedConcepts: List[str] = Field(default_factory=list)


class TextEvaluationResponse(BaseModel):
    success: bool
    data: dict


# ─────────────────────────────────────────────────────────────────────────────
# MULTIMODAL EVALUATION
# ─────────────────────────────────────────────────────────────────────────────

class MultimodalRequest(BaseModel):
    textScore: Optional[float] = None
    audioResult: Optional[dict] = None
    videoResult: Optional[dict] = None


class MultimodalResponse(BaseModel):
    success: bool
    data: dict


# ─────────────────────────────────────────────────────────────────────────────
# GENERIC SUCCESS / ERROR
# ─────────────────────────────────────────────────────────────────────────────

class SuccessResponse(BaseModel):
    success: bool = True
    data: Any = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    message: str
