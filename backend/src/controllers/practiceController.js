/**
 * Practice Controller
 *
 * Handles:
 *   POST /api/practice/topic      — Start topic-specific MCQ practice test
 *   POST /api/practice/targeted   — Start combined weak-area targeted mock test ("Train Me")
 *   POST /api/practice/:id/answer — Submit an answer to a question
 *   GET  /api/practice/:id        — Get session (resume/refresh support)
 *   POST /api/practice/:id/complete — Finalize session and get score analysis
 */

const PracticeSession = require('../models/PracticeSession');
const Interview = require('../models/Interview');
const { sendError, sendSuccess } = require('../utils/errorHandler');
const {
  generatePracticeQuestions,
  generateTargetedMockQuestions,
  sanitizeSessionForClient,
} = require('../services/practiceService');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/practice/topic
// ─────────────────────────────────────────────────────────────────────────────

const createTopicPractice = async (req, res) => {
  try {
    const { skill, interviewId = null, topics = [] } = req.body;
    const clerkUserId = req.clerkUserId;

    if (!skill || typeof skill !== 'string' || skill.trim().length === 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'A target skill or topic is required for practice.');
    }

    const cleanSkill = skill.trim();

    // Verify interview ownership if interviewId is provided
    if (interviewId) {
      const interview = await Interview.findOne({ _id: interviewId, clerkUserId });
      if (!interview) {
        return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Referenced interview not found or unauthorized.');
      }
    }

    // Generate at least 20 MCQs for the selected skill
    const questions = await generatePracticeQuestions({
      skill: cleanSkill,
      topics,
      count: 20,
    });

    const session = await PracticeSession.create({
      clerkUserId,
      interviewId: interviewId || null,
      mode: 'topic_practice',
      targetSkill: cleanSkill,
      targetSkills: [cleanSkill],
      questions,
      selectedAnswers: [],
      score: 0,
      totalQuestions: questions.length,
      percentage: 0,
      weakTopics: [],
      strongTopics: [],
      status: 'in_progress',
    });

    console.log(`[PracticeController] Created topic practice session "${session._id}" for user "${clerkUserId}" on skill "${cleanSkill}" with ${questions.length} questions.`);

    return sendSuccess(res, {
      session: sanitizeSessionForClient(session),
    }, 201);
  } catch (err) {
    console.error('[PracticeController] Error creating topic practice session:', err);
    return sendError(res, 500, 'PRACTICE_CREATION_FAILED', 'Failed to generate practice test. Please try again.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/practice/targeted (Train Me — Combined Weak-Area Mock Test)
// ─────────────────────────────────────────────────────────────────────────────

const createTargetedMock = async (req, res) => {
  try {
    const { interviewId, weakAreas: customWeakAreas } = req.body;
    const clerkUserId = req.clerkUserId;

    let targetWeakAreas = Array.isArray(customWeakAreas) ? customWeakAreas.filter(Boolean) : [];

    if (interviewId) {
      const interview = await Interview.findOne({ _id: interviewId, clerkUserId });
      if (!interview) {
        return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found or unauthorized.');
      }

      // If weak areas were not passed explicitly in body, synthesize from interview
      if (targetWeakAreas.length === 0) {
        const fe = interview.finalEvaluation || {};
        const areas = [
          ...(fe.weakAreas || []),
          ...(fe.skillGaps || []),
          ...(interview.skillAnalysis?.missingSkills || []),
          ...(interview.skillAnalysis?.weakSkills || []),
        ].filter(Boolean);

        targetWeakAreas = Array.from(new Set(areas));
      }

      // If still empty, fall back to target role or core competencies
      if (targetWeakAreas.length === 0) {
        targetWeakAreas = [interview.targetRole || 'Software Engineering'];
      }
    }

    if (targetWeakAreas.length === 0) {
      targetWeakAreas = ['System Architecture', 'Problem Solving', 'Technical Communication'];
    }

    // Generate at least 20 MCQs distributed across all weak areas
    const questions = await generateTargetedMockQuestions({
      weakAreas: targetWeakAreas,
      interviewId,
      count: 20,
    });

    const displaySkillTitle = targetWeakAreas.length === 1
      ? targetWeakAreas[0]
      : `Combined Weak Areas (${targetWeakAreas.slice(0, 3).join(', ')}${targetWeakAreas.length > 3 ? '...' : ''})`;

    const session = await PracticeSession.create({
      clerkUserId,
      interviewId: interviewId || null,
      mode: 'targeted_mock',
      targetSkill: displaySkillTitle,
      targetSkills: targetWeakAreas,
      questions,
      selectedAnswers: [],
      score: 0,
      totalQuestions: questions.length,
      percentage: 0,
      weakTopics: [],
      strongTopics: [],
      status: 'in_progress',
    });

    console.log(`[PracticeController] Created targeted mock session "${session._id}" for user "${clerkUserId}" across [${targetWeakAreas.join(', ')}] with ${questions.length} questions.`);

    return sendSuccess(res, {
      session: sanitizeSessionForClient(session),
    }, 201);
  } catch (err) {
    console.error('[PracticeController] Error creating targeted mock test:', err);
    return sendError(res, 500, 'TARGETED_MOCK_CREATION_FAILED', 'Failed to generate targeted mock test. Please try again.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/practice/:id/answer
// ─────────────────────────────────────────────────────────────────────────────

const submitAnswer = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionIndex, selectedOption } = req.body;
    const clerkUserId = req.clerkUserId;

    const qIdx = Number(questionIndex);
    const optIdx = Number(selectedOption);

    if (!Number.isInteger(qIdx) || qIdx < 0) {
      return sendError(res, 400, 'INVALID_QUESTION_INDEX', 'Invalid question index.');
    }

    if (!Number.isInteger(optIdx) || optIdx < 0 || optIdx > 3) {
      return sendError(res, 400, 'INVALID_OPTION', 'Selected option must be an integer between 0 and 3.');
    }

    const session = await PracticeSession.findOne({ _id: id, clerkUserId });
    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Practice session not found or unauthorized.');
    }

    if (session.status === 'completed') {
      return sendError(res, 400, 'SESSION_COMPLETED', 'This practice session is already completed.');
    }

    if (qIdx >= session.questions.length) {
      return sendError(res, 400, 'INDEX_OUT_OF_BOUNDS', 'Question index is out of bounds for this session.');
    }

    // Check if question has already been answered
    const alreadyAnswered = session.selectedAnswers.some((a) => a.questionIndex === qIdx);
    if (alreadyAnswered) {
      return sendError(res, 400, 'ALREADY_ANSWERED', 'An answer has already been submitted for this question.');
    }

    const question = session.questions[qIdx];
    const isCorrect = question.correctAnswer === optIdx;

    session.selectedAnswers.push({
      questionIndex: qIdx,
      selectedOption: optIdx,
      isCorrect,
      answeredAt: new Date(),
    });

    if (isCorrect) {
      session.score = (session.score || 0) + 1;
    }
    session.percentage = Math.round((session.score / session.totalQuestions) * 100);

    await session.save();

    return sendSuccess(res, {
      isCorrect,
      userAnswer: optIdx,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      score: session.score,
      answeredCount: session.selectedAnswers.length,
      totalQuestions: session.totalQuestions,
    });
  } catch (err) {
    console.error('[PracticeController] Error submitting answer:', err);
    return sendError(res, 500, 'ANSWER_SUBMISSION_FAILED', 'Failed to process answer submission.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/practice/:id (Resume/refresh support)
// ─────────────────────────────────────────────────────────────────────────────

const getPracticeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const clerkUserId = req.clerkUserId;

    const session = await PracticeSession.findOne({ _id: id, clerkUserId });
    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Practice session not found or unauthorized.');
    }

    return sendSuccess(res, {
      session: sanitizeSessionForClient(session),
    });
  } catch (err) {
    console.error('[PracticeController] Error fetching session:', err);
    return sendError(res, 500, 'SESSION_FETCH_FAILED', 'Failed to retrieve practice session.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/practice/:id/complete
// ─────────────────────────────────────────────────────────────────────────────

const completePracticeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const clerkUserId = req.clerkUserId;

    const session = await PracticeSession.findOne({ _id: id, clerkUserId });
    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Practice session not found or unauthorized.');
    }

    const answersMap = new Map();
    session.selectedAnswers.forEach((a) => answersMap.set(a.questionIndex, a));

    const weakTopicsSet = new Set();
    const strongTopicsSet = new Set();

    session.questions.forEach((q, idx) => {
      const ans = answersMap.get(idx);
      const topicName = q.topic || session.targetSkill;
      if (ans && ans.isCorrect) {
        strongTopicsSet.add(topicName);
      } else {
        // Incorrect or skipped
        weakTopicsSet.add(topicName);
      }
    });

    session.weakTopics = Array.from(weakTopicsSet);
    session.strongTopics = Array.from(strongTopicsSet);
    session.status = 'completed';
    session.completedAt = new Date();
    session.percentage = Math.round((session.score / Math.max(1, session.totalQuestions)) * 100);

    await session.save();

    console.log(`[PracticeController] Completed session "${session._id}" — Score: ${session.score}/${session.totalQuestions} (${session.percentage}%)`);

    // Returning full completed session including all questions and explanations for post-test review
    return sendSuccess(res, {
      session,
      summary: {
        totalQuestions: session.totalQuestions,
        correctAnswers: session.score,
        incorrectAnswers: Math.max(0, session.totalQuestions - session.score),
        percentage: session.percentage,
        skill: session.targetSkill,
        weakTopics: session.weakTopics,
        strongTopics: session.strongTopics,
        recommendations: session.weakTopics.map((topic) => `Review core patterns and practical trade-offs in ${topic}.`),
      },
    });
  } catch (err) {
    console.error('[PracticeController] Error completing practice session:', err);
    return sendError(res, 500, 'SESSION_COMPLETION_FAILED', 'Failed to complete practice session.');
  }
};

module.exports = {
  createTopicPractice,
  createTargetedMock,
  submitAnswer,
  getPracticeSession,
  completePracticeSession,
};
