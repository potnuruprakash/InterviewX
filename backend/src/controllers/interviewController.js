/**
 * Interview Controller (Phase 3 → Phase 10)
 *
 * Handles:
 *   POST /api/interviews              — Create with personalized questions (Phase 3)
 *   GET  /api/interviews              — List user interviews
 *   GET  /api/interviews/:id          — Get interview detail
 *   POST /api/interviews/:id/start    — Start interview
 *   GET  /api/interviews/:id/questions/current — Get current question
 *   POST /api/interviews/:id/responses       — Submit text answer (Phase 4 SBERT)
 *   POST /api/interviews/:id/audio-response  — Submit audio (Phase 5)
 *   POST /api/interviews/:id/video-response  — Submit video (Phase 6)
 *   POST /api/interviews/:id/complete        — Force complete interview
 *   GET  /api/interviews/:id/results         — Get final results (Phase 9)
 *   GET  /api/interviews/:id/roadmap         — Get improvement roadmap (Phase 10)
 */

const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');
const Progress = require('../models/Progress');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const SkillAnalysis = require('../models/SkillAnalysis');
const TrainingSession = require('../models/TrainingSession');
const { sendError, sendSuccess } = require('../utils/errorHandler');
const { validateCreateInterview, validateSubmitResponse } = require('../utils/validators');
const { generateInterviewQuestions, generateFollowUpQuestion, generateNextPersonalizedQuestion } = require('../services/questionService');
const { evaluateResponse, evaluateAudio, evaluateVideo, aggregateInterviewScore } = require('../services/evaluationService');
const { aggregateInterviewFusion, buildEvaluation } = require('../services/multimodalFusionService');
const {
  updateSkillPerformance,
  determineAdaptiveAction,
  shouldStopInterview,
  updateRollingPerformance,
  determineAdaptiveDifficulty,
  selectNextAdaptiveTopic,
} = require('../services/adaptiveEngineService');
const { generateRoadmap, calculateJobReadiness } = require('../services/roadmapService');
const { generateTrainingSession } = require('../services/trainingService');
const { deleteFile } = require('../middleware/upload');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const formatQuestion = (q) => q ? {
  id: q._id,
  text: q.text,
  type: q.type,
  category: q.category,
  difficulty: q.difficulty,
  targetSkill: q.targetSkill || q.skill,
  skill: q.skill,
  source: q.source,
  sourceProject: q.sourceProject,
  order: q.order,
  followUpAllowed: q.followUpAllowed,
  contextNote: q.contextNote,
  starterCode: q.starterCode || null,
  language: q.language || 'javascript',
  status: q.status || 'pending',
} : null;

// ─────────────────────────────────────────────────────────────────────────────
// CREATE INTERVIEW (Phase 3 — Personalized Questions)
// ─────────────────────────────────────────────────────────────────────────────

