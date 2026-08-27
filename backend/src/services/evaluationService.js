/**
 * Evaluation Service (Phase 4+)
 *
 * Coordinates response evaluation across modalities:
 *   Phase 4: SBERT text evaluation (real AI)
 *   Phase 5: Audio MFCC (feature extraction, dev fallback for CNN-LSTM)
 *   Phase 6: Video YOLOv8 (pretrained detection, dev for scoring)
 *   Phase 7: Multimodal fusion
 *
 * EVALUATION FORMULA (Phase 4+):
 *   textScore = 0.5 * semanticScore + 0.5 * conceptCoverage
 *   overallScore = weighted fusion of available modalities
 *     Text=50%, Audio=25%, Video=25% (redistributed if unavailable)
 */

const aiService = require('./aiService');
const { calculateWeightedScore } = require('./multimodalFusionService');

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 FALLBACK (development placeholder)
// ─────────────────────────────────────────────────────────────────────────────

const DEVELOPMENT_BASE_SCORE = 70;

const developmentEvaluate = (questionText, answerText, difficulty = 'medium') => {
  const wordCount = answerText ? answerText.trim().split(/\s+/).length : 0;

  let score = DEVELOPMENT_BASE_SCORE;
  if (wordCount > 100) score += 10;
  else if (wordCount > 50) score += 5;
  else if (wordCount < 10) score -= 15;

  const difficultyAdjustment = { easy: 5, medium: 0, hard: -5 };
  score += difficultyAdjustment[difficulty] || 0;
  score = Math.min(100, Math.max(10, score));

  return {
    score,
    status: 'development_evaluation',
    phase: 1,
    isDevelopmentEvaluation: true,
    notice: '⚠️ Development placeholder evaluation. Connect SBERT AI service for real evaluation.',
    wordCount,
    feedback: wordCount < 10
      ? 'Your answer was very brief. Try to provide more detail and examples.'
      : wordCount < 50
        ? 'Good start! Consider expanding with specific examples and technical details.'
        : wordCount < 100
          ? 'Solid response. You covered the topic reasonably well.'
          : 'Comprehensive answer! You provided good detail in your response.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — SBERT TEXT EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a text answer using SBERT.
 * Falls back to development evaluation if AI service is unavailable.
 *
 * @param {string} questionText
 * @param {string} answerText
 * @param {string[]} expectedConcepts
 * @param {string} difficulty
 * @returns {Object} textEvaluation + legacy evaluation fields
 */
const evaluateResponse = async (questionText, answerText, difficulty = 'medium', expectedConcepts = []) => {
  const wordCount = answerText ? answerText.trim().split(/\s+/).length : 0;

  // Try SBERT evaluation
  let sbertResult = null;
  try {
    sbertResult = await aiService.evaluateText(questionText, answerText, expectedConcepts);
  } catch (err) {
    console.warn('[Evaluation] SBERT call failed, using fallback:', err.message);
  }

  const sbertAvailable = sbertResult && sbertResult.modelStatus !== 'ai_service_unavailable'
    && sbertResult.modelStatus !== 'not_implemented'
    && sbertResult.textScore !== null
    && sbertResult.textScore !== undefined;

  let textEvaluation;
  let legacyEval;

  if (sbertAvailable) {
    // SBERT result is real
    textEvaluation = {
      semanticScore: sbertResult.semanticScore,
      conceptCoverage: sbertResult.conceptCoverage,
      textScore: sbertResult.textScore,
      feedback: sbertResult.feedback,
      strengths: sbertResult.strengths || [],
      missingConcepts: sbertResult.missingConcepts || [],
      improvementSuggestion: sbertResult.improvementSuggestion || null,
      confidence: sbertResult.confidence,
      modelStatus: 'sbert_evaluated',
    };
    legacyEval = {
      score: Math.round(sbertResult.textScore),
      status: 'sbert_evaluation',
      phase: 4,
      isDevelopmentEvaluation: false,
      feedback: sbertResult.feedback,
      wordCount,
    };
  } else {
    // Development fallback
    const devEval = developmentEvaluate(questionText, answerText, difficulty);
    textEvaluation = {
      semanticScore: null,
      conceptCoverage: null,
      textScore: devEval.score,
      feedback: devEval.feedback,
      strengths: [],
      missingConcepts: expectedConcepts.length > 0 ? expectedConcepts.slice(0, 3) : [],
      improvementSuggestion: null,
      confidence: null,
      modelStatus: sbertResult?.modelStatus || 'ai_service_unavailable',
    };
    legacyEval = {
      ...devEval,
      notice: sbertResult?.modelStatus === 'ai_service_unavailable'
        ? '⚠️ SBERT AI service is unavailable. Using development placeholder.'
        : devEval.notice,
    };
  }

  return { textEvaluation, evaluation: legacyEval };
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO + VIDEO EVALUATION (Phases 5-6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process audio file through AI service.
 */
const evaluateAudio = async (audioFilePath) => {
  if (!audioFilePath) {
    return {
      audioFeaturesAvailable: false,
      modelStatus: 'no_audio_submitted',
    };
  }
  return aiService.analyzeAudio(audioFilePath);
};

/**
 * Process video file through AI service.
 */
const evaluateVideo = async (videoFilePath) => {
  if (!videoFilePath) {
    return {
      framesProcessed: 0,
      modelStatus: 'no_video_submitted',
    };
  }
  return aiService.analyzeVideo(videoFilePath);
};

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE SCORES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate scores across all responses in an interview.
 *
 * @param {Array} responses - Array of Response documents
 * @returns {Object} Aggregated evaluation
 */
const aggregateInterviewScore = (responses) => {
  if (!responses || responses.length === 0) {
    return {
      overallScore: 0,
      questionsAnswered: 0,
      isDevelopmentEvaluation: true,
      status: 'no_responses',
    };
  }

  const textScores = [];
  const sbertCount = { sbert: 0, dev: 0 };

  for (const r of responses) {
    const ts = r.textEvaluation?.textScore ?? r.evaluation?.score ?? null;
    if (typeof ts === 'number') {
      textScores.push(ts);
      if (r.textEvaluation?.modelStatus === 'sbert_evaluated') sbertCount.sbert++;
      else sbertCount.dev++;
    }
  }

  const overallScore = textScores.length > 0
    ? Math.round(textScores.reduce((s, v) => s + v, 0) / textScores.length)
    : 0;

  const isDev = sbertCount.dev > sbertCount.sbert;

  return {
    overallScore,
    questionsAnswered: responses.length,
    isDevelopmentEvaluation: isDev,
    sbertEvaluated: sbertCount.sbert,
    developmentEvaluated: sbertCount.dev,
    status: isDev ? 'partially_development_evaluation' : 'sbert_evaluation',
    individualScores: textScores,
    notice: isDev
      ? `⚠️ ${sbertCount.dev} of ${responses.length} responses used development placeholder. Connect AI service for real SBERT evaluation.`
      : `✅ ${sbertCount.sbert} responses evaluated with SBERT.`,
  };
};

module.exports = {
  evaluateResponse,
  evaluateAudio,
  evaluateVideo,
  aggregateInterviewScore,
  developmentEvaluate,
};
