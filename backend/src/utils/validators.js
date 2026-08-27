/**
 * Input validators for API endpoints.
 */

const VALID_INTERVIEW_TYPES = ['technical', 'behavioral', 'hr', 'mixed'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
const MAX_JD_LENGTH = 20000;
const MAX_ROLE_LENGTH = 200;

const validateCreateInterview = (body) => {
  const errors = [];

  if (!body.jobDescriptionId) errors.push('jobDescriptionId is required.');
  if (!body.resumeId) errors.push('resumeId is required.');

  if (body.interviewType && !VALID_INTERVIEW_TYPES.includes(body.interviewType)) {
    errors.push(`interviewType must be one of: ${VALID_INTERVIEW_TYPES.join(', ')}`);
  }

  if (body.difficulty && !VALID_DIFFICULTIES.includes(body.difficulty)) {
    errors.push(`difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`);
  }

  return errors;
};

const validateJobDescription = (body) => {
  const errors = [];

  if (!body.content || body.content.trim().length < 10) {
    errors.push('Job description content is required (min 10 characters).');
  }

  if (body.content && body.content.length > MAX_JD_LENGTH) {
    errors.push(`Job description must be under ${MAX_JD_LENGTH} characters.`);
  }

  if (!body.targetRole || body.targetRole.trim().length === 0) {
    errors.push('targetRole is required.');
  }

  if (body.targetRole && body.targetRole.length > MAX_ROLE_LENGTH) {
    errors.push(`targetRole must be under ${MAX_ROLE_LENGTH} characters.`);
  }

  return errors;
};

const validateSubmitResponse = (body) => {
  const errors = [];

  if (!body.questionId) errors.push('questionId is required.');
  if (!body.answerText || body.answerText.trim().length === 0) {
    errors.push('answerText is required.');
  }

  return errors;
};

module.exports = {
  validateCreateInterview,
  validateJobDescription,
  validateSubmitResponse,
  VALID_INTERVIEW_TYPES,
  VALID_DIFFICULTIES,
};
