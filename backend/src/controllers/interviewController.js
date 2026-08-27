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
        startedAt: interview.startedAt,
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
      return sendSuccess(res, { message: 'Interview completed.', isComplete: true, currentQuestion: null });
    }

    const question = await Question.findOne({
      interviewId: interview._id,
      order: interview.currentQuestionIndex,
    });

    return sendSuccess(res, {
      currentQuestion: formatQuestion(question),
      currentQuestionIndex: interview.currentQuestionIndex,
      totalQuestions: interview.totalQuestions,
      isComplete: !question,
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

    const { questionId, answerText } = req.body;
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

    // ── Phase 4: SBERT evaluation ───────────────────────────────────────────
    const expectedConcepts = question.expectedConcepts || question.expectedKeyPoints || [];
    const { textEvaluation, evaluation } = await evaluateResponse(
      question.text,
      answerText,
      question.difficulty,
      expectedConcepts
    );

    // ── Phase 7: Build multimodal evaluation (text only for now) ────────────
    const multimodalEval = buildEvaluation(textEvaluation, null, null);

    // Save response
    const response = await Response.create({
      clerkUserId,
      interviewId: interview._id,
      questionId,
      answerText: answerText.trim(),
      textEvaluation,
      multimodalEvaluation: multimodalEval,
      evaluation, // legacy
      submittedAt: new Date(),
    });

    // ── Phase 8: Adaptive engine ────────────────────────────────────────────
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
      const followUpData = generateFollowUpQuestion(question, answerText, missingConcepts);
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
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: interview.totalQuestions,
        status: interview.status,
        isComplete,
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
      return sendSuccess(res, { message: 'Interview already completed.', interviewId: interview._id });
    }

    interview.status = 'completed';
    interview.completedAt = new Date();
    await interview.save();

    await saveProgress(interview, req.clerkUserId);

    return sendSuccess(res, { message: 'Interview completed.', interviewId: interview._id });
  } catch (error) {
    return sendError(res, 500, 'COMPLETE_FAILED', 'Could not complete interview.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET RESULTS (Phase 9)
// ─────────────────────────────────────────────────────────────────────────────

const getResults = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    const responses = await Response.find({
      interviewId: interview._id,
      clerkUserId: req.clerkUserId,
    }).populate('questionId', 'text category type difficulty targetSkill skill contextNote expectedConcepts');

    const aggregated = aggregateInterviewScore(responses);
    const fusion = aggregateInterviewFusion(responses);

    // Build per-question breakdown
    const questionBreakdown = responses.map((r, i) => ({
      questionNumber: i + 1,
      question: r.questionId?.text || 'Unknown question',
      category: r.questionId?.category,
      type: r.questionId?.type,
      difficulty: r.questionId?.difficulty,
      targetSkill: r.questionId?.targetSkill || r.questionId?.skill,
      contextNote: r.questionId?.contextNote,
      answerText: r.answerText,
      textEvaluation: r.textEvaluation,
      audioEvaluation: r.audioEvaluation,
      videoEvaluation: r.videoEvaluation,
      multimodalEvaluation: r.multimodalEvaluation,
      // Legacy
      evaluation: r.evaluation,
      score: r.textEvaluation?.textScore ?? r.evaluation?.score ?? null,
    }));

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
        questionsAnswered: responses.length,
        totalQuestions: interview.totalQuestions,
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
      questionsAnswered: responses.length,
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
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
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
  submitAudioResponse,
  submitVideoResponse,
  completeInterview,
  getResults,
  getRoadmap,
};
