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
// 5-DIMENSION EVALUATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives structured 5-dimension scores from text evaluation.
 * Dimensions: correctness, completeness, technicalDepth, reasoning, relevance
 */
/**
 * Detect responses that contain too little substance to support a normal
 * technical evaluation. Short but relevant technical answers are still evaluated.
 */
const detectNonSubstantiveAnswer = (answerText, semanticScore = null, conceptCoverage = null, expectedConcepts = []) => {
  const normalized = String(answerText || '').trim().toLowerCase();
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;

  if (!normalized) return { isNonSubstantive: true, reason: 'empty_answer' };

  const nonAnswerPhrases = [
    'i dont know',
    "i don't know",
    'not sure',
    'no idea',
    'i have no idea',
    'cannot answer',
    "can't answer",
    'skip',
    'no answer',
    'nothing',
    'pass',
  ];
  if (nonAnswerPhrases.includes(normalized)) {
    return { isNonSubstantive: true, reason: 'non_answer_phrase' };
  }

  const hasExpectedConcept = expectedConcepts.some((concept) => {
    const value = String(concept || '').trim().toLowerCase();
    return value && normalized.includes(value);
  });

  // A short answer can still be valid when it contains clear technical or
  // professional substance (for example, "Java developer with Spring Boot").
  const substantiveIndicators = [
    /\\b(?:java|python|javascript|typescript|react|node(?:\\.js)?|spring|spring boot|sql|mongodb|docker|kubernetes|aws|azure|gcp|api|rest|git|linux|html|css|c\\+\\+|c#|\.net|backend|frontend|full[- ]?stack|software engineer|developer|programmer|intern|experience|project|projects|application|system|service|database|microservices?|testing|deployment|cloud|architecture|algorithm|data structure|skills?|team|role|work(?:ed|ing)?|built|developed|designed|implemented|created|managed|led)\\b/i,
    /\\b(?:i|i'm|im|my|we|our|he|she|they)\\b/i,
    /\\b(?:am|is|are|was|were|have|has|had|worked|built|developed|designed|implemented|used|use|using|enjoy|enjoyed|learned|learning)\\b/i,
    /\\d+(?:\\.\\d+)?\\s*(?:years?|months?|projects?)?/i,
  ].some((pattern) => pattern.test(normalized));

  // Reject disconnected keyword fragments such as "name workout enjoy".
  // This is intentionally independent of SBERT because semantic similarity
  // can assign non-zero scores to arbitrary short word lists.
  const hasSentenceStructure =
    /[.!?,;:]/.test(normalized) ||
    /\\b(?:i|i'm|im|my|we|our|he|she|they)\\b/i.test(normalized);

  if (!hasExpectedConcept && wordCount <= 7 && !substantiveIndicators && !hasSentenceStructure) {
    return { isNonSubstantive: true, reason: 'keyword_fragment' };
  }

  if (wordCount <= 2 && !hasExpectedConcept && !substantiveIndicators) {
    return { isNonSubstantive: true, reason: 'too_short' };
  }

  if (
    wordCount <= 7 &&
    !hasExpectedConcept &&
    !substantiveIndicators &&
    typeof semanticScore === 'number' &&
    semanticScore < 25 &&
    (typeof conceptCoverage !== 'number' || conceptCoverage <= 0)
  ) {
    return { isNonSubstantive: true, reason: 'insufficient_relevance' };
  }

  return { isNonSubstantive: false, reason: null };
};
const buildFiveDimensionEvaluation = (questionText, answerText, baseScore, expectedConcepts = [], sbertResult = null) => {
  const words = answerText ? answerText.trim().split(/\s+/) : [];
  const wordCount = words.length;

  const conceptCoverage = sbertResult?.conceptCoverage ?? (
    expectedConcepts.length > 0
      ? expectedConcepts.filter(c => answerText.toLowerCase().includes(c.toLowerCase())).length / expectedConcepts.length
      : Math.min(1, wordCount / 40)
  );

  const semanticScore = sbertResult?.semanticScore ?? (baseScore / 100);

  // 1. Correctness: how factually aligned the response is
  const correctness = Math.min(100, Math.max(10, Math.round(
    (semanticScore * 0.7 + conceptCoverage * 0.3) * 100
  )));

  // 2. Completeness: coverage of expected concepts and length
  const lengthFactor = Math.min(1.0, wordCount / 50);
  const completeness = Math.min(100, Math.max(10, Math.round(
    (conceptCoverage * 0.6 + lengthFactor * 0.4) * 100
  )));

  // 3. Technical Depth: presence of technical terminology, code, or detailed concepts
  const hasCodeOrTechnicalTokens = /def |class |function |const |let |var |import |return |SELECT |WHERE |JOIN |docker |api |async |await |promise |thread |process/i.test(answerText);
  let technicalDepth = Math.round(correctness * 0.8 + (hasCodeOrTechnicalTokens ? 15 : 0) + (wordCount > 30 ? 10 : 0));
  technicalDepth = Math.min(100, Math.max(10, technicalDepth));

  // 4. Reasoning: explanation markers (because, therefore, since, trade-off, whereas, for example)
  const reasoningMarkers = (answerText.match(/because|therefore|since|trade-off|whereas|for example|leads to|results in|however/gi) || []).length;
  let reasoning = Math.round(baseScore * 0.85 + Math.min(15, reasoningMarkers * 4));
  reasoning = Math.min(100, Math.max(10, reasoning));

  // 5. Relevance: how directly the response addresses the prompt
  let relevance = Math.round(semanticScore * 90 + 10);
  if (wordCount < 5) relevance = Math.max(10, relevance - 30);
  relevance = Math.min(100, Math.max(10, relevance));

  // Overall normalized score
  const overallScore = Math.round(
    correctness * 0.30 +
    completeness * 0.20 +
    technicalDepth * 0.20 +
    reasoning * 0.15 +
    relevance * 0.15
  );

  const strengths = [];
  const weaknesses = [];

  if (correctness >= 80) strengths.push('Strong core conceptual accuracy');
  if (technicalDepth >= 80) strengths.push('Good technical depth and terminology');
  if (completeness >= 80) strengths.push('Thorough coverage of expected concepts');
  if (reasoning >= 80) strengths.push('Clear logical reasoning and justification');

  if (correctness < 60) weaknesses.push('Conceptual inaccuracies or vague definitions');
  if (completeness < 60) weaknesses.push('Answer lacked key required concepts');
  if (technicalDepth < 60) weaknesses.push('Could demonstrate deeper technical mechanics');
  if (wordCount < 15) weaknesses.push('Response was too brief for full technical evaluation');

  let recommendedNextDifficulty = 'medium';
  if (overallScore >= 85) recommendedNextDifficulty = 'hard';
  else if (overallScore < 50) recommendedNextDifficulty = 'easy';

  return {
    correctness,
    completeness,
    technicalDepth,
    reasoning,
    relevance,
    overallScore,
    strengths,
    weaknesses,
    recommendedNextDifficulty,
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
 * @param {string} difficulty
 * @param {string[]} expectedConcepts
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
    const nonSubstantive = detectNonSubstantiveAnswer(
      answerText,
      sbertResult.semanticScore,
      sbertResult.conceptCoverage,
      expectedConcepts
    );

    const fiveDim = nonSubstantive.isNonSubstantive
      ? {
          correctness: 0,
          completeness: 0,
          technicalDepth: 0,
          reasoning: 0,
          relevance: 0,
          overallScore: 0,
          strengths: [],
          weaknesses: ['Response did not contain enough relevant technical content to evaluate.'],
          recommendedNextDifficulty: 'easy',
        }
      : buildFiveDimensionEvaluation(
          questionText,
          answerText,
          sbertResult.textScore,
          expectedConcepts,
          sbertResult
        );

    textEvaluation = {
      ...fiveDim,
      semanticScore: sbertResult.semanticScore,
      conceptCoverage: sbertResult.conceptCoverage,
      textScore: fiveDim.overallScore,
      feedback: nonSubstantive.isNonSubstantive
        ? 'The response did not address the question with enough substantive technical content.'
        : sbertResult.feedback,
      strengths: [...new Set([...fiveDim.strengths, ...(nonSubstantive.isNonSubstantive ? [] : (sbertResult.strengths || []))])],
      weaknesses: fiveDim.weaknesses,
      missingConcepts: sbertResult.missingConcepts || expectedConcepts.slice(0, 5),
      improvementSuggestion: nonSubstantive.isNonSubstantive
        ? 'Provide a technical explanation that addresses: ' + expectedConcepts.slice(0, 5).join(', ') + '.'
        : (sbertResult.improvementSuggestion || null),
      confidence: sbertResult.confidence,
      evaluationStatus: nonSubstantive.isNonSubstantive ? 'non_substantive' : 'evaluated',
      modelStatus: 'sbert_evaluated',
    };

    legacyEval = {
      score: fiveDim.overallScore,
      status: 'sbert_evaluation',
      phase: 4,
      isDevelopmentEvaluation: false,
      feedback: sbertResult.feedback,
      wordCount,
    };
  } else {
    // Development fallback
    const devEval = developmentEvaluate(questionText, answerText, difficulty);
    const nonSubstantive = detectNonSubstantiveAnswer(answerText, null, null, expectedConcepts);

    const fiveDim = nonSubstantive.isNonSubstantive
      ? {
          correctness: 0,
          completeness: 0,
          technicalDepth: 0,
          reasoning: 0,
          relevance: 0,
          overallScore: 0,
          strengths: [],
          weaknesses: ['Response did not contain enough relevant technical content to evaluate.'],
          recommendedNextDifficulty: 'easy',
        }
      : buildFiveDimensionEvaluation(
          questionText,
          answerText,
          devEval.score,
          expectedConcepts,
          null
        );

    textEvaluation = {
      ...fiveDim,
      semanticScore: null,
      conceptCoverage: null,
      textScore: fiveDim.overallScore,
      feedback: nonSubstantive.isNonSubstantive
        ? 'The response did not address the question with enough substantive technical content.'
        : devEval.feedback,
      missingConcepts: expectedConcepts.length > 0 ? expectedConcepts.slice(0, 5) : [],
      improvementSuggestion: nonSubstantive.isNonSubstantive
        ? 'Provide a technical explanation that addresses: ' + expectedConcepts.slice(0, 5).join(', ') + '.'
        : (fiveDim.weaknesses.length > 0 ? 'Focus on: ' + fiveDim.weaknesses.join(', ') : null),
      confidence: null,
      evaluationStatus: nonSubstantive.isNonSubstantive ? 'non_substantive' : 'evaluated',
      modelStatus: sbertResult?.modelStatus || 'ai_service_unavailable',
    };

    legacyEval = {
      ...devEval,
      score: fiveDim.overallScore,
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
 * Process audio file through AI service and extract observable metrics.
 * Note: observable signals only (pacing, pauses, filler words), not psychological mind reading.
 */
const evaluateAudio = async (audioFilePath) => {
  if (!audioFilePath) {
    return {
      audioFeaturesAvailable: false,
      modelStatus: 'no_audio_submitted',
      speakingPace: null,
      pauseFrequency: null,
      fillerWordsCount: 0,
      speechContinuity: null,
      feedback: 'No audio submitted for this response.',
    };
  }

  try {
    const rawResult = await aiService.analyzeAudio(audioFilePath);
    const speakingDuration = rawResult.speakingDuration || 0;
    const pauseDuration = rawResult.pauseDuration || 0;
    const speechRate = rawResult.speechRate ?? (rawResult.speakingPace ?? null);
    
    // Observable metrics
    const pauseFrequency = pauseDuration > 0 && speakingDuration > 0
      ? Number((pauseDuration / speakingDuration).toFixed(2))
      : (rawResult.pauseFrequency ?? null);

    const fillerWords = Array.isArray(rawResult.fillerWords) ? rawResult.fillerWords : [];
    const fillerWordsCount = typeof rawResult.fillerWordsCount === 'number'
      ? rawResult.fillerWordsCount
      : fillerWords.length;

    let feedback = 'Speech delivered at an even pace with clear articulation.';
    if (speechRate && speechRate < 110) {
      feedback = 'Observable speech rate was deliberate and measured; increasing pacing slightly may enhance flow.';
    } else if (speechRate && speechRate > 170) {
      feedback = 'Observable speaking pace was rapid; deliberate pauses at key architectural points can improve clarity.';
    }

    return {
      ...rawResult,
      speakingDuration,
      pauseDuration,
      speakingPace: speechRate,
      speechRate,
      pauseFrequency,
      fillerWordsCount,
      fillerWords,
      speechContinuity: pauseFrequency !== null ? (pauseFrequency > 0.35 ? 'frequent_pauses' : 'steady_continuity') : null,
      feedback: rawResult.feedback || feedback,
      audioFeaturesAvailable: rawResult.audioFeaturesAvailable !== false,
      modelStatus: rawResult.modelStatus || 'processed',
    };
  } catch (err) {
    return {
      audioFeaturesAvailable: false,
      modelStatus: 'unavailable',
      speakingDuration: 0,
      pauseDuration: 0,
      speakingPace: null,
      speechRate: null,
      pauseFrequency: null,
      fillerWordsCount: 0,
      fillerWords: [],
      speechContinuity: null,
      feedback: 'Audio analysis unavailable for this response.',
    };
  }
};

/**
 * Process video file through AI service and extract observable visual signals.
 * Observable signals only (gaze attention, posture stability, camera engagement).
 */
const evaluateVideo = async (videoFilePath) => {
  if (!videoFilePath) {
    return {
      framesProcessed: 0,
      modelStatus: 'no_video_submitted',
      gazeAttentionRatio: null,
      postureStability: null,
      cameraEngagement: null,
      feedback: 'No video submitted for this response.',
    };
  }

  try {
    const rawResult = await aiService.analyzeVideo(videoFilePath);
    // These values are produced by the Python video pipeline from actual frame landmarks.
    // Do not derive gaze from face visibility or posture from person-detection ratio.
    const gazeAttentionRatio = rawResult.gazeAttentionRatio ?? rawResult.metrics?.gaze_alignment_ratio ?? null;
    const postureStability = rawResult.postureStability ?? rawResult.metrics?.posture_stability_label ?? null;
    const cameraEngagement = rawResult.cameraEngagement ?? rawResult.metrics?.camera_engagement ?? null;

    let feedback = 'Observable camera alignment and pose signals were processed.';
    if (gazeAttentionRatio !== null && gazeAttentionRatio < 0.55) {
      feedback = 'The video contained limited camera/eye alignment across visible-face frames.';
    } else if (gazeAttentionRatio !== null && gazeAttentionRatio >= 0.80) {
      feedback = 'The video showed generally consistent camera/eye alignment across visible-face frames.';
    }

    return {
      ...rawResult,
      gazeAttentionRatio,
      postureStability,
      cameraEngagement,
      feedback: rawResult.feedback || rawResult.metrics?.observable_observations?.join(' ') || feedback,
      modelStatus: rawResult.modelStatus || 'processed',
    };
  } catch (err) {
    return {
      framesProcessed: 0,
      modelStatus: 'unavailable',
      gazeAttentionRatio: null,
      postureStability: null,
      cameraEngagement: null,
      faceVisibilityRatio: null,
      personDetectionRatio: null,
      feedback: 'Video analysis unavailable for this response.',
    };
  }
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
