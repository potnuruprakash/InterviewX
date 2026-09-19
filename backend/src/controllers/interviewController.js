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
const {
  generateInterviewQuestions,
  generateFollowUpQuestion,
  isDuplicateQuestion,
  normalizeQuestionText,
  getQuestionsForInterview,
} = require('../services/questionService');
const { evaluateResponse, evaluateAudio, evaluateVideo, aggregateInterviewScore } = require('../services/evaluationService');
const { aggregateInterviewFusion, buildEvaluation } = require('../services/multimodalFusionService');
const { updateSkillPerformance, determineAdaptiveAction, shouldStopInterview } = require('../services/adaptiveEngineService');
const { generateRoadmap, calculateJobReadiness } = require('../services/roadmapService');
const { analyzeVoiceAndBehavior } = require('../services/voiceBehaviorAnalysisService');
const { deleteFile } = require('../middleware/upload');
const {
  MAX_ADAPTIVE_FOLLOW_UPS,
  getMaximumAllowedQuestions,
  getInterviewCounts,
  canAddAdaptiveFollowUp,
  isInterviewComplete: checkInterviewComplete,
} = require('../utils/interviewStateHelper');


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
  skill: q.skill || q.targetSkill || 'general',
  source: q.source,
  sourceProject: q.sourceProject,
  expectedTopics: q.expectedTopics || q.expectedConcepts || q.expectedKeyPoints || [],
  expectedConcepts: q.expectedConcepts || [],
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
      interviewType = 'mixed', difficulty = 'medium',
      durationMinutes = 30,
      practiceFromInterviewId = null,
    } = req.body;
    const clerkUserId = req.clerkUserId;

    // Authoritative question count: 5, 10, or 15 (default 5)
    const requestedCount = Math.max(1, Math.min(15, Number(req.body.totalQuestions || req.body.questionCount) || 5));
    const isVideoEnabled = Boolean(req.body.videoModeEnabled || req.body.interviewMode === 'video');

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

    const targetRole = job.targetRole || job.role || 'Software Engineer';
    const durationMins = Math.max(5, Math.min(120, Number(durationMinutes) || 30));
    const durationSecs = durationMins * 60;

    // Create interview
    const interview = await Interview.create({
      clerkUserId,
      resumeId,
      jobDescriptionId,
      skillAnalysisId: skillAnalysis?._id || null,
      targetRole,
      interviewType,
      difficulty,
      configuredQuestionCount: requestedCount,
      totalQuestions: requestedCount,
      durationMinutes: durationMins,
      durationSeconds: durationSecs,
      videoModeEnabled: isVideoEnabled,
      practiceFromInterviewId: practiceFromInterviewId || null,
      status: 'created',
      skillAnalysis: skillAnalysis ? {
        matchedSkills: skillAnalysis.matchedRequiredSkills || [],
        missingSkills: skillAnalysis.notIdentifiedRequiredSkills || [],
        weakSkills: [],
        skillGapPercentage: skillAnalysis.skillGapPercentage || 0,
      } : {},
    });

    // ── Phase 3: Generate personalized questions with diversity & reattempt logic ──
    const candidateProfile = resume.parsedData || {};
    const jobProfile = job.parsedData || {};

    const hasPersonalizationData = (
      candidateProfile.skills?.length > 0 ||
      candidateProfile.extractedSkills?.length > 0 ||
      candidateProfile.projects?.length > 0 ||
      skillAnalysis !== null
    );

    // Build avoid list and weak areas to prioritize
    const avoidQuestions = [];
    let weakAreasToTarget = [];
    let isPracticeReattempt = false;

    // 1. Mandatory exclusion & weak area extraction from practiceFromInterviewId
    if (practiceFromInterviewId) {
      // SECURITY: Ensure practiceFromInterviewId belongs to the authenticated clerkUserId
      const prevInterview = await Interview.findOne({
        _id: practiceFromInterviewId,
        clerkUserId,
      }).lean();

      if (prevInterview) {
        isPracticeReattempt = true;

        // Extract weak areas from finalEvaluation, interviewState, or skillAnalysis
        weakAreasToTarget = [
          ...(prevInterview.finalEvaluation?.weakAreas || []),
          ...(prevInterview.interviewState?.weakAreas || []),
          ...(prevInterview.skillAnalysis?.weakSkills || []),
        ].filter(Boolean);

        // Load all previous questions from that practice interview (mandatory exclusion)
        const prevQuestions = await Question.find({
          interviewId: prevInterview._id,
          clerkUserId,
        }).select('text targetSkill skill category type').lean();

        prevQuestions.forEach((q) => {
          if (q && q.text) avoidQuestions.push(q);
        });
      } else {
        console.warn(`[Security] User ${clerkUserId} attempted unauthorized reattempt from interview ${practiceFromInterviewId}`);
      }
    }

    // 2. Candidate historical question deduplication: avoid all previously asked questions for this user
    try {
      const candidatePreviousQuestions = await Question.find({
        clerkUserId,
        interviewId: { $ne: interview._id },
      })
        .select('text targetSkill skill category type')
        .lean();

      candidatePreviousQuestions.forEach((q) => {
        if (q && q.text) avoidQuestions.push(q);
      });
    } catch (histErr) {
      console.warn('[QuestionGeneration] Failed to retrieve candidate question history:', histErr.message);
    }

    // 3. Bounded regeneration loop (MAX_GENERATION_ATTEMPTS = 3)
    const MAX_GENERATION_ATTEMPTS = 3;
    let attempts = 0;
    let duplicatesRejectedCount = 0;
    const uniqueQuestions = [];
    let generationSource = hasPersonalizationData ? 'personalized' : 'static_bank';

    while (uniqueQuestions.length < requestedCount && attempts < MAX_GENERATION_ATTEMPTS) {
      attempts++;

      let batchCandidates = [];
      if (hasPersonalizationData) {
        batchCandidates = generateInterviewQuestions({
          candidateProfile,
          jobProfile,
          skillAnalysis: skillAnalysis || {},
          targetRole,
          interviewType,
          difficulty,
          totalQuestions: requestedCount,
          avoidTexts: [...avoidQuestions, ...uniqueQuestions],
          weakAreas: weakAreasToTarget,
          isPracticeAttempt: isPracticeReattempt,
        });
      } else {
        const fallback = getQuestionsForInterview(interviewType, difficulty, requestedCount * 2);
        batchCandidates = fallback.map((q) => ({
          ...q,
          type: q.category || 'technical',
          source: 'general_pool',
          targetSkill: q.skill,
          expectedConcepts: q.expectedKeyPoints || [],
          expectedTopics: q.expectedKeyPoints || [],
          followUpAllowed: true,
          contextNote: null,
        }));
      }

      for (const q of batchCandidates) {
        if (!q || !q.text || q.text.trim().length < 15) continue;

        // Layered duplicate check against previous interview avoid list and currently accepted questions
        const dupCheck = isDuplicateQuestion(q, [...avoidQuestions, ...uniqueQuestions]);
        if (dupCheck.isDuplicate) {
          duplicatesRejectedCount++;
          continue;
        }

        uniqueQuestions.push(q);
        if (uniqueQuestions.length >= requestedCount) break;
      }
    }

    // 4. Safe fallback if still under requestedCount after bounded retries
    if (uniqueQuestions.length < requestedCount) {
      generationSource = uniqueQuestions.length > 0 ? 'hybrid' : 'static_bank';
      const extraPool = getQuestionsForInterview('mixed', difficulty, requestedCount * 3);
      for (const q of extraPool) {
        const normText = normalizeQuestionText(q.text);
        const isAlreadyChosen = uniqueQuestions.some(
          (u) => normalizeQuestionText(u.text) === normText
        );
        if (!isAlreadyChosen) {
          uniqueQuestions.push({
            ...q,
            type: q.category || 'technical',
            source: 'general_pool',
            targetSkill: q.skill,
            expectedConcepts: q.expectedKeyPoints || [],
            expectedTopics: q.expectedKeyPoints || [],
            followUpAllowed: true,
            contextNote: null,
          });
        }
        if (uniqueQuestions.length >= requestedCount) break;
      }
    }

    // 5. Structured server logging (No PII, no resume contents, no auth tokens)
    console.log(
      `[QuestionGeneration] interviewId=${interview._id} ` +
      `practiceFromInterviewId=${practiceFromInterviewId || 'none'} ` +
      `historyCount=${avoidQuestions.length} ` +
      `weakAreaCount=${weakAreasToTarget.length} ` +
      `attempts=${attempts} ` +
      `duplicatesRejected=${duplicatesRejectedCount} ` +
      `finalCount=${uniqueQuestions.length}`
    );

    const questionsToInsert = uniqueQuestions.slice(0, requestedCount);

    const VALID_TYPES = ['introduction', 'resume', 'technical', 'coding', 'project', 'experience', 'behavioral', 'job_specific', 'skill_gap', 'follow_up'];
    const VALID_CATEGORIES = ['introduction', 'resume', 'project', 'technical', 'coding', 'behavioral', 'hr', 'conceptual', 'situational', 'skill_gap', 'experience', 'follow_up', 'job_description'];
    const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
    const VALID_SOURCES = ['resume', 'project', 'job_description', 'skill_gap', 'behavioral', 'experience', 'previous_answer', 'general_pool', 'static_bank'];

    const questions = await Question.insertMany(
      questionsToInsert.map((q, index) => {
        const resolvedType = VALID_TYPES.includes(q.type) ? q.type : (VALID_TYPES.includes(q.category) ? q.category : 'technical');
        const resolvedCategory = VALID_CATEGORIES.includes(q.category) ? q.category : 'technical';
        const resolvedDiff = VALID_DIFFICULTIES.includes(q.difficulty) ? q.difficulty : (VALID_DIFFICULTIES.includes(difficulty) ? difficulty : 'medium');
        const resolvedSource = VALID_SOURCES.includes(q.source) ? q.source : 'general_pool';

        return {
          interviewId: interview._id,
          clerkUserId,
          text: q.text,
          type: resolvedType,
          category: resolvedCategory,
          difficulty: resolvedDiff,
          targetSkill: q.targetSkill || q.skill || null,
          skill: q.skill || q.targetSkill || 'general',
          source: resolvedSource,
          sourceProject: q.sourceProject || null,
          expectedConcepts: q.expectedConcepts || q.expectedKeyPoints || [],
          expectedTopics: q.expectedTopics || q.expectedConcepts || q.expectedKeyPoints || [],
          expectedKeyPoints: q.expectedKeyPoints || q.expectedConcepts || [],
          order: index,
          followUpAllowed: q.followUpAllowed !== false,
          contextNote: q.contextNote || null,
          starterCode: q.starterCode || null,
          language: q.language || 'javascript',
          status: 'pending',
        };
      })
    );

    interview.configuredQuestionCount = requestedCount;
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
        configuredQuestionCount: interview.configuredQuestionCount,
        totalQuestions: interview.totalQuestions,
        durationMinutes: interview.durationMinutes,
        durationSeconds: interview.durationSeconds,
        videoModeEnabled: interview.videoModeEnabled,
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
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId })
      .populate('jobDescriptionId')
      .populate('resumeId')
      .populate('skillAnalysisId');
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');
    return sendSuccess(res, { interview });
  } catch (error) {
    return sendError(res, 500, 'INTERVIEW_FETCH_FAILED', 'Could not retrieve interview.', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// START INTERVIEW
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// START INTERVIEW
// ─────────────────────────────────────────────────────────────────────────────

const startInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, clerkUserId: req.clerkUserId });
    if (!interview) return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found.');

    const maxAllowedQuestions = interview.configuredQuestionCount || interview.totalQuestions || 5;
    const durationSeconds = interview.durationSeconds || (interview.durationMinutes || 30) * 60;
    if (!interview.durationSeconds) {
      interview.durationSeconds = durationSeconds;
    }

    // Set server-authoritative timer timestamps if not already set
    if (!interview.startedAt) {
      interview.startedAt = new Date();
      interview.expiresAt = new Date(interview.startedAt.getTime() + durationSeconds * 1000);
      interview.status = 'in_progress';
      await interview.save();
    } else if (!interview.expiresAt) {
      interview.expiresAt = new Date(new Date(interview.startedAt).getTime() + durationSeconds * 1000);
      await interview.save();
    }

    const now = Date.now();
    const isTimeExpired = interview.expiresAt && now >= new Date(interview.expiresAt).getTime();
    const isAllQuestionsFinished = interview.currentQuestionIndex >= maxAllowedQuestions;

    if (interview.status === 'completed' || isAllQuestionsFinished || isTimeExpired) {
      if (interview.status !== 'completed') {
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = isTimeExpired ? 'time_expired' : (interview.completionReason || 'all_questions_completed');
        await interview.save();
        await saveProgress(interview, req.clerkUserId);
      }
      return sendSuccess(res, {
        message: isTimeExpired ? 'Interview duration expired.' : 'Interview already completed.',
        isComplete: true,
        interview: {
          id: interview._id,
          status: 'completed',
          currentQuestionIndex: interview.currentQuestionIndex,
          totalQuestions: maxAllowedQuestions,
          configuredQuestionCount: maxAllowedQuestions,
          durationMinutes: interview.durationMinutes || 30,
          durationSeconds: interview.durationSeconds,
          startedAt: interview.startedAt,
          expiresAt: interview.expiresAt,
          remainingSeconds: 0,
          skippedQuestionsCount: interview.skippedQuestionsCount || 0,
          answeredQuestionsCount: interview.answeredQuestionsCount || 0,
          timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
          completionReason: interview.completionReason || null,
          videoModeEnabled: interview.videoModeEnabled || false,
          videoRecorded: interview.videoRecorded || false,
          videoUploaded: interview.videoUploaded || false,
        },
        currentQuestion: null,
      });
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

      if (nextPending && nextPending.order < maxAllowedQuestions) {
        firstQuestion = nextPending;
        interview.currentQuestionIndex = nextPending.order;
        await interview.save();
      } else {
        // No pending questions left within max count
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = 'all_questions_completed';
        await interview.save();
        await saveProgress(interview, req.clerkUserId);

        return sendSuccess(res, {
          message: 'All questions completed.',
          isComplete: true,
          interview: {
            id: interview._id,
            status: 'completed',
            currentQuestionIndex: maxAllowedQuestions,
            totalQuestions: maxAllowedQuestions,
            configuredQuestionCount: maxAllowedQuestions,
            durationMinutes: interview.durationMinutes || 30,
            durationSeconds: interview.durationSeconds,
            startedAt: interview.startedAt,
            expiresAt: interview.expiresAt,
            remainingSeconds: 0,
            skippedQuestionsCount: interview.skippedQuestionsCount || 0,
            answeredQuestionsCount: interview.answeredQuestionsCount || 0,
            timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
            completionReason: interview.completionReason,
            videoModeEnabled: interview.videoModeEnabled || false,
            videoRecorded: interview.videoRecorded || false,
            videoUploaded: interview.videoUploaded || false,
          },
          currentQuestion: null,
        });
      }
    }

    const remainingSecs = interview.expiresAt
      ? Math.max(0, Math.floor((new Date(interview.expiresAt).getTime() - now) / 1000))
      : durationSeconds;

    return sendSuccess(res, {
      message: 'Interview started.',
      interview: {
        id: interview._id,
        status: interview.status,
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: maxAllowedQuestions,
        configuredQuestionCount: maxAllowedQuestions,
        durationMinutes: interview.durationMinutes || 30,
        durationSeconds: interview.durationSeconds,
        startedAt: interview.startedAt,
        expiresAt: interview.expiresAt,
        remainingSeconds: remainingSecs,
        skippedQuestionsCount: interview.skippedQuestionsCount || 0,
        answeredQuestionsCount: interview.answeredQuestionsCount || 0,
        timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
        completionReason: interview.completionReason || null,
        questionGenerationSource: interview.questionGenerationSource,
        modalityAvailability: interview.modalityAvailability,
        videoModeEnabled: interview.videoModeEnabled || false,
        videoRecorded: interview.videoRecorded || false,
        videoUploaded: interview.videoUploaded || false,
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

    const maxAllowedQuestions = interview.configuredQuestionCount || interview.totalQuestions || 5;
    const durationSeconds = interview.durationSeconds || (interview.durationMinutes || 30) * 60;
    const now = Date.now();
    const isTimeExpired = interview.expiresAt && now >= new Date(interview.expiresAt).getTime();

    if (interview.status === 'completed' || interview.currentQuestionIndex >= maxAllowedQuestions || isTimeExpired) {
      if (interview.status !== 'completed') {
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = isTimeExpired ? 'time_expired' : (interview.completionReason || 'all_questions_completed');
        await interview.save();
        await saveProgress(interview, req.clerkUserId);
      }
      return sendSuccess(res, {
        message: isTimeExpired ? 'Interview duration expired.' : 'Interview completed.',
        isComplete: true,
        currentQuestion: null,
        interview: {
          id: interview._id,
          status: interview.status,
          completionReason: interview.completionReason,
          durationMinutes: interview.durationMinutes || 30,
          durationSeconds,
          startedAt: interview.startedAt,
          expiresAt: interview.expiresAt,
          remainingSeconds: 0,
          skippedQuestionsCount: interview.skippedQuestionsCount || 0,
          answeredQuestionsCount: interview.answeredQuestionsCount || 0,
          timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
          totalQuestions: maxAllowedQuestions,
          configuredQuestionCount: maxAllowedQuestions,
          videoModeEnabled: interview.videoModeEnabled || false,
          videoRecorded: interview.videoRecorded || false,
          videoUploaded: interview.videoUploaded || false,
        },
      });
    }

    let question = await Question.findOne({
      interviewId: interview._id,
      order: interview.currentQuestionIndex,
      status: 'pending',
    });

    if (!question) {
      question = await Question.findOne({
        interviewId: interview._id,
        status: 'pending',
      }).sort({ order: 1 });
      if (question && question.order < maxAllowedQuestions) {
        interview.currentQuestionIndex = question.order;
        await interview.save();
      } else {
        question = null;
      }
    }

    const isComplete = !question || interview.currentQuestionIndex >= maxAllowedQuestions;
    if (isComplete && interview.status !== 'completed') {
      interview.status = 'completed';
      interview.completedAt = new Date();
      interview.completionReason = 'all_questions_completed';
      await interview.save();
      await saveProgress(interview, req.clerkUserId);
    }

    const remainingSecs = interview.expiresAt
      ? Math.max(0, Math.floor((new Date(interview.expiresAt).getTime() - now) / 1000))
      : durationSeconds;

    return sendSuccess(res, {
      currentQuestion: question ? formatQuestion(question) : null,
      currentQuestionIndex: interview.currentQuestionIndex,
      totalQuestions: maxAllowedQuestions,
      configuredQuestionCount: maxAllowedQuestions,
      skippedQuestionsCount: interview.skippedQuestionsCount || 0,
      answeredQuestionsCount: interview.answeredQuestionsCount || 0,
      timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
      durationMinutes: interview.durationMinutes || 30,
      durationSeconds,
      startedAt: interview.startedAt,
      expiresAt: interview.expiresAt,
      remainingSeconds: remainingSecs,
      isComplete,
      interview: {
        id: interview._id,
        status: interview.status,
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: maxAllowedQuestions,
        configuredQuestionCount: maxAllowedQuestions,
        durationMinutes: interview.durationMinutes || 30,
        durationSeconds,
        startedAt: interview.startedAt,
        expiresAt: interview.expiresAt,
        remainingSeconds: remainingSecs,
        skippedQuestionsCount: interview.skippedQuestionsCount || 0,
        answeredQuestionsCount: interview.answeredQuestionsCount || 0,
        timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
        videoModeEnabled: interview.videoModeEnabled || false,
        videoRecorded: interview.videoRecorded || false,
        videoUploaded: interview.videoUploaded || false,
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

    const question = await Question.findOne({ _id: questionId, interviewId: interview._id });
    if (!question) return sendError(res, 404, 'QUESTION_NOT_FOUND', 'Question not found in this interview.');

    if (question.status === 'answered' || question.status === 'skipped') {
      return sendError(res, 409, 'RESPONSE_EXISTS', `This question has already been marked as ${question.status}.`);
    }

    const existingResponse = await Response.findOne({ interviewId: interview._id, questionId, clerkUserId });
    if (existingResponse) return sendError(res, 409, 'RESPONSE_EXISTS', 'Answer already submitted for this question.');

    // Enforce interview completed check
    if (interview.status === 'completed') {
      return sendError(res, 400, 'INTERVIEW_COMPLETED', 'This interview is already completed.');
    }

    // Enforce server-side expiration check (+ 15s latency buffer)
    if (interview.expiresAt && Date.now() > new Date(interview.expiresAt).getTime() + 15000) {
      interview.status = 'completed';
      interview.completionReason = 'time_expired';
      interview.completedAt = interview.completedAt || new Date();
      await interview.save();
      await saveProgress(interview, clerkUserId);
      return sendError(res, 400, 'INTERVIEW_EXPIRED', 'The interview duration has expired. Submissions are no longer accepted.');
    }


    // Determine evaluation text: if coding response, combine explanation and code for semantic evaluation
    const textToEvaluate = (answerText && answerText.trim().length > 0)
      ? (code ? `${answerText.trim()}\n\nCode Solution (${language || 'code'}):\n${code}` : answerText.trim())
      : (code || '').trim();

    // ── SBERT evaluation ────────────────────────────────────────────
    const expectedConcepts = question.expectedConcepts || question.expectedTopics || question.expectedKeyPoints || [];
    const { textEvaluation, evaluation } = await evaluateResponse(
      question.text,
      textToEvaluate,
      question.difficulty,
      expectedConcepts
    );

    // ── Build multimodal evaluation (text only initially) ────────────
    const multimodalEval = buildEvaluation(textEvaluation, null, null);

    // Save response with duplicate key handling
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
        evaluation,
        submittedAt: new Date(),
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return sendError(res, 409, 'RESPONSE_EXISTS', 'An answer has already been submitted for this question.');
      }
      throw createErr;
    }


    // Mark question as answered
    question.status = 'answered';
    await question.save();

    // Track answered count
    interview.answeredQuestionsCount = (interview.answeredQuestionsCount || 0) + 1;

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

    // Check stop conditions and maximum interview question limit
    const maxAllowedQuestions = getMaximumAllowedQuestions(interview.configuredQuestionCount);
    const allInterviewQuestions = await Question.find({ interviewId: interview._id }).sort({ order: 1 });
    const { shouldStop } = shouldStopInterview(interview);
    let isComplete = shouldStop || (interview.currentQuestionIndex >= maxAllowedQuestions);

    // Generate follow-up question predictably at the current position if quota allows
    let nextQuestion = null;
    if (!isComplete && shouldFollowUp && missingConcepts.length > 0 && canAddAdaptiveFollowUp(interview, allInterviewQuestions)) {
      const followUpData = generateFollowUpQuestion(question, textToEvaluate, missingConcepts);
      const followUpOrder = interview.currentQuestionIndex;

      // Shift remaining pending questions to make room for follow-up
      await Question.updateMany(
        { interviewId: interview._id, order: { $gte: followUpOrder }, status: 'pending' },
        { $inc: { order: 1 } }
      );

      const followUp = await Question.create({
        interviewId: interview._id,
        clerkUserId,
        ...followUpData,
        order: followUpOrder,
        parentQuestionId: question._id,
        isAdaptive: true,
      });

      interview.totalQuestions += 1;
      nextQuestion = formatQuestion(followUp);
    }


    if (isComplete) {
      interview.status = 'completed';
      interview.completionReason = interview.completionReason || 'completed';
      interview.completedAt = new Date();
      await interview.save();
      await saveProgress(interview, clerkUserId);
    } else {
      await interview.save();
    }

    // Get next question if not follow-up and not complete
    if (!nextQuestion && !isComplete) {
      let nextQuestionDoc = await Question.findOne({
        interviewId: interview._id,
        order: interview.currentQuestionIndex,
        status: 'pending',
      });

      if (!nextQuestionDoc) {
        nextQuestionDoc = await Question.findOne({
          interviewId: interview._id,
          status: 'pending',
        }).sort({ order: 1 });
        if (nextQuestionDoc && nextQuestionDoc.order < maxAllowedQuestions) {
          interview.currentQuestionIndex = nextQuestionDoc.order;
          await interview.save();
        } else {
          nextQuestionDoc = null;
        }
      }

      if (nextQuestionDoc && interview.currentQuestionIndex < maxAllowedQuestions) {
        nextQuestion = formatQuestion(nextQuestionDoc);
      } else {
        const remainingPending = await Question.countDocuments({
          interviewId: interview._id,
          status: 'pending',
          order: { $lt: maxAllowedQuestions },
        });
        const totalProcessed = (interview.answeredQuestionsCount || 0) + (interview.skippedQuestionsCount || 0);
        if (remainingPending === 0 && totalProcessed >= (interview.configuredQuestionCount || interview.totalQuestions || 5)) {
          isComplete = true;
          interview.status = 'completed';
          interview.completionReason = interview.completionReason || 'all_questions_completed';
          interview.completedAt = new Date();
          await interview.save();
          await saveProgress(interview, clerkUserId);
        }
      }
    }

    const durationSeconds = interview.durationSeconds || (interview.durationMinutes || 30) * 60;
    const remainingSecs = interview.expiresAt
      ? Math.max(0, Math.floor((new Date(interview.expiresAt).getTime() - Date.now()) / 1000))
      : durationSeconds;

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
        totalQuestions: maxAllowedQuestions,
        configuredQuestionCount: maxAllowedQuestions,
        skippedQuestionsCount: interview.skippedQuestionsCount || 0,
        answeredQuestionsCount: interview.answeredQuestionsCount || 0,
        timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
        durationMinutes: interview.durationMinutes || 30,
        durationSeconds,
        startedAt: interview.startedAt,
        expiresAt: interview.expiresAt,
        remainingSeconds: remainingSecs,
        status: interview.status,
        isComplete,
        completionReason: interview.completionReason,
        adaptiveAction: shouldFollowUp ? 'follow_up_added' : 'next_question',
        currentDifficulty: interview.interviewState?.currentDifficulty,
        videoModeEnabled: interview.videoModeEnabled || false,
        videoRecorded: interview.videoRecorded || false,
        videoUploaded: interview.videoUploaded || false,
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

    // Check expiration (+ 15s grace)
    if (interview.expiresAt && Date.now() > new Date(interview.expiresAt).getTime() + 15000) {
      interview.status = 'completed';
      interview.completionReason = 'time_expired';
      interview.completedAt = interview.completedAt || new Date();
      await interview.save();
      await saveProgress(interview, clerkUserId);
      return sendError(res, 400, 'INTERVIEW_EXPIRED', 'The interview duration has expired.');
    }

    const maxAllowedQuestions = interview.configuredQuestionCount || interview.totalQuestions || 5;
    const durationSeconds = interview.durationSeconds || (interview.durationMinutes || 30) * 60;

    let question = null;
    if (questionId) {
      question = await Question.findOne({ _id: questionId, interviewId: interview._id });
      if (!question) {
        return sendError(res, 404, 'QUESTION_NOT_FOUND', 'Question not found in this interview.');
      }
    } else {
      const isAlreadyAtEnd = interview.currentQuestionIndex >= maxAllowedQuestions;
      if (interview.status === 'completed' || isAlreadyAtEnd) {
        if (interview.status !== 'completed') {
          interview.status = 'completed';
          interview.completedAt = interview.completedAt || new Date();
          interview.completionReason = interview.completionReason || 'all_questions_completed';
          await interview.save();
          await saveProgress(interview, clerkUserId);
        }
        return sendSuccess(res, {
          message: 'Interview completed. All questions skipped or answered.',
          status: 'completed',
          isComplete: true,
          interview: {
            id: interview._id,
            currentQuestionIndex: maxAllowedQuestions,
            totalQuestions: maxAllowedQuestions,
            configuredQuestionCount: maxAllowedQuestions,
            skippedQuestionsCount: interview.skippedQuestionsCount || maxAllowedQuestions,
            answeredQuestionsCount: interview.answeredQuestionsCount || 0,
            timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
            durationMinutes: interview.durationMinutes || 30,
            durationSeconds,
            startedAt: interview.startedAt,
            expiresAt: interview.expiresAt,
            remainingSeconds: 0,
            status: 'completed',
            isComplete: true,
            completionReason: interview.completionReason,
            videoModeEnabled: interview.videoModeEnabled || false,
            videoRecorded: interview.videoRecorded || false,
            videoUploaded: interview.videoUploaded || false,
          },
          nextQuestion: null,
        });
      }

      question = await Question.findOne({ interviewId: interview._id, order: interview.currentQuestionIndex });
      if (!question) {
        question = await Question.findOne({ interviewId: interview._id, status: 'pending', order: { $lt: maxAllowedQuestions } }).sort({ order: 1 });
      }
    }

    if (!question) {
      interview.status = 'completed';
      interview.completedAt = interview.completedAt || new Date();
      interview.completionReason = 'all_questions_completed';
      await interview.save();
      await saveProgress(interview, clerkUserId);

      return sendSuccess(res, {
        message: 'All questions completed.',
        status: 'completed',
        isComplete: true,
        interview: {
          id: interview._id,
          currentQuestionIndex: maxAllowedQuestions,
          totalQuestions: maxAllowedQuestions,
          configuredQuestionCount: maxAllowedQuestions,
          skippedQuestionsCount: interview.skippedQuestionsCount,
          answeredQuestionsCount: interview.answeredQuestionsCount || 0,
          timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
          durationMinutes: interview.durationMinutes || 30,
          durationSeconds,
          startedAt: interview.startedAt,
          expiresAt: interview.expiresAt,
          remainingSeconds: 0,
          status: 'completed',
          isComplete: true,
          completionReason: interview.completionReason,
          videoModeEnabled: interview.videoModeEnabled || false,
          videoRecorded: interview.videoRecorded || false,
          videoUploaded: interview.videoUploaded || false,
        },
        nextQuestion: null,
      });
    }

    if (question.status === 'answered') {
      return sendError(res, 409, 'ALREADY_ANSWERED', 'This question has already been answered and cannot be skipped.');
    }

    if (question.status === 'skipped') {
      // Advance to next pending question
      const nextPending = await Question.findOne({
        interviewId: interview._id,
        status: 'pending',
        order: { $lt: maxAllowedQuestions },
      }).sort({ order: 1 });

      if (!nextPending) {
        interview.status = 'completed';
        interview.completedAt = interview.completedAt || new Date();
        interview.completionReason = 'all_questions_skipped';
        await interview.save();
        await saveProgress(interview, clerkUserId);

        return sendSuccess(res, {
          message: 'All questions have been skipped. Interview complete.',
          status: 'completed',
          isComplete: true,
          interview: {
            id: interview._id,
            currentQuestionIndex: maxAllowedQuestions,
            totalQuestions: maxAllowedQuestions,
            configuredQuestionCount: maxAllowedQuestions,
            skippedQuestionsCount: interview.skippedQuestionsCount || maxAllowedQuestions,
            answeredQuestionsCount: interview.answeredQuestionsCount || 0,
            timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
            durationMinutes: interview.durationMinutes || 30,
            durationSeconds,
            startedAt: interview.startedAt,
            expiresAt: interview.expiresAt,
            remainingSeconds: 0,
            status: 'completed',
            isComplete: true,
            completionReason: interview.completionReason,
            videoModeEnabled: interview.videoModeEnabled || false,
            videoRecorded: interview.videoRecorded || false,
            videoUploaded: interview.videoUploaded || false,
          },
          nextQuestion: null,
        });
      }

      interview.currentQuestionIndex = nextPending.order;
      await interview.save();

      const remainingSecs = interview.expiresAt
        ? Math.max(0, Math.floor((new Date(interview.expiresAt).getTime() - Date.now()) / 1000))
        : durationSeconds;

      return sendSuccess(res, {
        message: 'Question already skipped. Proceeding to next question.',
        status: 'skipped',
        interview: {
          id: interview._id,
          currentQuestionIndex: interview.currentQuestionIndex,
          totalQuestions: maxAllowedQuestions,
          configuredQuestionCount: maxAllowedQuestions,
          skippedQuestionsCount: interview.skippedQuestionsCount,
          answeredQuestionsCount: interview.answeredQuestionsCount || 0,
          timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
          durationMinutes: interview.durationMinutes || 30,
          durationSeconds,
          startedAt: interview.startedAt,
          expiresAt: interview.expiresAt,
          remainingSeconds: remainingSecs,
          status: interview.status,
          isComplete: false,
          completionReason: interview.completionReason,
          videoModeEnabled: interview.videoModeEnabled || false,
          videoRecorded: interview.videoRecorded || false,
          videoUploaded: interview.videoUploaded || false,
        },
        nextQuestion: formatQuestion(nextPending),
      });
    }

    // Mark question skipped
    question.status = 'skipped';
    question.skippedAt = new Date();
    question.skipReason = reason;
    await question.save();

    // Advance question index and increment skip count without deflating performance score
    interview.currentQuestionIndex += 1;
    interview.skippedQuestionsCount = (interview.skippedQuestionsCount || 0) + 1;

    let nextQuestionDoc = null;
    if (interview.currentQuestionIndex < maxAllowedQuestions) {
      nextQuestionDoc = await Question.findOne({
        interviewId: interview._id,
        order: interview.currentQuestionIndex,
        status: 'pending',
      });

      if (!nextQuestionDoc) {
        nextQuestionDoc = await Question.findOne({
          interviewId: interview._id,
          status: 'pending',
          order: { $lt: maxAllowedQuestions },
        }).sort({ order: 1 });
        if (nextQuestionDoc) {
          interview.currentQuestionIndex = nextQuestionDoc.order;
        }
      }
    }

    const isComplete = !nextQuestionDoc || interview.currentQuestionIndex >= maxAllowedQuestions;

    if (isComplete) {
      interview.status = 'completed';
      interview.completionReason = interview.skippedQuestionsCount >= maxAllowedQuestions
        ? 'all_questions_skipped'
        : 'final_question_skipped';
      interview.completedAt = new Date();
      await interview.save();
      await saveProgress(interview, clerkUserId);
    } else {
      await interview.save();
    }

    const remainingSecs = interview.expiresAt
      ? Math.max(0, Math.floor((new Date(interview.expiresAt).getTime() - Date.now()) / 1000))
      : durationSeconds;

    return sendSuccess(res, {
      message: isComplete ? 'All questions finished. Interview completed.' : 'Question skipped successfully.',
      status: isComplete ? 'completed' : 'skipped',
      isComplete,
      interview: {
        id: interview._id,
        currentQuestionIndex: interview.currentQuestionIndex,
        totalQuestions: maxAllowedQuestions,
        configuredQuestionCount: maxAllowedQuestions,
        skippedQuestionsCount: interview.skippedQuestionsCount,
        answeredQuestionsCount: interview.answeredQuestionsCount || 0,
        timedOutQuestionsCount: interview.timedOutQuestionsCount || 0,
        durationMinutes: interview.durationMinutes || 30,
        durationSeconds,
        startedAt: interview.startedAt,
        expiresAt: interview.expiresAt,
        remainingSeconds: remainingSecs,
        status: interview.status,
        isComplete,
        completionReason: interview.completionReason,
        videoModeEnabled: interview.videoModeEnabled || false,
        videoRecorded: interview.videoRecorded || false,
        videoUploaded: interview.videoUploaded || false,
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
    interview.videoRecorded = true;
    interview.videoUploaded = true;
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

    // Fix camera status bug: check actual video responses to determine if video was used.
    // This overrides any stale boolean that was set at interview creation time.
    try {
      const videoResponseCount = await Response.countDocuments({
        interviewId: interview._id,
        clerkUserId: req.clerkUserId,
        videoFilePath: { $exists: true, $ne: null },
      });
      if (videoResponseCount > 0) {
        interview.videoRecorded = true;
        interview.videoUploaded = true;
        interview.modalityAvailability.video = true;
      }
    } catch (videoCheckErr) {
      console.warn('[Interview] Video check on complete error:', videoCheckErr.message);
    }

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

    // Fetch previous progress record to calculate longitudinal comparison
    const previousProgress = await Progress.findOne({
      clerkUserId: req.clerkUserId,
      interviewId: { $ne: interview._id },
    }).sort({ completedAt: -1 });

    // Run voice & observable behavior analysis
    const voiceBehaviorAnalysis = analyzeVoiceAndBehavior({
      questions: allQuestions,
      responses,
      interview,
      previousProgress,
    });

    // Combine base question breakdown with voice & STAR analytics
    const enhancedQuestionBreakdown = allQuestions.map((q, i) => {
      const base = questionBreakdown[i];
      const analyzed = voiceBehaviorAnalysis.questionBreakdown[i] || {};
      return {
        ...base,
        wordCount: analyzed.wordCount || 0,
        fillersDetected: analyzed.fillersDetected || [],
        strengths: (analyzed.strengths && analyzed.strengths.length > 0) ? analyzed.strengths : (base.textEvaluation?.strengths || []),
        areasForImprovement: (analyzed.areasForImprovement && analyzed.areasForImprovement.length > 0) ? analyzed.areasForImprovement : (base.textEvaluation?.missingConcepts || []),
        starAnalysis: analyzed.starAnalysis || null,
      };
    });

    // Skill performance breakdown
    const skillPerformance = interview.interviewState?.skillPerformance || {};
    const skillAnalysisData = interview.skillAnalysis || {};

    // Job readiness
    let jobReadiness = null;
    try {
      const skillAnalysis = interview.skillAnalysisId
        ? await SkillAnalysis.findOne({ _id: interview.skillAnalysisId, clerkUserId: req.clerkUserId })
        : null;
      jobReadiness = calculateJobReadiness({
        skillCoveragePercentage: skillAnalysis?.skillCoveragePercentage || 0,
        overallScore: fusion.overallScore || 0,
        questionsAnswered: answeredCount,
        totalQuestions: totalCount,
      });
    } catch (e) { /* not critical */ }

    const timedOutCount = allQuestions.filter((q) => q.status === 'timeout').length ||
      (interview.completionReason === 'time_expired' ? Math.max(0, totalCount - answeredCount - skippedCount) : 0);

    // Compute empirical sub-pillar scores
    const avgSemantic = scoredResponses.length > 0
      ? scoredResponses.reduce((sum, r) => sum + (r.textEvaluation?.semanticScore ?? 0.75), 0) / scoredResponses.length
      : 0.7;
    const avgConceptCoverage = scoredResponses.length > 0
      ? scoredResponses.reduce((sum, r) => sum + (r.textEvaluation?.conceptCoverage ?? 0.7), 0) / scoredResponses.length
      : 0.65;
    const technicalAccuracy = Math.round(fusion.technicalScore || (avgSemantic * 100));
    const relevance = Math.round(Math.min(100, Math.max(30, (avgSemantic * 0.6 + avgConceptCoverage * 0.4) * 100)));
    const completeness = Math.round(Math.min(100, Math.max(25, avgConceptCoverage * 100)));

    // Communication score from voice/fluency or fallback
    const voiceWpm = voiceBehaviorAnalysis?.voiceMetrics?.wpm || 140;
    const fillerDensity = voiceBehaviorAnalysis?.voiceMetrics?.fillerDensity || 1.5;
    const wpmScore = voiceWpm >= 120 && voiceWpm <= 165 ? 90 : (voiceWpm >= 100 && voiceWpm <= 180 ? 75 : 60);
    const fillerScore = Math.max(40, 100 - Math.round(fillerDensity * 12));
    const communication = Math.round((wpmScore * 0.5 + fillerScore * 0.5));

    // Depth & Evidence from word counts, code presence, and STAR breakdown
    const totalWords = voiceBehaviorAnalysis?.voiceMetrics?.totalWords || 100;
    const avgWordsPerAnswer = answeredCount > 0 ? totalWords / answeredCount : 50;
    const hasCodeOrArchitecture = scoredResponses.some(r => r.code || (r.answerText && r.answerText.length > 250));
    const depth = Math.round(Math.min(100, Math.max(35, (avgWordsPerAnswer > 80 ? 85 : avgWordsPerAnswer > 40 ? 70 : 50) + (hasCodeOrArchitecture ? 10 : 0))));

    const starDetectedCount = enhancedQuestionBreakdown.filter(q => q.starAnalysis?.situation?.status === 'detected' || q.starAnalysis?.action?.status === 'detected').length;
    const evidence = Math.round(Math.min(100, Math.max(40, 60 + (starDetectedCount * 12) + (hasCodeOrArchitecture ? 10 : 0))));

    // Actionable Strengths, Improvements, and Recommended Practice
    const strengths = [];
    if (technicalAccuracy >= 70) strengths.push('Strong technical explanation of core principles');
    if (evidence >= 70) strengths.push('Good use of project examples and concrete implementation context');
    if (communication >= 70) strengths.push('Clear, structured communication with optimal conversational pacing');
    if (strengths.length === 0) strengths.push('Completed practice interview with consistent engagement across questions');

    const improvements = [];
    if (completeness < 75) improvements.push('Explain implementation details more deeply and cover all technical concepts');
    if (evidence < 75) improvements.push('Provide measurable metrics and concrete real-world project examples in answers');
    if (depth < 70) improvements.push('Improve answer structure using Situation-Task-Action-Result (STAR) framing');
    if (improvements.length === 0) improvements.push('Continue refining edge-case analysis and architectural trade-off discussions');

    // Actionable recommended practice based on actual detected weaknesses
    const weakSkills = interview.interviewState?.weakAreas || skillAnalysisData.missingSkills || [];
    const recommendedPractice = [];
    if (weakSkills.length > 0) {
      recommendedPractice.push(`Practice deep-dive architectural drills focusing on ${weakSkills.slice(0, 3).join(', ')}`);
    }
    if (communication < 75) {
      recommendedPractice.push('Practice mock answers with intentional 1.5s silent pauses to eliminate filler words');
    }
    if (completeness < 75) {
      recommendedPractice.push('Review system design trade-offs and key concept checklists before next practice interview');
    }
    if (recommendedPractice.length === 0) {
      recommendedPractice.push(`Try a Hard difficulty technical interview for ${interview.targetRole} to challenge advanced topics`);
    }

    // Build final evaluation
    const finalEval = {
      overallScore: fusion.overallScore,
      technicalScore: fusion.technicalScore,
      audioScore: fusion.audioScore,
      videoScore: fusion.videoScore,
      technicalAccuracy,
      relevance,
      completeness,
      communication,
      depth,
      evidence,
      strengths,
      improvements,
      recommendedPractice,
      modalitiesUsed: fusion.modalitiesUsed,
      skillScores: skillPerformance,
      strongAreas: interview.interviewState?.strongAreas || [],
      weakAreas: interview.interviewState?.weakAreas || [],
      skillGaps: skillAnalysisData.missingSkills || [],
      questionsAnswered: answeredCount,
      questionsSkipped: skippedCount,
      questionsTimedOut: timedOutCount,
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
        configuredQuestionCount: interview.configuredQuestionCount || interview.totalQuestions || 5,
        totalQuestions: interview.configuredQuestionCount || interview.totalQuestions || 5,
        videoModeEnabled: interview.videoModeEnabled || false,
        videoRecorded: interview.videoRecorded || false,
        videoUploaded: interview.videoUploaded || false,
        practiceFromInterviewId: interview.practiceFromInterviewId || null,
      },
      finalEvaluation: finalEval,
      jobReadiness,
      skillPerformance,
      questionBreakdown: enhancedQuestionBreakdown,
      resumeSkillAlignment: skillAnalysisData,
      voiceMetrics: voiceBehaviorAnalysis.voiceMetrics,
      behaviorMetrics: voiceBehaviorAnalysis.behaviorMetrics,
      topPriorityImprovements: voiceBehaviorAnalysis.topPriorityImprovements,
      personalizedPracticePlan: voiceBehaviorAnalysis.personalizedPracticePlan,
      comparisonWithPrevious: voiceBehaviorAnalysis.comparisonWithPrevious,
      researchEvidence: voiceBehaviorAnalysis.researchEvidence,
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
      ? await SkillAnalysis.findOne({ _id: interview.skillAnalysisId, clerkUserId: req.clerkUserId })
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

    // Camera status: use actual response data to determine if video was recorded.
    // Don't rely on interview.videoRecorded alone — check actual uploaded video files.
    const hasVideoResponse = responses.some((r) => r.videoFilePath && r.videoEvaluation);
    const hasAudioResponse = responses.some((r) => r.audioFilePath && r.audioEvaluation);

    // Build modalities used from actual responses (override fusion if more complete)
    const modalitiesUsed = ['text'];
    if (hasAudioResponse && !modalitiesUsed.includes('audio')) modalitiesUsed.push('audio');
    if (hasVideoResponse && !modalitiesUsed.includes('video')) modalitiesUsed.push('video');
    // Also merge any modalities detected by fusion
    for (const m of (fusion.modalitiesUsed || [])) {
      if (!modalitiesUsed.includes(m)) modalitiesUsed.push(m);
    }

    // Video indicators from actual responses
    const videoResponses = responses.filter((r) => r.videoEvaluation?.personDetectionRatio != null);
    const avgPersonDetection = videoResponses.length > 0
      ? videoResponses.reduce((sum, r) => sum + (r.videoEvaluation.personDetectionRatio || 0), 0) / videoResponses.length
      : null;

    // Audio indicators from actual responses
    const audioResponses = responses.filter((r) => r.audioEvaluation?.speakingDuration != null);
    const totalSpeakingDuration = audioResponses.reduce((sum, r) => sum + (r.audioEvaluation.speakingDuration || 0), 0);
    const avgSpeechRate = audioResponses.length > 0
      ? audioResponses.reduce((sum, r) => sum + (r.audioEvaluation.speechRate || 0), 0) / audioResponses.length
      : null;

    await Progress.create({
      clerkUserId,
      interviewId: interview._id,
      targetRole: interview.targetRole,
      overallScore: fusion.overallScore || aggregated.overallScore,
      technicalScore: fusion.technicalScore,
      skillScores,
      questionsAnswered: responses.filter((r) => r.status === 'submitted' || Boolean(r.answerText)).length,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,

      modalitiesUsed,
      isDevelopmentEvaluation: aggregated.isDevelopmentEvaluation,
      strongAreas: state.strongAreas || [],
      improvementAreas: state.weakAreas || [],
      skillGaps: interview.skillAnalysis?.missingSkills || [],
      completedAt: interview.completedAt || new Date(),
      // Camera / audio availability from actual responses (not stale flags)
      videoIndicators: {
        personDetectionRatio: avgPersonDetection,
        videoAvailable: hasVideoResponse,
      },
      communicationIndicators: {
        speakingDuration: totalSpeakingDuration || null,
        speechRate: avgSpeechRate,
        audioAvailable: hasAudioResponse,
      },
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
