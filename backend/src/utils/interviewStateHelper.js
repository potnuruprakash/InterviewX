/**
 * Interview State & Queue Helpers
 *
 * Centralizes state calculations, separating:
 *   - configuredQuestionCount : User-chosen initial count (e.g. 5, 10, 15)
 *   - questionsAsked          : Number of questions presented so far
 *   - maximumQuestions        : Hard ceiling (configured count + max 2 adaptive follow-ups)
 *
 * Guarantees that:
 *   - submitted ≠ skipped
 *   - Skipped questions do not count as answered
 *   - Infinite follow-up loops are impossible
 */

/**
 * Maximum adaptive follow-up questions permitted beyond configured count
 */
const MAX_ADAPTIVE_FOLLOW_UPS = 2;
const ABSOLUTE_MAX_QUESTIONS = 15;

/**
 * Check if a question is successfully answered
 */
const isQuestionAnswered = (question) => {
  return question && question.status === 'answered';
};

/**
 * Check if a question was skipped
 */
const isQuestionSkipped = (question) => {
  return question && question.status === 'skipped';
};

/**
 * Calculate the hard ceiling for an interview's total question count
 */
const getMaximumAllowedQuestions = (configuredQuestionCount) => {
  const base = Math.max(1, Number(configuredQuestionCount) || 5);
  return Math.min(ABSOLUTE_MAX_QUESTIONS, base + MAX_ADAPTIVE_FOLLOW_UPS);
};

/**
 * Audit question collection and return clean counts
 */
const getInterviewCounts = (interview, questions = [], responses = []) => {
  const configured = interview.configuredQuestionCount || interview.totalQuestions || 5;
  const maxAllowed = getMaximumAllowedQuestions(configured);

  const answered = questions.filter((q) => q.status === 'answered').length;
  const skipped = questions.filter((q) => q.status === 'skipped').length;
  const timedOut = questions.filter((q) => q.status === 'timeout').length;
  const pending = questions.filter((q) => q.status === 'pending' || !q.status).length;

  return {
    configuredQuestionCount: configured,
    maximumQuestions: maxAllowed,
    answeredQuestionsCount: answered,
    skippedQuestionsCount: skipped,
    timedOutQuestionsCount: timedOut,
    pendingQuestionsCount: pending,
    totalQuestionsCreated: questions.length,
    responsesCount: responses.length,
  };
};

/**
 * Check if an adaptive follow-up question should and can be created
 */
const canAddAdaptiveFollowUp = (interview, questions = []) => {
  const configured = interview.configuredQuestionCount || interview.totalQuestions || 5;
  const maxAllowed = getMaximumAllowedQuestions(configured);

  // Count existing follow-ups
  const existingFollowUps = questions.filter(
    (q) => q.type === 'follow_up' || q.category === 'follow_up' || Boolean(q.parentQuestionId)
  ).length;

  return existingFollowUps < MAX_ADAPTIVE_FOLLOW_UPS && questions.length < maxAllowed;
};

/**
 * Calculate completion status
 */
const isInterviewComplete = (interview, questions = []) => {
  if (interview.status === 'completed') return true;

  const configured = interview.configuredQuestionCount || interview.totalQuestions || 5;
  const maxAllowed = getMaximumAllowedQuestions(configured);

  const pendingQuestions = questions.filter((q) => q.status === 'pending');
  const answeredOrSkipped = questions.filter((q) => q.status === 'answered' || q.status === 'skipped').length;

  if (answeredOrSkipped >= maxAllowed) return true;
  if (pendingQuestions.length === 0 && answeredOrSkipped >= configured) return true;

  return false;
};

module.exports = {
  MAX_ADAPTIVE_FOLLOW_UPS,
  ABSOLUTE_MAX_QUESTIONS,
  isQuestionAnswered,
  isQuestionSkipped,
  getMaximumAllowedQuestions,
  getInterviewCounts,
  canAddAdaptiveFollowUp,
  isInterviewComplete,
};
