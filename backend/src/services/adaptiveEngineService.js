/**
 * Adaptive Interview Engine (Phase 8)
 *
 * Determines difficulty and question selection based on candidate performance.
 *
 * Rules:
 *   Strong answer (score >= 75)  → increase difficulty or move to next skill
 *   Moderate answer (50-74)      → same difficulty, possibly targeted follow-up
 *   Weak answer (< 50)           → easier question or clarification follow-up
 *   Missing concept              → targeted follow-up on missing concept
 *   Skill gap skill              → assess that skill next if not yet covered
 */

const { generateFollowUpQuestion } = require('./questionService');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_THRESHOLDS = {
  STRONG: 75,
  MODERATE: 50,
  WEAK: 0,
};

const DIFFICULTY_MAP = {
  easy: { up: 'medium', down: 'easy' },
  medium: { up: 'hard', down: 'easy' },
  hard: { up: 'hard', down: 'medium' },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize interview state from interview configuration.
 */
const initializeInterviewState = (interview, skillAnalysis = {}) => {
  const missingSkills = skillAnalysis.notIdentifiedRequiredSkills || [];
  const matchedSkills = skillAnalysis.matchedRequiredSkills || [];

  return {
    skillPerformance: {},
    weakAreas: [],
    strongAreas: [],
    answeredQuestions: [],
    currentDifficulty: interview.difficulty || 'medium',
    remainingSkills: [...missingSkills, ...matchedSkills].slice(0, 10),
  };
};

/**
 * Update skill performance after a response is evaluated.
 *
 * @param {Object} currentState - Current interviewState
 * @param {string} skill - Skill being assessed
 * @param {number} score - Response score (0-100)
 * @returns {Object} Updated state
 */
const updateSkillPerformance = (currentState, skill, score) => {
  if (!skill || typeof score !== 'number') return currentState;

  const state = { ...currentState };
  if (!state.skillPerformance) state.skillPerformance = {};

  const existing = state.skillPerformance[skill] || { score: 0, confidence: 0, questionsAsked: 0 };
  const newQuestionsAsked = existing.questionsAsked + 1;

  // Running weighted average
  const newScore = (existing.score * existing.questionsAsked + score) / newQuestionsAsked;
  const newConfidence = Math.min(1, newQuestionsAsked * 0.4); // confidence increases with more questions

  state.skillPerformance[skill] = {
    score: Math.round(newScore),
    confidence: Math.round(newConfidence * 10) / 10,
    questionsAsked: newQuestionsAsked,
  };

  // Update strong/weak areas
  if (!state.strongAreas) state.strongAreas = [];
  if (!state.weakAreas) state.weakAreas = [];

  if (newScore >= SCORE_THRESHOLDS.STRONG) {
    if (!state.strongAreas.includes(skill)) state.strongAreas.push(skill);
    state.weakAreas = state.weakAreas.filter((s) => s !== skill);
  } else if (newScore < SCORE_THRESHOLDS.MODERATE) {
    if (!state.weakAreas.includes(skill)) state.weakAreas.push(skill);
    state.strongAreas = state.strongAreas.filter((s) => s !== skill);
  }

  return state;
};

/**
 * Determine next difficulty based on the performance on the last answer.
 *
 * @param {string} currentDifficulty - 'easy'|'medium'|'hard'
 * @param {number} score - Response score (0-100)
 * @returns {string} Next difficulty
 */
const determineNextDifficulty = (currentDifficulty, score) => {
  const map = DIFFICULTY_MAP[currentDifficulty] || DIFFICULTY_MAP.medium;
  if (score >= SCORE_THRESHOLDS.STRONG) return map.up;
  if (score < SCORE_THRESHOLDS.MODERATE) return map.down;
  return currentDifficulty;
};

/**
 * Determine adaptive action after a response.
 *
 * @param {Object} params
 * @param {number} params.score              - Text/overall score
 * @param {Object} params.currentQuestion    - Question just answered
 * @param {Object} params.textEvaluation     - SBERT evaluation result
 * @param {Object} params.currentState       - Current interview state
 * @returns {Object} { action, nextDifficulty, shouldFollowUp, missingConcepts }
 */
const determineAdaptiveAction = ({ score, currentQuestion, textEvaluation, currentState }) => {
  const missingConcepts = textEvaluation?.missingConcepts || [];
  const nextDifficulty = determineNextDifficulty(
    currentState?.currentDifficulty || 'medium',
    score
  );

  let action;
  let shouldFollowUp = false;

  if (score >= SCORE_THRESHOLDS.STRONG) {
    action = 'next_question';
  } else if (score >= SCORE_THRESHOLDS.MODERATE) {
    // Moderate — generate follow-up if there are missing concepts
    if (missingConcepts.length > 0 && currentQuestion?.followUpAllowed) {
      action = 'follow_up';
      shouldFollowUp = true;
    } else {
      action = 'next_question';
    }
  } else {
    // Weak — follow-up if allowed, otherwise simpler next question
    if (currentQuestion?.followUpAllowed) {
      action = 'follow_up';
      shouldFollowUp = true;
    } else {
      action = 'easier_question';
    }
  }

  return { action, nextDifficulty, shouldFollowUp, missingConcepts };
};

/**
 * Check if the interview should stop.
 *
 * @param {Object} interview - Interview document
 * @returns {{ shouldStop: boolean, reason: string }}
 */
const shouldStopInterview = (interview) => {
  if (interview.currentQuestionIndex >= interview.totalQuestions) {
    return { shouldStop: true, reason: 'question_limit_reached' };
  }

  const state = interview.interviewState || {};
  const skillPerf = state.skillPerformance || {};
  const totalSkills = Object.keys(skillPerf).length;

  // Stop if all tracked skills have sufficient confidence
  if (totalSkills >= 3) {
    const allHighConfidence = Object.values(skillPerf).every(
      (p) => p.confidence >= 0.8
    );
    if (allHighConfidence) {
      return { shouldStop: true, reason: 'sufficient_skill_coverage' };
    }
  }

  return { shouldStop: false, reason: null };
};

module.exports = {
  initializeInterviewState,
  updateSkillPerformance,
  determineNextDifficulty,
  determineAdaptiveAction,
  shouldStopInterview,
  generateFollowUpQuestion,
  SCORE_THRESHOLDS,
};
