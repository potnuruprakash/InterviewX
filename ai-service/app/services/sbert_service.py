"""
SBERT Service — Phase 4 Text Evaluation

Uses the pretrained sentence-transformers model 'all-MiniLM-L6-v2' for semantic similarity.
Model is loaded ONCE at startup and reused for all requests.

Scoring Formula:
  semanticScore    = cosine_similarity(question_embedding, answer_embedding) * 100
  conceptCoverage  = avg(max(cosine_sim(answer, concept)) for concept in expectedConcepts) * 100
  textScore        = 0.5 * semanticScore + 0.5 * conceptCoverage

References:
  - Reimers & Gurevych (2019). Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.
  - all-MiniLM-L6-v2: 6-layer MiniLM optimized for semantic similarity tasks.
"""

import os
import logging
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING (singleton — loaded once at startup)
# ─────────────────────────────────────────────────────────────────────────────

_model = None
_model_name = os.getenv("SBERT_MODEL_NAME", "all-MiniLM-L6-v2")
_model_status = "not_loaded"


def load_model():
    """Load the SBERT model. Called once at startup."""
    global _model, _model_status
    if _model is not None:
        return

    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"[SBERT] Loading model: {_model_name}")
        _model = SentenceTransformer(_model_name)
        _model_status = "loaded"
        logger.info(f"[SBERT] Model loaded successfully: {_model_name}")
    except ImportError:
        _model_status = "sentence_transformers_not_installed"
        logger.warning("[SBERT] sentence-transformers not installed.")
    except Exception as e:
        _model_status = f"load_error: {str(e)}"
        logger.error(f"[SBERT] Model load failed: {e}")


def get_model_status() -> str:
    return _model_status


def get_model_name() -> str:
    return _model_name


# ─────────────────────────────────────────────────────────────────────────────
# COSINE SIMILARITY
# ─────────────────────────────────────────────────────────────────────────────

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


# ─────────────────────────────────────────────────────────────────────────────
# CORE EVALUATION
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_text(
    question: str,
    answer: str,
    expected_concepts: List[str],
) -> dict:
    """
    Evaluate a candidate answer using SBERT.

    Returns dict with:
      semanticScore     : 0-100, cosine similarity of answer vs question
      conceptCoverage   : 0-100, how well answer covers expected concepts
      textScore         : 0-100, combined score
      feedback          : string feedback
      strengths         : list of covered concepts
      missingConcepts   : list of uncovered concepts
      improvementSuggestion : string
      confidence        : 0-1, reliability indicator
      modelStatus       : string
    """
    if _model is None:
        return _fallback_result(
            "Model not loaded. Start AI service to load SBERT.",
            _model_status,
        )

    if not answer or len(answer.strip()) < 5:
        return {
            "semanticScore": 0.0,
            "conceptCoverage": 0.0,
            "textScore": 0.0,
            "feedback": "No substantive answer was provided.",
            "strengths": [],
            "missingConcepts": expected_concepts[:5],
            "improvementSuggestion": "Please provide a detailed answer.",
            "confidence": 1.0,
            "modelStatus": "sbert_evaluated",
        }

    try:
        # Encode question and answer
        q_emb = _model.encode(question, convert_to_numpy=True)
        a_emb = _model.encode(answer, convert_to_numpy=True)

        # Semantic score: how relevant is the answer to the question
        raw_sim = cosine_similarity(q_emb, a_emb)
        # Normalize: cosine similarity is [-1, 1], but for sentences typically [0.2, 0.95]
        # We scale from practical range [0.0, 0.95] → [0, 100]
        semantic_score = min(100.0, max(0.0, raw_sim * 115))

        # Concept coverage
        covered_concepts = []
        missing_concepts = []
        concept_score = 0.0

        if expected_concepts:
            concept_embs = _model.encode(expected_concepts, convert_to_numpy=True)
            for i, concept in enumerate(expected_concepts):
                sim = cosine_similarity(a_emb, concept_embs[i])
                if sim >= 0.35:  # threshold for concept coverage
                    covered_concepts.append(concept)
                else:
                    missing_concepts.append(concept)
            concept_score = (len(covered_concepts) / len(expected_concepts)) * 100
        else:
            concept_score = semantic_score  # fall back to semantic score

        # Combined text score (formula documented in module docstring)
        text_score = round(0.5 * semantic_score + 0.5 * concept_score, 1)

        # Confidence: higher with more answer content
        word_count = len(answer.split())
        confidence = min(1.0, word_count / 100)

        # Generate structured feedback
        feedback = _generate_feedback(text_score, semantic_score, concept_score, covered_concepts, missing_concepts)
        improvement = _generate_improvement(missing_concepts)

        return {
            "semanticScore": round(semantic_score, 1),
            "conceptCoverage": round(concept_score, 1),
            "textScore": text_score,
            "feedback": feedback,
            "strengths": covered_concepts,
            "missingConcepts": missing_concepts,
            "improvementSuggestion": improvement,
            "confidence": round(confidence, 2),
            "modelStatus": "sbert_evaluated",
        }

    except Exception as e:
        logger.error(f"[SBERT] Evaluation error: {e}")
        return _fallback_result(f"Evaluation error: {str(e)}", "evaluation_error")


def _generate_feedback(text_score: float, semantic_score: float, concept_score: float,
                        covered: List[str], missing: List[str]) -> str:
    parts = []

    if semantic_score >= 70:
        parts.append("The answer is well-aligned with the question.")
    elif semantic_score >= 45:
        parts.append("The answer is partially relevant to the question.")
    else:
        parts.append("The answer could be more directly relevant to the question.")

    if covered:
        parts.append(f"Covered concepts: {', '.join(covered[:3])}.")
    if missing:
        parts.append(f"Concepts not clearly addressed: {', '.join(missing[:3])}.")

    return " ".join(parts)


def _generate_improvement(missing_concepts: List[str]) -> Optional[str]:
    if not missing_concepts:
        return "Strong answer. Consider adding concrete examples to further strengthen your response."
    return f"Expand your answer to address: {', '.join(missing_concepts[:3])}."


def _fallback_result(message: str, status: str) -> dict:
    return {
        "semanticScore": None,
        "conceptCoverage": None,
        "textScore": None,
        "feedback": message,
        "strengths": [],
        "missingConcepts": [],
        "improvementSuggestion": None,
        "confidence": None,
        "modelStatus": status,
    }
