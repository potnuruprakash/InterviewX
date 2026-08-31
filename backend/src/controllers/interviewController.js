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
const { sendError, sendSuccess } = require('../utils/errorHandler');
const { validateCreateInterview, validateSubmitResponse } = require('../utils/validators');
const { generateInterviewQuestions, generateFollowUpQuestion } = require('../services/questionService');
const { evaluateResponse, evaluateAudio, evaluateVideo, aggregateInterviewScore } = require('../services/evaluationService');
const { aggregateInterviewFusion, buildEvaluation } = require('../services/multimodalFusionService');
const { updateSkillPerformance, determineAdaptiveAction, shouldStopInterview } = require('../services/adaptiveEngineService');
const { generateRoadmap, calculateJobReadiness } = require('../services/roadmapService');
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

    const candidateProfile = resume.analysis || {};
    const jobProfile = job.analysis || {};

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
    if (interview.status === 'completed') {
      return sendError(res, 400, 'INTERVIEW_ALREADY_COMPLETED', 'This interview has already been completed.');
    }

    if (interview.status === 'created') {
      interview.status = 'in_progress';
      interview.startedAt = new Date();
      await interview.save();
    }

    const firstQuestion = await Question.findOne({
      interviewId: interview._id,
      order: interview.currentQuestionIndex,
    });

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

    // Save response
    const response = await Response.create({
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

    // Mark question as answered
    question.status = 'answered';
    await question.save();

    // ── Adaptive engine ─────────────────────────────────────────────
    const responseScore = textEvaluation.textScore || evaluation.score || 0;
    const skill = question.targetSkill || question.skill || 'general';

    let updatedState = interview.interviewState || {};
    updatedState = updateSkillPerformance(updatedState, skill, responseScore);

    const { shouldFollowUp, missingConcepts, nextDifficulty } = determineAdaptiveAction({
      score: responseScore,
      currentQuestion: question,
      textEvaluation,
      currentState: updatedState,
    });

    // Advance question index
    interview.currentQuestionIndex += 1;

    // Update adaptive state
    interview.interviewState = {
      ...updatedState,
      currentDifficulty: nextDifficulty,
    };

    // Check stop conditions
    const { shouldStop } = shouldStopInterview(interview);
    const isComplete = shouldStop || interview.currentQuestionIndex >= interview.totalQuestions;

    // Generate follow-up question if needed and not stopping
    let nextQuestion = null;
    if (!isComplete && shouldFollowUp && missingConcepts.length > 0) {
      const followUpData = generateFollowUpQuestion(question, textToEvaluate, missingConcepts);
      const followUpOrder = interview.totalQuestions; // append after existing
      const followUp = await Question.create({
        interviewId: interview._id,
        clerkUserId,
        ...followUpData,
        order: followUpOrder,
        parentQuestionId: question._id,
      });
      interview.totalQuestions += 1;
      nextQuestion = formatQuestion(followUp);
    }

    if (isComplete) {
      interview.status = 'completed';
      interview.completionReason = interview.completionReason || 'completed';
      interview.completedAt = new Date();
    }

    await interview.save();

    // Get next question if not follow-up and not complete
    if (!nextQuestion && !isComplete) {
      nextQuestion = formatQuestion(
        await Question.findOne({ interviewId: interview._id, order: interview.currentQuestionIndex })
      );
    }

    // Save progress when complete
    if (isComplete) {
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
        adaptiveAction: shouldFollowUp ? 'follow_up_added' : 'next_question',
        currentDifficulty: interview.interviewState?.currentDifficulty,
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
    const questionId = req.params.questionId || req.body.questionId;
    const clerkUserId = req.clerkUserId;
    const reason = req.body.reason || 'candidate_skipped';

    const interview = await Interview.findOne({ _id: interviewId, clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    if (interview.status === 'completed') {
      return sendError(res, 400, 'INTERVIEW_COMPLETED', 'This interview is already completed.');
    }

    let question = null;
    if (questionId) {
      question = await Question.findOne({ _id: questionId, interviewId: interview._id });
    } else {
      question = await Question.findOne({ interviewId: interview._id, order: interview.currentQuestionIndex });
    }
    if (!question) return sendError(res, 404, 'QUESTION_NOT_FOUND', 'Question not found in this interview.');

    if (question.status === 'answered') {
      return sendError(res, 409, 'ALREADY_ANSWERED', 'This question has already been answered.');
    }
    if (question.status === 'skipped') {
      return sendError(res, 409, 'ALREADY_SKIPPED', 'This question has already been skipped.');
    }

    // Mark question skipped
    question.status = 'skipped';
    question.skippedAt = new Date();
    question.skipReason = reason;
    await question.save();

    // Advance question index
    interview.currentQuestionIndex += 1;
    interview.skippedQuestionsCount = (interview.skippedQuestionsCount || 0) + 1;

    // Check completeness
    const isComplete = interview.currentQuestionIndex >= interview.totalQuestions;
    let nextQuestion = null;

    if (isComplete) {
      interview.status = 'completed';
      interview.completionReason = 'final_question_skipped';
      interview.completedAt = new Date();
      await saveProgress(interview, clerkUserId);
    } else {
      nextQuestion = formatQuestion(
        await Question.findOne({ interviewId: interview._id, order: interview.currentQuestionIndex })
      );
    }

    await interview.save();

    return sendSuccess(res, {
      message: 'Question skipped successfully.',
      status: 'skipped',
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
      nextQuestion,
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
  const videoPath = req.file?.path;
  try {
    const { questionId, responseId } = req.body;
    const clerkUserId = req.clerkUserId;

    if (!req.file) return sendError(res, 400, 'NO_VIDEO', 'No video file provided.');

    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId });
    if (!interview) {
      deleteFile(videoPath);
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    }

    interview.modalityAvailability.video = true;
    await interview.save();

    let response = responseId
      ? await Response.findOne({ _id: responseId, interviewId: interview._id, clerkUserId })
      : await Response.findOne({ questionId, interviewId: interview._id, clerkUserId });

    if (!response) {
      deleteFile(videoPath);
      return sendError(res, 404, 'RESPONSE_NOT_FOUND', 'Submit text answer first before attaching video.');
    }

    // ── Phase 6: Video analysis ─────────────────────────────────────────────
    const videoResult = await evaluateVideo(videoPath);

    response.videoFilePath = videoPath;
    response.videoFileSize = req.file.size;
    response.videoEvaluation = {
      framesProcessed: videoResult.framesProcessed || 0,
      personDetectionRatio: videoResult.personDetectionRatio || null,
      faceVisibilityRatio: videoResult.faceVisibilityRatio || null,
      videoQualityIndicator: videoResult.videoQualityIndicator || null,
      modelStatus: videoResult.modelStatus || 'processed',
      processingConfidence: videoResult.processingConfidence || null,
    };

    await response.save();

    return sendSuccess(res, {
      message: 'Video submitted and analyzed.',
      videoEvaluation: response.videoEvaluation,
    });
  } catch (error) {
    deleteFile(videoPath);
    console.error('[Interview] Video submit error:', error);
    return sendError(res, 500, 'VIDEO_SUBMIT_FAILED', 'Could not process video.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE INTERVIEW
// ─────────────────────────────────────────────────────────────────────────────

const completeInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    if (interview.status === 'completed') {
      return sendSuccess(res, {
        message: 'Interview already completed.',
        interviewId: interview._id,
        completionReason: interview.completionReason,
      });
    }

    const completionReason = req.body.completionReason || interview.completionReason || 'completed';
    interview.status = 'completed';
    interview.completionReason = completionReason;
    interview.completedAt = new Date();
    await interview.save();

    await saveProgress(interview, req.clerkUserId);

    return sendSuccess(res, {
      message: 'Interview completed.',
      interviewId: interview._id,
      completionReason,
    });
  } catch (error) {
    return sendError(res, 500, 'COMPLETE_FAILED', 'Could not complete interview.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET RESULTS
// ─────────────────────────────────────────────────────────────────────────────

const getResults = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    const allQuestions = await Question.find({ interviewId: interview._id }).sort({ order: 1 });
    const responses = await Response.find({
      interviewId: interview._id,
      clerkUserId: req.clerkUserId,
    });

    const responseByQuestionId = new Map();
    for (const r of responses) {
      responseByQuestionId.set(String(r.questionId), r);
    }

    const answeredCount = responses.length;
    const skippedCount = allQuestions.filter((q) => q.status === 'skipped').length;
    const totalCount = allQuestions.length || interview.totalQuestions;

    // Filter responses that have valid evaluated scores for aggregation
    const scoredResponses = responses.filter(
      (r) => (r.textEvaluation?.textScore !== null && r.textEvaluation?.textScore !== undefined) ||
             (r.evaluation?.score !== null && r.evaluation?.score !== undefined)
    );

    const aggregated = aggregateInterviewScore(scoredResponses);
    const fusion = aggregateInterviewFusion(scoredResponses);

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

    // Job readiness
    let jobReadiness = null;
    try {
      const skillAnalysis = interview.skillAnalysisId
        ? await SkillAnalysis.findById(interview.skillAnalysisId)
        : null;
      jobReadiness = calculateJobReadiness({
        skillCoveragePercentage: skillAnalysis?.skillCoveragePercentage || 0,
        overallScore: fusion.overallScore || 0,
        questionsAnswered: answeredCount,
        totalQuestions: totalCount,
      });
    } catch (e) { /* not critical */ }

    // Build final evaluation
    const finalEval = {
      overallScore: fusion.overallScore,
      technicalScore: fusion.technicalScore,
      audioScore: fusion.audioScore,
      videoScore: fusion.videoScore,
      modalitiesUsed: fusion.modalitiesUsed,
      skillScores: skillPerformance,
      strongAreas: interview.interviewState?.strongAreas || [],
      weakAreas: interview.interviewState?.weakAreas || [],
      skillGaps: skillAnalysisData.missingSkills || [],
      questionsAnswered: answeredCount,
      questionsSkipped: skippedCount,
      totalQuestions: totalCount,
      completionReason: interview.completionReason,
      isDevelopmentEvaluation: aggregated.isDevelopmentEvaluation,
      sbertEvaluated: aggregated.sbertEvaluated || 0,
      notice: aggregated.notice,
    };

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
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    const skillAnalysis = interview.skillAnalysisId
      ? await SkillAnalysis.findById(interview.skillAnalysisId)
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
    const skillScores = {};
    for (const [skill, perf] of Object.entries(state.skillPerformance || {})) {
      skillScores[skill] = perf.score;
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
};
