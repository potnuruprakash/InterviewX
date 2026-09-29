/**
 * Adaptive Interview Engine
 *
 * Implements:
 *   - Normalized 5-dimension answer scoring
 *   - Rolling performance window (gradual difficulty adjustment)
 *   - Prerequisite question detection for very low scores
 *   - Adaptive topic selection & topic coverage balancing
 *   - Dynamic interview state tracking
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURABLE THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

const ADAPTIVE_CONFIG = {
  HIGH_THRESHOLD: 80,
  MEDIUM_THRESHOLD: 50,
  LOW_THRESHOLD: 35,
  ROLLING_WINDOW_SIZE: 3,
};

const DIFFICULTY_PROGRESSION = {
  easy: { up: 'medium', down: 'easy' },
  medium: { up: 'hard', down: 'easy' },
  hard: { up: 'hard', down: 'medium' },
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORING NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute normalized overall score from 5 core dimensions:
 * Correctness (30%), Completeness (20%), Technical Depth (20%), Reasoning (15%), Relevance (15%)
 */
const normalizeEvaluation = ({
  correctness = 70,
  completeness = 70,
  technicalDepth = 70,
  reasoning = 70,
  relevance = 70,
}) => {
  const clamp = (val) => Math.max(0, Math.min(100, Math.round(Number(val) || 0)));

  const c = clamp(correctness);
  const comp = clamp(completeness);
  const td = clamp(technicalDepth);
  const r = clamp(reasoning);
  const rel = clamp(relevance);

  const overall = Math.round(
    0.30 * c +
    0.20 * comp +
    0.20 * td +
    0.15 * r +
    0.15 * rel
  );

  return {
    correctness: c,
    completeness: comp,
    technicalDepth: td,
    reasoning: r,
    relevance: rel,
    overallScore: Math.max(0, Math.min(100, overall)),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLLING WINDOW & ADAPTIVE DIFFICULTY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates recent performance array using a rolling window of recent answers.
 *
 * @param {number[]} recentPerformance - Array of past recent scores
 * @param {number} latestScore - Score for the answer just evaluated
 * @returns {number[]} Updated rolling performance array
 */
const updateRollingPerformance = (recentPerformance = [], latestScore) => {
  if (typeof latestScore !== 'number' || isNaN(latestScore)) {
    return recentPerformance;
  }
  const updated = [...recentPerformance, Math.round(latestScore)];
  if (updated.length > ADAPTIVE_CONFIG.ROLLING_WINDOW_SIZE) {
    return updated.slice(-ADAPTIVE_CONFIG.ROLLING_WINDOW_SIZE);
  }
  return updated;
};

/**
 * Determine next difficulty based on rolling window and current answer.
 * Prevents extreme jumps from a single bad answer while gradually rewarding strong runs.
 *
 * @param {string} currentDifficulty - 'easy' | 'medium' | 'hard'
 * @param {number[]} recentPerformance - Rolling window scores
 * @param {number} latestScore - Most recent answer score
 * @returns {{ nextDifficulty: string, isPrerequisite: boolean, action: string }}
 */
const determineAdaptiveDifficulty = (currentDifficulty = 'medium', recentPerformance = [], latestScore = 70) => {
  const windowScores = updateRollingPerformance(recentPerformance, latestScore);
  const avgScore = windowScores.reduce((a, b) => a + b, 0) / (windowScores.length || 1);

  // Very low performance on the current answer: trigger prerequisite question
  if (latestScore < ADAPTIVE_CONFIG.LOW_THRESHOLD && avgScore < 50) {
    return {
      nextDifficulty: 'easy',
      isPrerequisite: true,
      action: 'prerequisite_fundamental',
      avgScore: Math.round(avgScore),
    };
  }

  // High performance: gradually increase difficulty
  if (avgScore >= ADAPTIVE_CONFIG.HIGH_THRESHOLD) {
    const nextDiff = DIFFICULTY_PROGRESSION[currentDifficulty]?.up || 'hard';
    return {
      nextDifficulty: nextDiff,
      isPrerequisite: false,
      action: nextDiff !== currentDifficulty ? 'increase_difficulty' : 'maintain_high',
      avgScore: Math.round(avgScore),
    };
  }

  // Medium performance: maintain difficulty
  if (avgScore >= ADAPTIVE_CONFIG.MEDIUM_THRESHOLD) {
    return {
      nextDifficulty: currentDifficulty,
      isPrerequisite: false,
      action: 'maintain_difficulty',
      avgScore: Math.round(avgScore),
    };
  }

  // Low performance: slightly reduce difficulty
  const nextDiff = DIFFICULTY_PROGRESSION[currentDifficulty]?.down || 'easy';
  return {
    nextDifficulty: nextDiff,
    isPrerequisite: false,
    action: nextDiff !== currentDifficulty ? 'reduce_difficulty' : 'maintain_low',
    avgScore: Math.round(avgScore),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE TOPIC SELECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine which topic to ask next based on:
 * - Skill gaps (strong, partial, missing)
 * - Topic coverage counts (prevent asking all questions on one topic)
 * - Performance on previously tested topics
 *
 * @param {Object} params
 * @param {Object} params.skillGap - { strongSkills, partialSkills, missingSkills }
 * @param {Map|Object} params.topicCoverage - Map of topic -> count
 * @param {Map|Object} params.skillPerformance - Map of topic -> performance
 * @param {string} params.targetRole - Target job role
 * @param {number} params.remainingQuestions - Questions left in interview
 * @returns {string} Selected topic
 */
const selectNextAdaptiveTopic = ({
  skillGap = {},
  topicCoverage = {},
  skillPerformance = {},
  targetRole = '',
  currentTopic = null,
}) => {
  const coverageMap = topicCoverage instanceof Map
    ? Object.fromEntries(topicCoverage)
    : (topicCoverage || {});

  const strong = (skillGap.strongSkills || skillGap.matchedSkills || []).map((s) => s.toLowerCase());
  const partial = (skillGap.partialSkills || []).map((s) => s.toLowerCase());
  const missing = (skillGap.missingSkills || []).map((s) => s.toLowerCase());

  // Priority pool of skills to assess
  const allTargetSkills = [...strong, ...partial, ...missing];

  // If no skills defined, fallback based on role
  if (allTargetSkills.length === 0) {
    if (/python/i.test(targetRole)) return 'Python';
    if (/react|frontend/i.test(targetRole)) return 'React';
    if (/java/i.test(targetRole)) return 'Java';
    return 'Problem Solving';
  }

  // 1. Unassessed partial skills (explore candidate's adjacent knowledge)
  const unassessedPartial = partial.filter((s) => !coverageMap[s]);
  if (unassessedPartial.length > 0) {
    return unassessedPartial[0];
  }

  // 2. Unassessed missing skills (check fundamentals of missing required skills)
  const unassessedMissing = missing.filter((s) => !coverageMap[s]);
  if (unassessedMissing.length > 0) {
    return unassessedMissing[0];
  }

  // 3. Unassessed strong skills
  const unassessedStrong = strong.filter((s) => !coverageMap[s]);
  if (unassessedStrong.length > 0) {
    return unassessedStrong[0];
  }

  // 4. If all skills have been asked at least once, choose the least covered skill
  // avoiding asking the exact same topic back-to-back if possible
  const candidateTopics = allTargetSkills.filter((s) => s !== currentTopic?.toLowerCase());
  const poolToEvaluate = candidateTopics.length > 0 ? candidateTopics : allTargetSkills;

  let minCount = Infinity;
  let leastCoveredTopic = poolToEvaluate[0];

  for (const topic of poolToEvaluate) {
    const count = coverageMap[topic] || 0;
    if (count < minCount) {
      minCount = count;
      leastCoveredTopic = topic;
    }
  }

  return leastCoveredTopic;
};

// ─────────────────────────────────────────────────────────────────────────────
// SKILL PERFORMANCE TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update running score and confidence for a tested skill.
 */
const updateSkillPerformance = (currentState = {}, skill, score) => {
  if (!skill || typeof score !== 'number') return currentState;

  const state = { ...currentState };
  if (!state.skillPerformance) state.skillPerformance = {};

  const skillKey = skill.toLowerCase().trim();
  const existing = state.skillPerformance[skillKey] || { score: 0, confidence: 0, questionsAsked: 0 };
  const newQuestionsAsked = existing.questionsAsked + 1;

  const newScore = (existing.score * existing.questionsAsked + score) / newQuestionsAsked;
  const newConfidence = Math.min(1, newQuestionsAsked * 0.4);

  state.skillPerformance[skillKey] = {
    score: Math.round(newScore),
    confidence: Math.round(newConfidence * 10) / 10,
    questionsAsked: newQuestionsAsked,
  };

  if (!state.strongAreas) state.strongAreas = [];
  if (!state.weakAreas) state.weakAreas = [];

  if (newScore >= ADAPTIVE_CONFIG.HIGH_THRESHOLD) {
    if (!state.strongAreas.includes(skill)) state.strongAreas.push(skill);
    state.weakAreas = state.weakAreas.filter((s) => s.toLowerCase() !== skillKey);
  } else if (newScore < ADAPTIVE_CONFIG.MEDIUM_THRESHOLD) {
    if (!state.weakAreas.includes(skill)) state.weakAreas.push(skill);
    state.strongAreas = state.strongAreas.filter((s) => s.toLowerCase() !== skillKey);
  }

  return state;
};

/**
 * Determine whether interview should stop early due to time limit or question limit.
 */
const shouldStopInterview = (interview) => {
  if (!interview) return { shouldStop: false, reason: null };

  const currentIdx = Number(interview.currentQuestionIndex) || 0;
  const total = Number(interview.totalQuestions) || 10;
  if (currentIdx >= total) {
    return { shouldStop: true, reason: 'all_questions_completed' };
  }

  // Check elapsed time if startedAt exists
  if (interview.startedAt && interview.durationMinutes) {
    const elapsedMinutes = (Date.now() - new Date(interview.startedAt).getTime()) / (1000 * 60);
    if (elapsedMinutes >= interview.durationMinutes) {
      return { shouldStop: true, reason: 'time_limit_exceeded' };
    }
  }

  return { shouldStop: false, reason: null };
};

module.exports = {
  ADAPTIVE_CONFIG,
  DIFFICULTY_PROGRESSION,
  normalizeEvaluation,
  updateRollingPerformance,
  determineAdaptiveDifficulty,
  selectNextAdaptiveTopic,
  updateSkillPerformance,
  shouldStopInterview,
};
