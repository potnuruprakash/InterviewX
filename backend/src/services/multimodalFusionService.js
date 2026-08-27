/**
 * Multimodal Fusion Service (Phase 7)
 *
 * Combines text, audio, and video evaluation scores into a unified overall score.
 * Uses configurable weighted averaging with graceful handling of unavailable modalities.
 *
 * Default weights:
 *   Text  = 50%
 *   Audio = 25%
 *   Video = 25%
 *
 * When a modality is unavailable, its weight is redistributed to available modalities.
 */

const DEFAULT_WEIGHTS = {
  text: 0.5,
  audio: 0.25,
  video: 0.25,
};

/**
 * Validate which modalities have real scores.
 *
 * @param {Object} scores - { textScore, audioScore, videoScore }
 * @returns {Object} { text, audio, video } — true if score is valid
 */
const validateModalities = ({ textScore, audioScore, videoScore }) => {
  return {
    text: typeof textScore === 'number' && !isNaN(textScore),
    audio: typeof audioScore === 'number' && !isNaN(audioScore),
    video: typeof videoScore === 'number' && !isNaN(videoScore),
  };
};

/**
 * Calculate weighted overall score from available modalities.
 *
 * @param {Object} scores - { textScore, audioScore, videoScore }
 * @param {Object} [customWeights] - Optional override weights
 * @returns {Object} Fusion result
 */
const calculateWeightedScore = (scores, customWeights = null) => {
  const weights = { ...DEFAULT_WEIGHTS, ...(customWeights || {}) };
  const available = validateModalities(scores);

  const usedModalities = [];
  const modalityScores = {};

  if (available.text) { usedModalities.push('text'); modalityScores.text = scores.textScore; }
  if (available.audio) { usedModalities.push('audio'); modalityScores.audio = scores.audioScore; }
  if (available.video) { usedModalities.push('video'); modalityScores.video = scores.videoScore; }

  if (usedModalities.length === 0) {
    return {
      overallScore: null,
      modalitiesUsed: [],
      scoringNote: 'No modality scores available.',
      textWeight: 0,
      audioWeight: 0,
      videoWeight: 0,
    };
  }

  // Redistribute weights to available modalities
  const totalWeight = usedModalities.reduce((sum, m) => sum + weights[m], 0);
  const adjustedWeights = {};
  for (const m of usedModalities) {
    adjustedWeights[m] = weights[m] / totalWeight;
  }

  // Weighted sum
  let weighted = 0;
  for (const m of usedModalities) {
    weighted += modalityScores[m] * adjustedWeights[m];
  }

  const overallScore = Math.round(weighted * 10) / 10;

  const missingModalities = Object.keys(available).filter((m) => !available[m]);
  const note = missingModalities.length > 0
    ? `Score calculated from: ${usedModalities.join(', ')}. Unavailable: ${missingModalities.join(', ')}.`
    : `Score calculated from all modalities: ${usedModalities.join(', ')}.`;

  return {
    overallScore,
    modalitiesUsed: usedModalities,
    scoringNote: note,
    textWeight: adjustedWeights.text || 0,
    audioWeight: adjustedWeights.audio || 0,
    videoWeight: adjustedWeights.video || 0,
  };
};

/**
 * Build a complete per-response multimodal evaluation.
 *
 * @param {Object} textEval   - Result from SBERT text evaluation
 * @param {Object} audioEval  - Result from audio analysis (null if unavailable)
 * @param {Object} videoEval  - Result from video analysis (null if unavailable)
 * @returns {Object} multimodalEvaluation document
 */
const buildEvaluation = (textEval, audioEval, videoEval) => {
  const textScore = textEval?.textScore ?? textEval?.semanticScore ?? null;
  const audioScore = null; // Audio does not produce a single score in dev mode
  const videoScore = null; // Video does not produce a single score in dev mode

  const fusion = calculateWeightedScore({ textScore, audioScore, videoScore });

  return {
    overallScore: fusion.overallScore,
    textWeight: fusion.textWeight,
    audioWeight: fusion.audioWeight,
    videoWeight: fusion.videoWeight,
    modalitiesUsed: fusion.modalitiesUsed,
    weightedScore: fusion.overallScore,
    scoringNote: fusion.scoringNote,
  };
};

/**
 * Aggregate fusion scores across all responses in an interview.
 *
 * @param {Array} responses - Array of Response documents
 * @returns {Object} Aggregated result
 */
const aggregateInterviewFusion = (responses) => {
  if (!responses || responses.length === 0) {
    return {
      overallScore: null,
      technicalScore: null,
      audioScore: null,
      videoScore: null,
      modalitiesUsed: ['text'],
      questionsAnswered: 0,
    };
  }

  const textScores = [];
  const allModalities = new Set();

  for (const r of responses) {
    const ts = r.textEvaluation?.textScore ?? r.evaluation?.score ?? null;
    if (typeof ts === 'number') textScores.push(ts);

    if (r.multimodalEvaluation?.modalitiesUsed) {
      for (const m of r.multimodalEvaluation.modalitiesUsed) allModalities.add(m);
    } else {
      allModalities.add('text');
    }
  }

  const avg = (arr) => arr.length > 0
    ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10
    : null;

  const technicalScore = avg(textScores);

  return {
    overallScore: technicalScore, // primary modality for now
    technicalScore,
    audioScore: null,
    videoScore: null,
    modalitiesUsed: [...allModalities],
    questionsAnswered: responses.length,
  };
};

module.exports = {
  validateModalities,
  calculateWeightedScore,
  buildEvaluation,
  aggregateInterviewFusion,
  DEFAULT_WEIGHTS,
};