const createInterview = async (req, res) => {
  try {
    const errors = validateCreateInterview(req.body);
    if (errors.length > 0) return sendError(res, 400, 'VALIDATION_ERROR', errors.join(' '));

    const {
      resumeId, jobDescriptionId,
      interviewType = 'mixed', difficulty = 'medium', totalQuestions = 10,
      durationMinutes = 30,
    } = req.body;
    const clerkUserId = req.clerkUserId;

    // Verify resume belongs to this user
    const resume = await Resume.findOne({ _id: resumeId, clerkUserId });
    if (!resume) return sendError(res, 404, 'RESUME_NOT_FOUND', 'Resume not found.');

    // Verify JD belongs to this user
    const job = await JobDescription.findOne({ _id: jobDescriptionId, clerkUserId });
    if (!job) return sendError(res, 404, 'JOB_NOT_FOUND', 'Job description not found.');

    // Load skill analysis if available
    let skillAnalysis = null;
    try {
      skillAnalysis = await SkillAnalysis.findOne({ clerkUserId, resumeId, jobDescriptionId });
    } catch (e) { /* not critical */ }

    // Create interview
    const interview = await Interview.create({
      clerkUserId,
      resumeId,
      jobDescriptionId,
      skillAnalysisId: skillAnalysis?._id || null,
      targetRole: job.targetRole || job.role || 'Software Engineer',
      interviewType,
      difficulty,
      totalQuestions: Math.min(totalQuestions, 15),
      durationMinutes: Math.max(5, Math.min(120, Number(durationMinutes) || 30)),
      status: 'created',
      skillAnalysis: skillAnalysis ? {
        matchedSkills: skillAnalysis.matchedRequiredSkills || [],
        missingSkills: skillAnalysis.notIdentifiedRequiredSkills || [],
        weakSkills: [],
        skillGapPercentage: skillAnalysis.skillGapPercentage || 0,
      } : {},
    });

    // ── Phase 3: Generate personalized questions ────────────────────────────
    let questionData = [];
    let generationSource = 'static_bank';

    const candidateProfile = resume.analysis || resume.parsedData || {};
    const jobProfile = job.analysis || job.parsedData || {};

    const hasPersonalizationData = (
      candidateProfile.skills?.length > 0 ||
      candidateProfile.extractedSkills?.length > 0 ||
      skillAnalysis !== null
    );

    if (hasPersonalizationData) {
      questionData = generateInterviewQuestions({
        candidateProfile,
        jobProfile,
        skillAnalysis: skillAnalysis || {},
        interviewType,
        difficulty,
        totalQuestions: interview.totalQuestions,
      });
      generationSource = 'personalized';
    }

    // Fall back to static bank if personalized generation produced too few questions
    if (questionData.length < 3) {
      const { getQuestionsForInterview } = require('../services/questionService');
      const fallback = getQuestionsForInterview(interviewType, difficulty, interview.totalQuestions);
      questionData = [
        ...questionData,
        ...fallback.map((q) => ({
          ...q,
          type: q.category || 'technical',
          source: 'static_bank',
          targetSkill: q.skill,
          expectedConcepts: q.expectedKeyPoints || [],
          followUpAllowed: true,
          contextNote: null,
        })),
      ];
      generationSource = questionData.length > 0 ? 'hybrid' : 'static_bank';
    }

    // Deduplicate + trim
    const seen = new Set();
    const unique = [];
    for (const q of questionData) {
      if (!seen.has(q.text)) { seen.add(q.text); unique.push(q); }
      if (unique.length >= interview.totalQuestions) break;
    }

    const questions = await Question.insertMany(
      unique.map((q, index) => ({
        interviewId: interview._id,
        clerkUserId,
        text: q.text,
        type: q.type || q.category || 'technical',
        category: q.category || 'technical',
        difficulty: q.difficulty || difficulty,
        targetSkill: q.targetSkill || q.skill || null,
        skill: q.skill || q.targetSkill || 'general',
        source: q.source || 'static_bank',
        sourceProject: q.sourceProject || null,
        expectedConcepts: q.expectedConcepts || q.expectedKeyPoints || [],
        expectedKeyPoints: q.expectedKeyPoints || q.expectedConcepts || [],
        order: index,
        followUpAllowed: q.followUpAllowed !== false,
        contextNote: q.contextNote || null,
        starterCode: q.starterCode || null,
        language: q.language || 'javascript',
        status: 'pending',
      }))
    );

    interview.totalQuestions = questions.length;
    interview.questionGenerationSource = generationSource;
    await interview.save();

    return sendSuccess(res, {
      message: 'Interview created successfully.',
      interview: {
        id: interview._id,
        targetRole: interview.targetRole,
        interviewType: interview.interviewType,
        difficulty: interview.difficulty,
        status: interview.status,
        totalQuestions: interview.totalQuestions,
        durationMinutes: interview.durationMinutes,
        questionGenerationSource: generationSource,
        createdAt: interview.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('[Interview] Create error:', error);
    return sendError(res, 500, 'INTERVIEW_CREATE_FAILED', 'Could not create interview.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST INTERVIEWS
// ─────────────────────────────────────────────────────────────────────────────

const getUserInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ clerkUserId: req.clerkUserId })
      .select('-interviewState -finalEvaluation')
      .sort({ createdAt: -1 })
      .limit(20);
    return sendSuccess(res, { interviews });
  } catch (error) {
    return sendError(res, 500, 'INTERVIEW_FETCH_FAILED', 'Could not retrieve interviews.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET INTERVIEW
// ─────────────────────────────────────────────────────────────────────────────

const getInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    return sendSuccess(res, { interview });
  } catch (error) {
    return sendError(res, 500, 'INTERVIEW_FETCH_FAILED', 'Could not retrieve interview.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// START INTERVIEW
// ─────────────────────────────────────────────────────────────────────────────

const startInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    const isAllQuestionsFinished = interview.currentQuestionIndex >= interview.totalQuestions;
    if (interview.status === 'completed' || isAllQuestionsFinished) {
      if (interview.status !== 'completed') {
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = interview.completionReason || 'all_questions_completed';
        await interview.save();
        await saveProgress(interview, clerkUserId);
      }
      return sendSuccess(res, {
        message: 'Interview already completed.',
        isComplete: true,
        interview: {
          id: interview._id,
          status: 'completed',
          currentQuestionIndex: interview.currentQuestionIndex,
          totalQuestions: interview.totalQuestions,
          durationMinutes: interview.durationMinutes || 30,
          startedAt: interview.startedAt,
          skippedQuestionsCount: interview.skippedQuestionsCount || 0,
          completionReason: interview.completionReason || null,
        },
        currentQuestion: null,
      });
    }

    if (interview.status === 'created') {
      interview.status = 'in_progress';
      interview.startedAt = new Date();
      await interview.save();
    }

    let firstQuestion = await Question.findOne({
      interviewId: interview._id,
      order: interview.currentQuestionIndex,
    });

    // Fallback: if current question is missing or already answered/skipped, find next pending
    if (!firstQuestion || firstQuestion.status !== 'pending') {
      const nextPending = await Question.findOne({
        interviewId: interview._id,
        status: 'pending',
      }).sort({ order: 1 });

      if (nextPending) {
        firstQuestion = nextPending;
        interview.currentQuestionIndex = nextPending.order;
        await interview.save();
      } else {
        // No pending questions left at all
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = 'all_questions_completed';
        await interview.save();
        await saveProgress(interview, clerkUserId);

        return sendSuccess(res, {
          message: 'All questions completed.',
          isComplete: true,
          interview: {
            id: interview._id,
            status: 'completed',
            currentQuestionIndex: interview.totalQuestions,
            totalQuestions: interview.totalQuestions,
            durationMinutes: interview.durationMinutes || 30,
            startedAt: interview.startedAt,
            skippedQuestionsCount: interview.skippedQuestionsCount || 0,
            completionReason: interview.completionReason,
          },
          currentQuestion: null,
        });
      }
    }

    return sendSuccess(res, {
      message: 'Interview started.',
      interview: {
        id: interview._id,
        status: interview.status,
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: interview.totalQuestions,
        durationMinutes: interview.durationMinutes || 30,
        startedAt: interview.startedAt,
        skippedQuestionsCount: interview.skippedQuestionsCount || 0,
        completionReason: interview.completionReason || null,
        questionGenerationSource: interview.questionGenerationSource,
        modalityAvailability: interview.modalityAvailability,
      },
      currentQuestion: formatQuestion(firstQuestion),
    });
  } catch (error) {
    console.error('[Interview] Start error:', error);
    return sendError(res, 500, 'INTERVIEW_START_FAILED', 'Could not start interview.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CURRENT QUESTION
// ─────────────────────────────────────────────────────────────────────────────

const getCurrentQuestion = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    if (interview.status === 'completed') {
      return sendSuccess(res, {
        message: 'Interview completed.',
        isComplete: true,
        currentQuestion: null,
        interview: {
          id: interview._id,
          status: interview.status,
          completionReason: interview.completionReason,
          durationMinutes: interview.durationMinutes || 30,
          startedAt: interview.startedAt,
          skippedQuestionsCount: interview.skippedQuestionsCount || 0,
        },
      });
    }

    const question = await Question.findOne({
      interviewId: interview._id,
      order: interview.currentQuestionIndex,
    });

    return sendSuccess(res, {
      currentQuestion: formatQuestion(question),
      currentQuestionIndex: interview.currentQuestionIndex,
      totalQuestions: interview.totalQuestions,
      skippedQuestionsCount: interview.skippedQuestionsCount || 0,
      durationMinutes: interview.durationMinutes || 30,
      startedAt: interview.startedAt,
      isComplete: !question,
      interview: {
        id: interview._id,
        status: interview.status,
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: interview.totalQuestions,
        durationMinutes: interview.durationMinutes || 30,
        startedAt: interview.startedAt,
        skippedQuestionsCount: interview.skippedQuestionsCount || 0,
      },
    });
  } catch (error) {
    return sendError(res, 500, 'QUESTION_FETCH_FAILED', 'Could not retrieve question.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT TEXT RESPONSE (Phase 4 — SBERT)
// ─────────────────────────────────────────────────────────────────────────────

const submitResponse = async (req, res) => {
  try {
    const errors = validateSubmitResponse(req.body);
    if (errors.length > 0) return sendError(res, 400, 'VALIDATION_ERROR', errors.join(' '));

    const { questionId, answerText, code, language, responseType = 'text' } = req.body;
    const clerkUserId = req.clerkUserId;

    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    if (interview.status === 'completed') {
      return sendError(res, 400, 'INTERVIEW_COMPLETED', 'This interview is already completed.');
    }

    const question = await Question.findOne({ _id: questionId, interviewId: interview._id });
    if (!question) return sendError(res, 404, 'QUESTION_NOT_FOUND', 'Question not found in this interview.');

    const existingResponse = await Response.findOne({ interviewId: interview._id, questionId, clerkUserId });
    if (existingResponse) return sendError(res, 409, 'RESPONSE_EXISTS', 'Answer already submitted for this question.');

    // Determine evaluation text: if coding response, combine explanation and code for semantic evaluation
    const textToEvaluate = (answerText && answerText.trim().length > 0)
      ? (code ? `${answerText.trim()}\n\nCode Solution (${language || 'code'}):\n${code}` : answerText.trim())
      : (code || '').trim();

    // ── SBERT evaluation ────────────────────────────────────────────
    const expectedConcepts = question.expectedConcepts || question.expectedKeyPoints || [];
    const { textEvaluation, evaluation } = await evaluateResponse(
      question.text,
      textToEvaluate,
      question.difficulty,
      expectedConcepts
    );

    // ── Build multimodal evaluation (text only initially) ────────────
    const multimodalEval = buildEvaluation(textEvaluation, null, null);

    // Save response. The pre-insert existence check above is only an
    // optimization; concurrent requests can still race between the check and
    // this insert. The unique MongoDB index is the correctness boundary.
    let response;
    try {
      response = await Response.create({
        clerkUserId,
        interviewId: interview._id,
        questionId,
        answerText: textToEvaluate,
        responseType: responseType || (code ? 'coding' : 'text'),
        code: code || null,
        language: language || null,
        status: 'submitted',
        textEvaluation,
        multimodalEvaluation: multimodalEval,
        evaluation, // legacy
        submittedAt: new Date(),
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        return sendError(res, 409, 'RESPONSE_EXISTS', 'Answer already submitted for this question.');
      }
      throw createError;
    }

    // Mark question as answered
    question.status = 'answered';
    await question.save();

    // ── Adaptive engine ─────────────────────────────────────────────
    const responseScore = textEvaluation.textScore || evaluation.score || 0;
    const skill = question.targetSkill || question.skill || 'general';

    let updatedState = interview.interviewState || {};
    updatedState = updateSkillPerformance(updatedState, skill, responseScore);

    // Update rolling performance window
    const newRecentPerf = updateRollingPerformance(interview.recentPerformance || [], responseScore);
    interview.recentPerformance = newRecentPerf;

    // Calculate adaptive difficulty based on rolling performance
    const adaptiveResult = determineAdaptiveDifficulty(
      interview.difficulty || 'medium',
      newRecentPerf,
      responseScore
    );
    const adaptiveDifficulty = adaptiveResult?.nextDifficulty || (typeof adaptiveResult === 'string' ? adaptiveResult : 'medium');

    // Update topic coverage
    const coverageMap = interview.topicCoverage ? Object.fromEntries(interview.topicCoverage) : {};
    coverageMap[skill.toLowerCase()] = (coverageMap[skill.toLowerCase()] || 0) + 1;
    interview.topicCoverage = coverageMap;

    // Advance question index
    interview.currentQuestionIndex += 1;
    interview.answeredQuestionsCount = (interview.answeredQuestionsCount || 0) + 1;

    // Update adaptive state
    interview.interviewState = {
      ...updatedState,
      currentDifficulty: adaptiveDifficulty,
      adaptiveResult,
    };
    interview.difficulty = adaptiveDifficulty;

    // Check stop conditions
    const { shouldStop } = shouldStopInterview(interview);
    const isComplete = shouldStop || interview.currentQuestionIndex >= interview.totalQuestions;

    let nextQuestion = null;

    if (!isComplete) {
      // Check if a pre-existing question at this order exists
      const existingNext = await Question.findOne({
        interviewId: interview._id,
        order: interview.currentQuestionIndex,
        status: 'pending',
      });

      if (existingNext) {
        nextQuestion = formatQuestion(existingNext);
      } else {
        // Dynamically generate the next personalized question
        // 1. Gather all past question texts to deduplicate
        const pastQuestions = await Question.find({
          $or: [
            { interviewId: interview._id },
            { clerkUserId },
          ],
        }).select('text').lean();
        const pastQuestionTexts = pastQuestions.map(q => q.text);

        // 2. Select next adaptive topic
        const allSkills = [
          ...(interview.skillAnalysis?.matchedSkills || []),
          ...(interview.skillAnalysis?.missingSkills || []),
          ...(interview.skillAnalysis?.strongSkills || []),
          ...(interview.skillAnalysis?.partialSkills || []),
        ];
        const nextTopic = selectNextAdaptiveTopic({
          skillGapProfile: {
            strongSkills: interview.skillAnalysis?.strongSkills || interview.skillAnalysis?.matchedSkills || [],
            partialSkills: interview.skillAnalysis?.partialSkills || [],
            missingSkills: interview.skillAnalysis?.missingSkills || [],
          },
          topicCoverage: coverageMap,
          allTargetSkills: allSkills.length > 0 ? allSkills : [interview.targetRole],
          currentTopic: skill,
        });

        // 3. Generate dynamic personalized question
        const generatedQ = generateNextPersonalizedQuestion({
          targetRole: interview.targetRole,
          interviewType: interview.interviewType,
          topic: nextTopic,
          difficulty: adaptiveDifficulty,
          order: interview.currentQuestionIndex,
          pastQuestionTexts,
          recentPerformance: newRecentPerf,
        });

        const newQuestionDoc = await Question.create({
          interviewId: interview._id,
          clerkUserId,
          ...generatedQ,
          targetSkill: nextTopic,
          skill: nextTopic,
          status: 'pending',
        });

        nextQuestion = formatQuestion(newQuestionDoc);
      }
    }

    if (isComplete) {
      interview.status = 'completed';
      interview.completionReason = interview.completionReason || 'completed';
      interview.completedAt = new Date();
      interview.currentQuestion = null;
    } else if (nextQuestion) {
      interview.currentQuestion = {
        id: String(nextQuestion.id),
        text: nextQuestion.text,
        topic: nextQuestion.targetSkill || nextQuestion.skill,
        category: nextQuestion.category,
        difficulty: nextQuestion.difficulty,
        type: nextQuestion.type,
        expectedConcepts: nextQuestion.expectedConcepts || [],
        order: nextQuestion.order,
        starterCode: nextQuestion.starterCode,
        language: nextQuestion.language,
      };
    }

    await interview.save();

    // Save progress and finalize evaluation when complete
    if (isComplete) {
      await computeAndPersistFinalEvaluation(interview, clerkUserId);
      await saveProgress(interview, clerkUserId);
    }

    return sendSuccess(res, {
      message: 'Answer submitted successfully.',
      response: {
        id: response._id,
        textEvaluation,
        evaluation,
        multimodalEvaluation: multimodalEval,
      },
      interview: {
        id: interview._id,
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: interview.totalQuestions,
        skippedQuestionsCount: interview.skippedQuestionsCount || 0,
        durationMinutes: interview.durationMinutes || 30,
        startedAt: interview.startedAt,
        status: interview.status,
        isComplete,
        completionReason: interview.completionReason,
        adaptiveAction: 'next_question',
        currentDifficulty: adaptiveDifficulty,
        recentPerformance: newRecentPerf,
      },
      nextQuestion,
    });
  } catch (error) {
    console.error('[Interview] Submit response error:', error);
    return sendError(res, 500, 'RESPONSE_SUBMIT_FAILED', 'Could not submit answer.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SKIP QUESTION
// ─────────────────────────────────────────────────────────────────────────────

const skipQuestion = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const questionId = req.params.questionId || req.body?.questionId;
    const clerkUserId = req.clerkUserId;
    const reason = req.body?.reason || 'candidate_skipped';

    const interview = await Interview.findOne({ _id: interviewId, clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    const isAlreadyAtEnd = interview.currentQuestionIndex >= interview.totalQuestions;
    if (interview.status === 'completed' || isAlreadyAtEnd) {
      if (interview.status !== 'completed') {
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = interview.completionReason || 'all_questions_completed';
        await interview.save();
        await computeAndPersistFinalEvaluation(interview, clerkUserId);
        await saveProgress(interview, clerkUserId);
      }
      return sendSuccess(res, {
        message: 'Interview completed. All questions skipped or answered.',
        status: 'completed',
        isComplete: true,
        interview: {
          id: interview._id,
          currentQuestionIndex: interview.totalQuestions,
          totalQuestions: interview.totalQuestions,
          skippedQuestionsCount: interview.skippedQuestionsCount || interview.totalQuestions,
          durationMinutes: interview.durationMinutes || 30,
          startedAt: interview.startedAt,
          status: 'completed',
          isComplete: true,
          completionReason: interview.completionReason,
        },
        nextQuestion: null,
      });
    }

    let question = null;
    if (questionId) {
      question = await Question.findOne({ _id: questionId, interviewId: interview._id });
    } else {
      question = await Question.findOne({ interviewId: interview._id, order: interview.currentQuestionIndex });
    }
    if (!question) {
      // If question wasn't found by order, check if any pending question exists
      question = await Question.findOne({ interviewId: interview._id, status: 'pending' }).sort({ order: 1 });
    }

    if (!question) {
      // No question found at all — interview is completed
      interview.status = 'completed';
      interview.completedAt = interview.completedAt || new Date();
      interview.completionReason = 'all_questions_completed';
      await interview.save();
      await computeAndPersistFinalEvaluation(interview, clerkUserId);
      await saveProgress(interview, clerkUserId);

      return sendSuccess(res, {
        message: 'All questions completed.',
        status: 'completed',
        isComplete: true,
        interview: {
          id: interview._id,
          currentQuestionIndex: interview.totalQuestions,
          totalQuestions: interview.totalQuestions,
          skippedQuestionsCount: interview.skippedQuestionsCount,
          durationMinutes: interview.durationMinutes || 30,
          startedAt: interview.startedAt,
          status: 'completed',
          isComplete: true,
          completionReason: interview.completionReason,
        },
        nextQuestion: null,
      });
    }

    if (question.status === 'answered') {
      return sendError(res, 409, 'ALREADY_ANSWERED', 'This question has already been answered.');
    }

    if (question.status === 'skipped') {
      // If question was already skipped, do not error out! Advance to next pending question or complete
      const nextPending = await Question.findOne({
        interviewId: interview._id,
        status: 'pending',
      }).sort({ order: 1 });

      if (!nextPending) {
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = 'all_questions_skipped';
        await interview.save();
        await computeAndPersistFinalEvaluation(interview, clerkUserId);
        await saveProgress(interview, clerkUserId);

        return sendSuccess(res, {
          message: 'All questions have been skipped. Interview complete.',
          status: 'completed',
          isComplete: true,
          interview: {
            id: interview._id,
            currentQuestionIndex: interview.totalQuestions,
            totalQuestions: interview.totalQuestions,
            skippedQuestionsCount: interview.skippedQuestionsCount || interview.totalQuestions,
            durationMinutes: interview.durationMinutes || 30,
            startedAt: interview.startedAt,
            status: 'completed',
            isComplete: true,
            completionReason: interview.completionReason,
          },
          nextQuestion: null,
        });
      }

      interview.currentQuestionIndex = nextPending.order;
      await interview.save();

      return sendSuccess(res, {
        message: 'Question already skipped. Proceeding to next question.',
        status: 'skipped',
        interview: {
          id: interview._id,
          currentQuestionIndex: interview.currentQuestionIndex,
          totalQuestions: interview.totalQuestions,
          skippedQuestionsCount: interview.skippedQuestionsCount,
          durationMinutes: interview.durationMinutes || 30,
          startedAt: interview.startedAt,
          status: interview.status,
          isComplete: false,
          completionReason: interview.completionReason,
        },
        nextQuestion: formatQuestion(nextPending),
      });
    }

    // Mark question skipped
    question.status = 'skipped';
    question.skippedAt = new Date();
    question.skipReason = reason;
    await question.save();

    // Advance question index
    interview.currentQuestionIndex += 1;
    interview.skippedQuestionsCount = (interview.skippedQuestionsCount || 0) + 1;

    // Check if more questions exist
    let nextQuestionDoc = await Question.findOne({
      interviewId: interview._id,
      order: interview.currentQuestionIndex,
      status: 'pending',
    });

    if (!nextQuestionDoc && interview.currentQuestionIndex < interview.totalQuestions) {
      // Try finding any remaining pending question
      nextQuestionDoc = await Question.findOne({
        interviewId: interview._id,
        status: 'pending',
      }).sort({ order: 1 });

      if (nextQuestionDoc) {
        interview.currentQuestionIndex = nextQuestionDoc.order;
      } else {
        // Dynamically generate the next personalized question on skip
        const pastQuestions = await Question.find({
          $or: [{ interviewId: interview._id }, { clerkUserId }],
        }).select('text').lean();
        const pastQuestionTexts = pastQuestions.map(q => q.text);

        const allSkills = [
          ...(interview.skillAnalysis?.matchedSkills || []),
          ...(interview.skillAnalysis?.missingSkills || []),
          ...(interview.skillAnalysis?.strongSkills || []),
          ...(interview.skillAnalysis?.partialSkills || []),
        ];
        const coverageMap = interview.topicCoverage ? Object.fromEntries(interview.topicCoverage) : {};
        const nextTopic = selectNextAdaptiveTopic({
          skillGapProfile: {
            strongSkills: interview.skillAnalysis?.strongSkills || interview.skillAnalysis?.matchedSkills || [],
            partialSkills: interview.skillAnalysis?.partialSkills || [],
            missingSkills: interview.skillAnalysis?.missingSkills || [],
          },
          topicCoverage: coverageMap,
          allTargetSkills: allSkills.length > 0 ? allSkills : [interview.targetRole],
          currentTopic: question.targetSkill || question.skill,
        });

        const generatedQ = generateNextPersonalizedQuestion({
          targetRole: interview.targetRole,
          interviewType: interview.interviewType,
          topic: nextTopic,
          difficulty: interview.difficulty || 'medium',
          order: interview.currentQuestionIndex,
          pastQuestionTexts,
          recentPerformance: interview.recentPerformance || [],
        });

        nextQuestionDoc = await Question.create({
          interviewId: interview._id,
          clerkUserId,
          ...generatedQ,
          targetSkill: nextTopic,
          skill: nextTopic,
          status: 'pending',
        });
      }
    }

    const isComplete = !nextQuestionDoc || interview.currentQuestionIndex >= interview.totalQuestions;

    if (isComplete) {
      interview.status = 'completed';
      interview.completionReason = interview.skippedQuestionsCount >= interview.totalQuestions
        ? 'all_questions_skipped'
        : 'final_question_skipped';
      interview.completedAt = new Date();
      interview.currentQuestion = null;
      await interview.save();
      await computeAndPersistFinalEvaluation(interview, clerkUserId);
      await saveProgress(interview, clerkUserId);
    } else {
      if (nextQuestionDoc) {
        interview.currentQuestion = {
          id: String(nextQuestionDoc._id),
          text: nextQuestionDoc.text,
          topic: nextQuestionDoc.targetSkill || nextQuestionDoc.skill,
          category: nextQuestionDoc.category,
          difficulty: nextQuestionDoc.difficulty,
          type: nextQuestionDoc.type,
          expectedConcepts: nextQuestionDoc.expectedConcepts || [],
          order: nextQuestionDoc.order,
          starterCode: nextQuestionDoc.starterCode,
          language: nextQuestionDoc.language,
        };
      }
      await interview.save();
    }

    return sendSuccess(res, {
      message: isComplete ? 'All questions finished. Interview completed.' : 'Question skipped successfully.',
      status: isComplete ? 'completed' : 'skipped',
      isComplete,
      interview: {
        id: interview._id,
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: interview.totalQuestions,
        skippedQuestionsCount: interview.skippedQuestionsCount,
        durationMinutes: interview.durationMinutes || 30,
        startedAt: interview.startedAt,
        status: interview.status,
        isComplete,
        completionReason: interview.completionReason,
      },
      nextQuestion: nextQuestionDoc ? formatQuestion(nextQuestionDoc) : null,
    });
  } catch (error) {
    console.error('[Interview] Skip question error:', error);
    return sendError(res, 500, 'SKIP_FAILED', 'Could not skip question.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT AUDIO RESPONSE (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────

const submitAudioResponse = async (req, res) => {
  const audioPath = req.file?.path;
  try {
    const { questionId, responseId } = req.body;
    const clerkUserId = req.clerkUserId;

    if (!req.file) return sendError(res, 400, 'NO_AUDIO', 'No audio file provided.');

    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId });
    if (!interview) {
      deleteFile(audioPath);
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    }

    // Update modality availability
    interview.modalityAvailability.audio = true;
    await interview.save();

    // Find or create response
    let response = responseId
      ? await Response.findOne({ _id: responseId, interviewId: interview._id, clerkUserId })
      : await Response.findOne({ questionId, interviewId: interview._id, clerkUserId });

    if (!response) {
      deleteFile(audioPath);
      return sendError(res, 404, 'RESPONSE_NOT_FOUND', 'Submit text answer first before attaching audio.');
    }

    // ── Phase 5: Audio analysis ─────────────────────────────────────────────
    const audioResult = await evaluateAudio(audioPath);

    // Update response
    response.audioFilePath = audioPath;
    response.audioFileSize = req.file.size;
    response.audioEvaluation = {
      speakingDuration: audioResult.speakingDuration || null,
      pauseDuration: audioResult.pauseDuration || null,
      speechRate: audioResult.speechRate || null,
      mfccSummary: audioResult.mfccSummary || null,
      energyCharacteristics: audioResult.energyCharacteristics || null,
      pitchStatistics: audioResult.pitchStatistics || null,
      audioFeaturesAvailable: audioResult.audioFeaturesAvailable || false,
      modelStatus: audioResult.modelStatus || 'processed',
    };

    // Rebuild multimodal evaluation with audio
    if (audioResult.audioFeaturesAvailable) {
      response.multimodalEvaluation = buildEvaluation(response.textEvaluation, audioResult, null);
    }

    await response.save();

    if (interview.status === 'completed') {
      await computeAndPersistFinalEvaluation(interview, clerkUserId);
    }

    return sendSuccess(res, {
      message: 'Audio submitted and analyzed.',
      audioEvaluation: response.audioEvaluation,
      multimodalEvaluation: response.multimodalEvaluation,
    });
  } catch (error) {
    deleteFile(audioPath);
    console.error('[Interview] Audio submit error:', error);
    return sendError(res, 500, 'AUDIO_SUBMIT_FAILED', 'Could not process audio.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT VIDEO RESPONSE (Phase 6)
// ─────────────────────────────────────────────────────────────────────────────

const submitVideoResponse = async (req, res) => {
  // Video files are processing-only artifacts. The raw recording must never be
  // retained after this request, regardless of analysis/DB success or failure.
  const videoPath = req.file?.path;
  try {
    const { questionId, responseId } = req.body;
    const clerkUserId = req.clerkUserId;

    if (!req.file) return sendError(res, 400, 'NO_VIDEO', 'No video file provided.');

    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId });
    if (!interview) {
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    }

    interview.modalityAvailability.video = true;
    await interview.save();

    let response = responseId
      ? await Response.findOne({ _id: responseId, interviewId: interview._id, clerkUserId })
      : await Response.findOne({ questionId, interviewId: interview._id, clerkUserId });

    if (!response) {
      return sendError(res, 404, 'RESPONSE_NOT_FOUND', 'Submit text answer first before attaching video.');
    }

    // ── Phase 6: Video analysis ─────────────────────────────────────────────
    const videoResult = await evaluateVideo(videoPath);

    // Do not persist the local path: the raw video is deleted in finally{}.
    response.videoFilePath = null;
    response.videoFileSize = req.file.size;
    response.videoEvaluation = {
      framesProcessed: videoResult.framesProcessed ?? 0,
      personDetectionRatio: videoResult.personDetectionRatio ?? null,
      faceVisibilityRatio: videoResult.faceVisibilityRatio ?? null,
      gazeAttentionRatio: videoResult.gazeAttentionRatio ?? null,
      postureStability: videoResult.postureStability || null,
      postureStabilityIndex: videoResult.postureStabilityIndex ?? null,
      postureScore: videoResult.postureScore ?? null,
      shoulderTiltDegrees: videoResult.shoulderTiltDegrees ?? null,
      cameraEngagement: videoResult.cameraEngagement || null,
      observableMetrics: videoResult.metrics || videoResult.observableMetrics || null,
      videoQualityIndicator: videoResult.videoQualityIndicator || null,
      modelStatus: videoResult.modelStatus || 'processed',
      processingConfidence: videoResult.processingConfidence ?? null,
      visibleMovement: videoResult.metrics?.movement_stability_index != null
        ? (videoResult.metrics.movement_stability_index >= 80 ? 'stable' : 'visible_movement')
        : null,
      feedback: videoResult.feedback || videoResult.metrics?.observable_observations?.join(' ') || null,
    };

    await response.save();

    if (interview.status === 'completed') {
      await computeAndPersistFinalEvaluation(interview, clerkUserId);
    }

    return sendSuccess(res, {
      message: 'Video submitted and analyzed.',
      videoEvaluation: response.videoEvaluation,
    });
  } catch (error) {
    console.error('[Interview] Video submit error:', error);
    return sendError(res, 500, 'VIDEO_SUBMIT_FAILED', 'Could not process video.', error.message);
  } finally {
    // Always remove the raw recording after processing. This also runs for
    // validation failures, AI failures, DB failures, and early returns.
    deleteFile(videoPath);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// COMPUTE AND PERSIST FINAL EVALUATION (Synchronous / Idempotent Helper)
// ─────────────────────────────────────────────────────────────────────────────

const computeAndPersistFinalEvaluation = async (interview, clerkUserId) => {
  const interviewId = interview._id || interview.id;
  const userId = clerkUserId || interview.clerkUserId;

  const [allQuestions, responses, skillAnalysis] = await Promise.all([
    Question.find({ interviewId }).sort({ order: 1 }).lean(),
    Response.find({ interviewId, clerkUserId: userId }).lean(),
    interview.skillAnalysisId
      ? SkillAnalysis.findById(interview.skillAnalysisId).lean()
      : null,
  ]);

  // Determine modality statuses across responses without fabricated metrics
  let audioStatus = 'unavailable';
  let videoStatus = 'unavailable';
  let hasPendingAudio = false;
  let hasPendingVideo = false;

  for (const r of responses) {
    if (r.audioEvaluation?.modelStatus === 'processing' || r.audioEvaluation?.modelStatus === 'pending') {
      hasPendingAudio = true;
    }
    if (r.videoEvaluation?.modelStatus === 'processing' || r.videoEvaluation?.modelStatus === 'pending') {
      hasPendingVideo = true;
    }
    if (
      r.audioEvaluation?.audioFeaturesAvailable ||
      (r.audioEvaluation?.speakingDuration !== null && r.audioEvaluation?.speakingDuration !== undefined && r.audioEvaluation?.speakingDuration > 0)
    ) {
      audioStatus = 'available';
    }
    if (
      (r.videoEvaluation?.framesProcessed && r.videoEvaluation.framesProcessed > 0) ||
      (r.videoEvaluation?.personDetectionRatio !== null && r.videoEvaluation?.personDetectionRatio !== undefined)
    ) {
      videoStatus = 'available';
    }
  }

  if (hasPendingAudio) audioStatus = 'processing';
  if (hasPendingVideo) videoStatus = 'processing';

  // Filter scored responses for aggregation
  const scoredResponses = responses.filter(
    (r) => (r.textEvaluation?.textScore !== null && r.textEvaluation?.textScore !== undefined) ||
           (r.evaluation?.score !== null && r.evaluation?.score !== undefined)
  );

  const textStatus = scoredResponses.length > 0 ? 'available' : (responses.length > 0 ? 'processing' : 'unavailable');

  const aggregated = aggregateInterviewScore(scoredResponses);
  const fusion = aggregateInterviewFusion(scoredResponses);

  const answeredCount = responses.length;
  const skippedCount = allQuestions.filter((q) => q.status === 'skipped').length;
  const totalCount = allQuestions.length || interview.totalQuestions || 5;

  let jobReadiness = null;
  try {
    jobReadiness = calculateJobReadiness({
      skillCoveragePercentage: skillAnalysis?.skillCoveragePercentage || 0,
      overallScore: fusion.overallScore || 0,
      questionsAnswered: answeredCount,
      totalQuestions: totalCount,
    });
  } catch (e) {
    // Non-critical fallback
  }

  const isMediaProcessing = audioStatus === 'processing' || videoStatus === 'processing';
  const evalStatus = isMediaProcessing
    ? 'pending'
    : (scoredResponses.length > 0 || allQuestions.length > 0 ? 'ready' : 'unavailable');

  const technicalScore = fusion.technicalScore ?? (aggregated.overallScore || 0);
  const overallScore = fusion.overallScore ?? (aggregated.overallScore || 0);

  const finalEval = {
    status: evalStatus,
    audioStatus,
    videoStatus,
    textStatus,
    overallScore,
    technicalScore,
    problemSolvingScore: Math.round(technicalScore * 0.95),
    communicationScore: Math.round(technicalScore * 0.98),
    audioScore: fusion.audioScore ?? null,
    videoScore: fusion.videoScore ?? null,
    modalitiesUsed: fusion.modalitiesUsed || ['text'],
    jobReadinessScore: jobReadiness?.score ?? null,
    jobReadinessLabel: jobReadiness?.label ?? null,
    skillScores: interview.interviewState?.skillPerformance || {},
    strongAreas: interview.interviewState?.strongAreas || [],
    weakAreas: interview.interviewState?.weakAreas || [],
    skillGaps: interview.skillAnalysis?.missingSkills || [],
    questionsAnswered: answeredCount,
    questionsSkipped: skippedCount,
    totalQuestions: totalCount,
    completionReason: interview.completionReason || 'completed',
    isDevelopmentEvaluation: aggregated.isDevelopmentEvaluation,
    sbertEvaluated: aggregated.sbertEvaluated || 0,
    notice: aggregated.notice,
    completedAt: interview.completedAt || new Date(),
  };

  // Persist directly to interview document
  await Interview.updateOne(
    { _id: interviewId, clerkUserId: userId },
    { $set: { finalEvaluation: finalEval } }
  );

  if (interview && typeof interview.save === 'function') {
    interview.finalEvaluation = finalEval;
  }

  return finalEval;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE INTERVIEW
// ─────────────────────────────────────────────────────────────────────────────

const completeInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    const completionReason = req.body.completionReason || interview.completionReason || 'completed';

    if (interview.status === 'completed' && interview.finalEvaluation?.status === 'ready') {
      return sendSuccess(res, {
        message: 'Interview already completed.',
        interviewId: interview._id,
        completionReason: interview.completionReason,
        finalEvaluationStatus: interview.finalEvaluation.status,
      });
    }

    interview.status = 'completed';
    interview.completionReason = completionReason;
    interview.completedAt = interview.completedAt || new Date();
    await interview.save();

    // Synchronously compute and persist finalEvaluation before returning
    const finalEvaluation = await computeAndPersistFinalEvaluation(interview, req.clerkUserId);
    await saveProgress(interview, req.clerkUserId);

    return sendSuccess(res, {
      message: 'Interview completed.',
      interviewId: interview._id,
      completionReason,
      finalEvaluationStatus: finalEvaluation.status,
    });
  } catch (error) {
    console.error('[Interview] Complete interview error:', error);
    return sendError(res, 500, 'COMPLETE_FAILED', 'Could not complete interview.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET RESULTS (Fast, Read-Oriented with Synchronous Fallback)
// ─────────────────────────────────────────────────────────────────────────────

const getResults = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId }).lean();
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    // Parallel fetch questions, responses, and skill analysis with .lean() for maximum query speed
    const [allQuestions, responses, skillAnalysis] = await Promise.all([
      Question.find({ interviewId: interview._id }).sort({ order: 1 }).lean(),
      Response.find({ interviewId: interview._id, clerkUserId: req.clerkUserId }).lean(),
      interview.skillAnalysisId
        ? SkillAnalysis.findById(interview.skillAnalysisId).lean()
        : null,
    ]);

    const responseByQuestionId = new Map();
    for (const r of responses) {
      responseByQuestionId.set(String(r.questionId), r);
    }

    const answeredCount = responses.length;
    const skippedCount = allQuestions.filter((q) => q.status === 'skipped').length;
    const totalCount = allQuestions.length || interview.totalQuestions;

    // Fast read-oriented path:
    // If finalEvaluation is already stored and ready, reuse it directly without expensive re-calculation
    let finalEval = interview.finalEvaluation;
    const isReady =
      finalEval &&
      finalEval.status === 'ready' &&
      finalEval.overallScore !== null &&
      finalEval.overallScore !== undefined;

    if (!isReady) {
      // Missing or pending evaluation: compute and persist directly
      finalEval = await computeAndPersistFinalEvaluation(interview, req.clerkUserId);
    }

    // Build per-question breakdown for all questions (including skipped)
    const questionBreakdown = allQuestions.map((q, i) => {
      const resp = responseByQuestionId.get(String(q._id));
      const isSkipped = q.status === 'skipped';

      return {
        questionNumber: i + 1,
        questionId: q._id,
        question: q.text || 'Unknown question',
        category: q.category,
        type: q.type,
        difficulty: q.difficulty,
        targetSkill: q.targetSkill || q.skill,
        contextNote: q.contextNote,
        starterCode: q.starterCode,
        language: q.language || resp?.language,
        status: isSkipped ? 'skipped' : (resp ? 'answered' : 'pending'),
        answerText: isSkipped ? null : (resp?.answerText || null),
        code: resp?.code || null,
        responseType: resp?.responseType || (q.type === 'coding' ? 'coding' : 'text'),
        textEvaluation: resp?.textEvaluation || null,
        audioEvaluation: resp?.audioEvaluation || null,
        videoEvaluation: resp?.videoEvaluation || null,
        multimodalEvaluation: resp?.multimodalEvaluation || null,
        evaluation: resp?.evaluation || null,
        score: isSkipped ? null : (resp?.textEvaluation?.textScore ?? resp?.evaluation?.score ?? null),
      };
    });

    // Skill performance breakdown
    const skillPerformance = interview.interviewState?.skillPerformance || {};
    const skillAnalysisData = interview.skillAnalysis || {};

    // Job readiness: use persisted score if present or compute fast fallback
    let jobReadiness = null;
    if (finalEval.jobReadinessScore !== null && finalEval.jobReadinessScore !== undefined) {
      jobReadiness = {
        score: finalEval.jobReadinessScore,
        label: finalEval.jobReadinessLabel || 'Standard',
      };
    } else {
      try {
        jobReadiness = calculateJobReadiness({
          skillCoveragePercentage: skillAnalysis?.skillCoveragePercentage || 0,
          overallScore: finalEval.overallScore || 0,
          questionsAnswered: answeredCount,
          totalQuestions: totalCount,
        });
      } catch (e) { /* not critical */ }
    }

    // ── Cache headers ──────────────────────────────────────────────────────────
    // Completed interviews are immutable: their results will never change.
    // Give browsers a private, long-lived cache so repeated visits / back-navigation
    // hit memory/disk cache without making a network round-trip at all.
    // Pending evaluations must NOT be cached – polling needs a fresh response every time.
    if (interview.status === 'completed' && finalEval?.status === 'ready') {
      // private: per-user, not shared CDN-cacheable (Clerk auth header differentiates users)
      // max-age=31536000: 1 year – effectively immutable
      // immutable: tells browser never to revalidate during its lifetime
      res.set('Cache-Control', 'private, max-age=31536000, immutable');
      res.set('Vary', 'Authorization'); // key cache per-session so different users don't share
    } else {
      // Pending evaluation: no caching – ResultsPage must poll for fresh status
      res.set('Cache-Control', 'no-store');
    }

    return sendSuccess(res, {
      interview: {
        id: interview._id,
        targetRole: interview.targetRole,
        interviewType: interview.interviewType,
        difficulty: interview.difficulty,
        status: interview.status,
        durationMinutes: interview.durationMinutes || 30,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
        completionReason: interview.completionReason,
        questionGenerationSource: interview.questionGenerationSource,
        modalityAvailability: interview.modalityAvailability,
      },
      finalEvaluation: finalEval,
      jobReadiness,
      skillPerformance,
      questionBreakdown,
      resumeSkillAlignment: skillAnalysisData,
    });
  } catch (error) {
    console.error('[Interview] Results error:', error);
    return sendError(res, 500, 'RESULTS_FETCH_FAILED', 'Could not retrieve results.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ROADMAP (Phase 10)
// ─────────────────────────────────────────────────────────────────────────────

const getRoadmap = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId }).lean();
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    const skillAnalysis = interview.skillAnalysisId
      ? await SkillAnalysis.findById(interview.skillAnalysisId).lean()
      : null;

    const skillPerformance = interview.interviewState?.skillPerformance || {};
    const finalEval = interview.finalEvaluation || {};

    const roadmap = generateRoadmap({
      skillPerformance,
      missingSkills: skillAnalysis?.notIdentifiedRequiredSkills || interview.skillAnalysis?.missingSkills || [],
      matchedSkills: skillAnalysis?.matchedRequiredSkills || interview.skillAnalysis?.matchedSkills || [],
      preferredSkills: skillAnalysis?.matchedPreferredSkills || [],
      finalEvaluation: finalEval,
    });

    return sendSuccess(res, { roadmap });
  } catch (error) {
    console.error('[Interview] Roadmap error:', error);
    return sendError(res, 500, 'ROADMAP_FAILED', 'Could not generate roadmap.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: Save progress record
// ─────────────────────────────────────────────────────────────────────────────

const saveProgress = async (interview, clerkUserId) => {
  try {
    const responses = await Response.find({ interviewId: interview._id, clerkUserId });
    const aggregated = aggregateInterviewScore(responses);
    const fusion = aggregateInterviewFusion(responses);
    const state = interview.interviewState || {};

    // Build skill scores map
    const skillScores = new Map();
    if (state.skillPerformance && typeof state.skillPerformance.entries === 'function') {
      for (const [skill, perf] of state.skillPerformance.entries()) {
        if (perf && typeof perf.score === 'number') {
          skillScores.set(skill, perf.score);
        }
      }
    } else if (state.skillPerformance && typeof state.skillPerformance === 'object') {
      for (const [skill, perf] of Object.entries(state.skillPerformance)) {
        if (perf && typeof perf.score === 'number') {
          skillScores.set(skill, perf.score);
        }
      }
    }

    await Progress.create({
      clerkUserId,
      interviewId: interview._id,
      targetRole: interview.targetRole,
      overallScore: fusion.overallScore || aggregated.overallScore,
      technicalScore: fusion.technicalScore,
      skillScores,
      questionsAnswered: responses.length,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      modalitiesUsed: fusion.modalitiesUsed,
      isDevelopmentEvaluation: aggregated.isDevelopmentEvaluation,
      strongAreas: state.strongAreas || [],
      improvementAreas: state.weakAreas || [],
      skillGaps: interview.skillAnalysis?.missingSkills || [],
      completedAt: interview.completedAt || new Date(),
    });
  } catch (err) {
    console.error('[Interview] saveProgress error:', err.message);
    // Non-fatal
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN ME (Targeted training generated from interview weaknesses)
// ─────────────────────────────────────────────────────────────────────────────

const trainInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    // If already generated a training session for this interview, return it
    if (interview.trainingSessionId) {
      const existingSession = await TrainingSession.findOne({
        _id: interview.trainingSessionId,
        clerkUserId: req.clerkUserId,
      });
      if (existingSession) {
        return sendSuccess(res, { trainingSession: existingSession });
      }
    }

    // Collect weaknesses from responses and final evaluation
    const responses = await Response.find({ interviewId: interview._id, clerkUserId: req.clerkUserId });
    const weaknesses = new Set(interview.finalEvaluation?.weakAreas || interview.interviewState?.weakAreas || []);
    
    for (const r of responses) {
      if (r.textEvaluation?.weaknesses) {
        r.textEvaluation.weaknesses.forEach(w => weaknesses.add(w));
      }
    }

    const skillGaps = interview.finalEvaluation?.skillGaps || interview.skillAnalysis?.missingSkills || [];
    const score = interview.finalEvaluation?.overallScore || 70;

    const trainingSession = await generateTrainingSession({
      clerkUserId: req.clerkUserId,
      interview,
      score,
      weaknesses: Array.from(weaknesses),
      skillGaps,
    });

    interview.trainingSessionId = trainingSession._id;
    await interview.save();

    return sendSuccess(res, {
      message: 'Targeted training modules generated successfully.',
      trainingSession,
    }, 201);
  } catch (error) {
    console.error('[Interview] Train error:', error);
    return sendError(res, 500, 'TRAIN_FAILED', 'Could not generate training session.', error.message);
  }
};

const getTrainingSession = async (req, res) => {
  try {
    const session = await TrainingSession.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!session) return sendError(res, 404, 'TRAINING_NOT_FOUND', 'Training session not found.');
    return sendSuccess(res, { trainingSession: session });
  } catch (error) {
    return sendError(res, 500, 'TRAINING_FETCH_FAILED', 'Could not retrieve training session.', error.message);
  }
};

/**
 * POST /api/interviews/:id/re-interview
 *
 * Creates a brand new Interview attempt preserving candidate context,
 * generating fresh questions while avoiding questions from the previous attempt.
 */
const reInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const clerkUserId = req.clerkUserId;

    const prevInterview = await Interview.findOne({ _id: id, clerkUserId });
    if (!prevInterview) {
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Previous interview not found or unauthorized.');
    }

    // Retrieve previous questions for deduplication
    const prevQuestions = await Question.find({ interviewId: prevInterview._id }).select('text');
    const prevQuestionTexts = new Set(prevQuestions.map((q) => q.text.toLowerCase().trim()));

    // Load resume & JD if available to preserve candidate context
    let resume = null;
    let job = null;
    let skillAnalysis = null;

    if (prevInterview.resumeId) {
      resume = await Resume.findOne({ _id: prevInterview.resumeId, clerkUserId });
    }
    if (prevInterview.jobDescriptionId) {
      job = await JobDescription.findOne({ _id: prevInterview.jobDescriptionId, clerkUserId });
    }
    if (prevInterview.skillAnalysisId) {
      skillAnalysis = await SkillAnalysis.findOne({ _id: prevInterview.skillAnalysisId, clerkUserId });
    }

    const candidateProfile = resume?.analysis || resume?.parsedData || {};
    const jobProfile = job?.analysis || job?.parsedData || {};

    const totalQuestions = prevInterview.totalQuestions || 10;
    const difficulty = prevInterview.difficulty || 'medium';
    const interviewType = prevInterview.interviewType || 'mixed';
    const durationMinutes = prevInterview.durationMinutes || 30;

    // Create the new interview attempt
    const newInterview = await Interview.create({
      clerkUserId,
      resumeId: prevInterview.resumeId || null,
      jobDescriptionId: prevInterview.jobDescriptionId || null,
      skillAnalysisId: prevInterview.skillAnalysisId || null,
      targetRole: prevInterview.targetRole || job?.targetRole || 'Software Engineer',
      interviewType,
      difficulty,
      totalQuestions: Math.min(totalQuestions, 15),
      durationMinutes,
      status: 'created',
      skillAnalysis: prevInterview.skillAnalysis || {},
    });

    // Generate personalized questions
    let questionData = [];
    const hasPersonalizationData = (
      candidateProfile.skills?.length > 0 ||
      candidateProfile.extractedSkills?.length > 0 ||
      skillAnalysis !== null
    );

    if (hasPersonalizationData) {
      questionData = generateInterviewQuestions({
        candidateProfile,
        jobProfile,
        skillAnalysis: skillAnalysis || {},
        interviewType,
        difficulty,
        totalQuestions: newInterview.totalQuestions * 2, // oversample to allow deduplication against prior interview
      });
    }

    // Deduplicate against previous interview questions
    let filteredQuestions = questionData.filter((q) => !prevQuestionTexts.has(q.text.toLowerCase().trim()));

    // If we need more questions, pull from bank and filter out previously asked questions
    if (filteredQuestions.length < newInterview.totalQuestions) {
      const { getQuestionsForInterview } = require('../services/questionService');
      const fallback = getQuestionsForInterview(interviewType, difficulty, newInterview.totalQuestions * 3);
      for (const q of fallback) {
        if (!prevQuestionTexts.has(q.text.toLowerCase().trim())) {
          filteredQuestions.push({
            ...q,
            type: q.category || 'technical',
            source: 'static_bank',
            targetSkill: q.skill,
            expectedConcepts: q.expectedKeyPoints || [],
            followUpAllowed: true,
            contextNote: null,
          });
        }
        if (filteredQuestions.length >= newInterview.totalQuestions) break;
      }
    }

    // If still insufficient (e.g. extremely small static bank), allow any remaining unique questions
    if (filteredQuestions.length < newInterview.totalQuestions) {
      for (const q of questionData) {
        if (!filteredQuestions.some((fq) => fq.text === q.text)) {
          filteredQuestions.push(q);
        }
        if (filteredQuestions.length >= newInterview.totalQuestions) break;
      }
    }

    // Ensure within-set uniqueness and trim
    const seen = new Set();
    const unique = [];
    for (const q of filteredQuestions) {
      if (!seen.has(q.text)) {
        seen.add(q.text);
        unique.push(q);
      }
      if (unique.length >= newInterview.totalQuestions) break;
    }

    await Question.insertMany(
      unique.map((q, index) => ({
        interviewId: newInterview._id,
        clerkUserId,
        text: q.text,
        type: q.type || q.category || 'technical',
        category: q.category || 'technical',
        difficulty: q.difficulty || difficulty,
        targetSkill: q.targetSkill || q.skill || null,
        skill: q.skill || q.targetSkill || 'general',
        source: q.source || 'static_bank',
        sourceProject: q.sourceProject || null,
        expectedConcepts: q.expectedConcepts || q.expectedKeyPoints || [],
        expectedKeyPoints: q.expectedKeyPoints || q.expectedConcepts || [],
        followUpAllowed: q.followUpAllowed !== false,
        contextNote: q.contextNote || null,
        starterCode: q.starterCode || null,
        language: q.language || 'javascript',
        order: index + 1,
        status: 'pending',
      }))
    );

    newInterview.totalQuestions = unique.length;
    await newInterview.save();

    console.log(`[InterviewController] Re-Interview created: new interview "${newInterview._id}" (from previous "${prevInterview._id}") with ${unique.length} fresh questions.`);

    return sendSuccess(res, {
      message: 'New interview session created successfully.',
      interviewId: newInterview._id,
      interview: newInterview,
    }, 201);
  } catch (err) {
    console.error('[InterviewController] Re-interview error:', err);
    return sendError(res, 500, 'RE_INTERVIEW_FAILED', 'Could not create new interview session.', err.message);
  }
};

module.exports = {
  createInterview,
  getUserInterviews,
  getInterview,
  startInterview,
  getCurrentQuestion,
  submitResponse,
  skipQuestion,
  submitAudioResponse,
  submitVideoResponse,
  completeInterview,
  getResults,
  getRoadmap,
  trainInterview,
  getTrainingSession,
  reInterview,
  computeAndPersistFinalEvaluation,
};
