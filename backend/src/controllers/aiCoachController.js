/**
 * AI Coach Controller
 *
 * Implements interactive coaching, active recall training loops,
 * resume and interview evidence synthesis, and session state persistence.
 *
 * Enforces strict multi-tenant authorization for all endpoints.
 */

const AITrainingProfile = require('../models/AITrainingProfile');
const AITrainingSession = require('../models/AITrainingSession');
const AITrainingMessage = require('../models/AITrainingMessage');
const AITrainingProgress = require('../models/AITrainingProgress');
const AIConversation = require('../models/AIConversation');
const AIMessage = require('../models/AIMessage');
const Resume = require('../models/Resume');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');
const aiCoachService = require('../services/aiCoachService');
const { extractTextFromFile } = require('../services/resumeParserService');
const { analyzeResume } = require('../services/resumeAnalysisService');
const { sendError, sendSuccess } = require('../utils/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET COACH PROFILE & RESUME STATUS
// ─────────────────────────────────────────────────────────────────────────────

const getProfile = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;

    // Check existing AI Training Profile
    let profile = await AITrainingProfile.findOne({ clerkUserId });

    // Check existing uploaded and parsed resume
    const latestResume = await Resume.findOne({
      clerkUserId,
      processingStatus: 'completed',
    }).sort({ createdAt: -1 });

    const hasResume = Boolean(latestResume && latestResume.parsedData);

    // Fetch past interview history summary
    const pastInterviews = await Interview.find({
      clerkUserId,
      status: 'completed',
    })
      .select('targetRole difficulty finalEvaluation completedAt')
      .sort({ completedAt: -1 })
      .limit(5);

    // If profile doesn't exist yet, synthesize an initial profile
    if (!profile) {
      const initialAnalysis = await aiCoachService.analyzeResume(latestResume, pastInterviews);

      profile = await AITrainingProfile.create({
        clerkUserId,
        strengths: initialAnalysis.strengths || [],
        weaknesses: initialAnalysis.weaknesses || [],
        focusTopics: initialAnalysis.focusTopics || [],
        currentDifficulty: initialAnalysis.difficulty || 'Intermediate',
        summary: initialAnalysis.summary || null,
        targetRole: latestResume?.parsedData?.basicInfo?.targetRole || pastInterviews[0]?.targetRole || null,
        lastAnalyzedResumeId: latestResume?._id || null,
      });
    }

    return sendSuccess(res, {
      profile: {
        strengths: profile.strengths,
        weaknesses: profile.weaknesses,
        focusTopics: profile.focusTopics,
        currentDifficulty: profile.currentDifficulty,
        summary: profile.summary,
        targetRole: profile.targetRole,
        skillLevels: Object.fromEntries(profile.skillLevels || new Map()),
        updatedAt: profile.updatedAt,
      },
      hasResume,
      resumeInfo: latestResume
        ? {
            id: latestResume._id,
            originalName: latestResume.originalName,
            skillsCount: latestResume.parsedData?.skills?.length || 0,
            projectsCount: latestResume.parsedData?.projects?.length || 0,
            uploadedAt: latestResume.createdAt,
          }
        : null,
      recentInterviewsCount: pastInterviews.length,
    });
  } catch (err) {
    console.error('[AICoachController] getProfile error:', err);
    return sendError(res, 500, 'COACH_PROFILE_ERROR', 'Could not load AI Coach profile.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET TRAINING PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

const getProgress = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;

    const progressRecords = await AITrainingProgress.find({ clerkUserId })
      .sort({ score: -1, lastPracticedAt: -1 });

    if (!progressRecords || progressRecords.length === 0) {
      return sendSuccess(res, {
        progress: [],
        message: 'Not enough practice data yet. Start an interactive session to track your mastery.',
      });
    }

    const formatted = progressRecords.map((p) => ({
      id: p._id,
      topic: p.topic,
      skillLevel: p.skillLevel,
      initialScore: p.initialScore != null ? p.initialScore : p.score,
      score: p.score,
      attempts: p.attempts,
      lastPracticedAt: p.lastPracticedAt,
    }));

    return sendSuccess(res, {
      progress: formatted,
    });
  } catch (err) {
    console.error('[AICoachController] getProgress error:', err);
    return sendError(res, 500, 'COACH_PROGRESS_ERROR', 'Could not load training progress.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CREATE TRAINING SESSION
// ─────────────────────────────────────────────────────────────────────────────

const createSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { contextType = 'dashboard', sourceInterviewId = null, topic = null } = req.body;

    let initialTopic = topic || 'General Technical Preparation';
    let initialDifficulty = 'Intermediate';
    let initialAssistantMessage = '';
    let currentQuestionText = null;

    // ── Entry Point B: Results → Train Me ───────────────────────────────────
    if (contextType === 'results' && sourceInterviewId) {
      // Authorize: Verify ownership of this interview
      const interview = await Interview.findOne({
        _id: sourceInterviewId,
        clerkUserId,
      });

      if (!interview) {
        return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'The specified interview was not found or is unauthorized.');
      }

      // Fetch questions and responses for this interview
      const [questions, responses] = await Promise.all([
        Question.find({ interviewId: sourceInterviewId }).sort({ order: 1 }),
        Response.find({ interviewId: sourceInterviewId }),
      ]);

      const questionBreakdown = questions.map((q) => {
        const resp = responses.find((r) => r.questionId.toString() === q._id.toString());
        return {
          text: q.text,
          category: q.category,
          score: resp?.multimodalEvaluation?.overallScore ?? resp?.textEvaluation?.textScore ?? null,
          textScore: resp?.textEvaluation?.textScore ?? null,
          missingConcepts: resp?.textEvaluation?.missingConcepts || [],
          feedback: resp?.textEvaluation?.feedback || resp?.evaluation?.feedback || null,
        };
      });

      // Analyze interview evidence
      const interviewAnalysis = await aiCoachService.analyzeInterview(interview, questionBreakdown);

      initialTopic = interviewAnalysis.priorityFocusTopic || interview.targetRole || 'System Design';
      initialDifficulty = interviewAnalysis.difficulty || 'Intermediate';
      currentQuestionText = interviewAnalysis.recommendedStartingQuestion;

      initialAssistantMessage = `${interviewAnalysis.startingExercisePrompt}\n\n**Starting Exercise:**\n${currentQuestionText}`;
    } else {
      // ── Entry Point A: Dashboard Coach ──────────────────────────────────────
      const latestResume = await Resume.findOne({
        clerkUserId,
        processingStatus: 'completed',
      }).sort({ createdAt: -1 });

      const lastInterview = await Interview.findOne({
        clerkUserId,
        status: 'completed',
      }).sort({ completedAt: -1 });

      const greeting = await aiCoachService.generateCoachGreeting({
        resumeSummary: latestResume?.parsedData
          ? {
              targetRole: latestResume.parsedData.basicInfo?.targetRole,
              skills: (latestResume.parsedData.skills || []).map((s) => s.canonicalName || s.name),
            }
          : null,
        lastInterview: lastInterview
          ? {
              targetRole: lastInterview.targetRole,
              difficulty: lastInterview.difficulty,
              overallScore: lastInterview.finalEvaluation?.overallScore,
            }
          : null,
      });

      initialAssistantMessage = greeting;
    }

    // Persist new training session
    const session = await AITrainingSession.create({
      clerkUserId,
      sourceInterviewId: sourceInterviewId || null,
      topic: initialTopic,
      difficulty: initialDifficulty,
      status: 'active',
      contextType,
      currentQuestionText: currentQuestionText || null,
      questionHistory: currentQuestionText ? [currentQuestionText] : [],
    });

    // Create initial assistant message in session
    const firstMsg = await AITrainingMessage.create({
      sessionId: session._id,
      clerkUserId,
      role: 'assistant',
      content: initialAssistantMessage,
      metadata: {
        isQuestion: Boolean(currentQuestionText),
        topic: initialTopic,
        difficulty: initialDifficulty,
      },
    });

    return sendSuccess(
      res,
      {
        session: {
          id: session._id,
          topic: session.topic,
          difficulty: session.difficulty,
          status: session.status,
          contextType: session.contextType,
          sourceInterviewId: session.sourceInterviewId,
          createdAt: session.createdAt,
        },
        messages: [
          {
            id: firstMsg._id,
            role: firstMsg.role,
            content: firstMsg.content,
            metadata: firstMsg.metadata,
            createdAt: firstMsg.createdAt,
          },
        ],
      },
      201
    );
  } catch (err) {
    console.error('[AICoachController] createSession error:', err);
    return sendError(res, 500, 'COACH_SESSION_CREATE_ERROR', 'Could not create training session.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET SESSIONS (LIST)
// ─────────────────────────────────────────────────────────────────────────────

const getSessions = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;

    const sessions = await AITrainingSession.find({ clerkUserId })
      .sort({ updatedAt: -1 })
      .limit(10);

    return sendSuccess(res, {
      sessions: sessions.map((s) => ({
        id: s._id,
        topic: s.topic,
        difficulty: s.difficulty,
        status: s.status,
        contextType: s.contextType,
        sourceInterviewId: s.sourceInterviewId,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[AICoachController] getSessions error:', err);
    return sendError(res, 500, 'COACH_SESSIONS_FETCH_ERROR', 'Could not retrieve training sessions.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET SESSION DETAILS & MESSAGE HISTORY
// ─────────────────────────────────────────────────────────────────────────────

const getSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;

    const session = await AITrainingSession.findOne({ _id: id, clerkUserId });
    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Training session not found or unauthorized.');
    }

    const messages = await AITrainingMessage.find({ sessionId: id, clerkUserId })
      .sort({ createdAt: 1 })
      .limit(100);

    return sendSuccess(res, {
      session: {
        id: session._id,
        topic: session.topic,
        difficulty: session.difficulty,
        status: session.status,
        contextType: session.contextType,
        sourceInterviewId: session.sourceInterviewId,
        currentQuestionText: session.currentQuestionText,
      },
      messages: messages.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('[AICoachController] getSession error:', err);
    return sendError(res, 500, 'COACH_SESSION_FETCH_ERROR', 'Could not load training session.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST MESSAGE (INTERACTIVE TRAINING LOOP & ANSWER EVALUATION)
// ─────────────────────────────────────────────────────────────────────────────

const postMessage = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return sendError(res, 400, 'EMPTY_MESSAGE', 'Message content is required.');
    }

    const session = await AITrainingSession.findOne({ _id: id, clerkUserId });
    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Training session not found or unauthorized.');
    }

    // 1. Save candidate message
    const userMsg = await AITrainingMessage.create({
      sessionId: session._id,
      clerkUserId,
      role: 'user',
      content: content.trim(),
    });

    let assistantContent = '';
    let messageMetadata = {};

    // 2. Check if we are answering an active practice question
    if (session.currentQuestionText) {
      const currentQ = session.currentQuestionText;

      // Evaluate the candidate's answer interactively
      const evalResult = await aiCoachService.evaluatePracticeAnswer({
        question: currentQ,
        answer: content.trim(),
        topic: session.topic,
        difficulty: session.difficulty,
        history: session.questionHistory || [],
      });

      // Format feedback in rich conversational markdown
      const formattedResponse =
        `${evalResult.feedbackMarkdown}\n\n` +
        `---\n\n` +
        `**Next Question (${evalResult.newDifficulty || session.difficulty}):**\n` +
        `${evalResult.nextQuestion}`;

      assistantContent = formattedResponse;
      messageMetadata = {
        isEvaluation: true,
        score: evalResult.score,
        strengths: evalResult.strengths,
        missingConcepts: evalResult.missingConcepts,
        conceptExplanation: evalResult.conceptExplanation,
        hint: evalResult.hint,
        newDifficulty: evalResult.newDifficulty,
        topic: session.topic,
      };

      // Update session state
      session.currentQuestionText = evalResult.nextQuestion;
      session.difficulty = evalResult.newDifficulty || session.difficulty;
      if (!session.questionHistory) session.questionHistory = [];
      session.questionHistory.push(evalResult.nextQuestion);
      await session.save();

      // Update training progress
      await aiCoachService.updateTrainingProgress({
        clerkUserId,
        topic: session.topic,
        evaluationScore: evalResult.score,
      });
    } else {
      // 3. Freeform conversational coaching
      const history = await AITrainingMessage.find({ sessionId: session._id, clerkUserId })
        .sort({ createdAt: -1 })
        .limit(8);

      const formattedHistory = history.reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));

      assistantContent = await aiCoachService.generateCoachResponse({
        messages: formattedHistory,
        sessionContext: {
          topic: session.topic,
          difficulty: session.difficulty,
          contextType: session.contextType,
        },
      });

      messageMetadata = {
        isConversational: true,
      };
    }

    // 4. Save assistant response
    const assistantMsg = await AITrainingMessage.create({
      sessionId: session._id,
      clerkUserId,
      role: 'assistant',
      content: assistantContent,
      metadata: messageMetadata,
    });

    return sendSuccess(res, {
      userMessage: {
        id: userMsg._id,
        role: userMsg.role,
        content: userMsg.content,
        createdAt: userMsg.createdAt,
      },
      assistantMessage: {
        id: assistantMsg._id,
        role: assistantMsg.role,
        content: assistantMsg.content,
        metadata: assistantMsg.metadata,
        createdAt: assistantMsg.createdAt,
      },
      session: {
        topic: session.topic,
        difficulty: session.difficulty,
        currentQuestionText: session.currentQuestionText,
      },
    });
  } catch (err) {
    console.error('[AICoachController] postMessage error:', err);
    return sendError(res, 500, 'COACH_MESSAGE_ERROR', 'Could not process training message.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. CONTEXTUAL QUICK ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

const handleQuickAction = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;
    const { action } = req.body;

    const session = await AITrainingSession.findOne({ _id: id, clerkUserId });
    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Session not found.');
    }

    let assistantContent = '';
    let newQuestion = null;
    let newTopic = session.topic;

    // Check user's resume
    const latestResume = await Resume.findOne({
      clerkUserId,
      processingStatus: 'completed',
    }).sort({ createdAt: -1 });

    if (action === 'train_me') {
      if (!latestResume || !latestResume.parsedData) {
        assistantContent =
          `I noticed you don't have an active resume uploaded yet.\n\n` +
          `To tailor training specifically to your target role, skills, and projects, please upload your resume using the button below. Once uploaded, I'll extract your core technical profile and start a personalized training program!`;
      } else {
        const skills = (latestResume.parsedData.skills || []).map((s) => s.canonicalName || s.name);
        const topSkills = skills.slice(0, 3).join(', ') || 'modern software engineering';
        newTopic = latestResume.parsedData.basicInfo?.targetRole || skills[0] || 'System Architecture';

        const q = await aiCoachService.generatePracticeQuestion({
          topic: newTopic,
          difficulty: session.difficulty,
          previousQuestions: session.questionHistory || [],
          context: { note: `Candidate has verified background in ${topSkills}` },
        });

        newQuestion = q.questionText;
        assistantContent =
          `🎯 **Starting Personalized Training Session**\n\n` +
          `Based on your resume, we'll focus on **${newTopic}** (Difficulty: **${session.difficulty}**).\n\n` +
          `**Exercise:**\n${newQuestion}\n\n` +
          `💡 *Hint:* Take a moment to structure your reasoning before answering.`;
      }
    } else if (action === 'practice_questions') {
      const q = await aiCoachService.generatePracticeQuestion({
        topic: session.topic,
        difficulty: session.difficulty,
        previousQuestions: session.questionHistory || [],
      });
      newQuestion = q.questionText;
      assistantContent =
        `📝 **Practice Question — ${session.topic} (${session.difficulty})**\n\n` +
        `${newQuestion}\n\n` +
        `Share your solution or approach below, and I'll evaluate your trade-offs!`;
    } else if (action === 'weak_areas') {
      const pastInterviews = await Interview.find({ clerkUserId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(3);

      const weakAreas = [];
      for (const inv of pastInterviews) {
        if (inv.finalEvaluation?.weakAreas) weakAreas.push(...inv.finalEvaluation.weakAreas);
      }

      newTopic = weakAreas[0] || 'System Scalability & Edge Cases';

      const q = await aiCoachService.generatePracticeQuestion({
        topic: newTopic,
        difficulty: session.difficulty,
        previousQuestions: session.questionHistory || [],
      });
      newQuestion = q.questionText;

      assistantContent =
        `⚡ **Targeted Weak-Area Drill: ${newTopic}**\n\n` +
        `Based on observed interview data, let's strengthen this concept with an active recall challenge:\n\n` +
        `${newQuestion}\n\n` +
        `💡 Focus on explaining *why* you chose this approach over alternatives.`;
    } else if (action === 'analyze_interviews') {
      const pastInterviews = await Interview.find({ clerkUserId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(5);

      if (pastInterviews.length === 0) {
        assistantContent = `You haven't completed any mock interviews yet! Take a practice interview first, and I'll break down your trends, acoustic pacing, and technical strengths right here.`;
      } else {
        const scores = pastInterviews.map((i) => i.finalEvaluation?.overallScore || 0);
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const latestRole = pastInterviews[0].targetRole;

        assistantContent =
          `📊 **Historical Interview Performance Summary**\n\n` +
          `- **Sessions Completed:** ${pastInterviews.length}\n` +
          `- **Average Score:** ${avgScore}/100\n` +
          `- **Latest Role:** ${latestRole}\n\n` +
          `Ready to drill into a specific skill to boost your scores? Click **Train me** to begin an exercise.`;
      }
    } else {
      assistantContent = `I received your action request. How can I help you train today?`;
    }

    if (newQuestion) {
      session.currentQuestionText = newQuestion;
      session.topic = newTopic;
      if (!session.questionHistory) session.questionHistory = [];
      session.questionHistory.push(newQuestion);
      await session.save();
    }

    const assistantMsg = await AITrainingMessage.create({
      sessionId: session._id,
      clerkUserId,
      role: 'assistant',
      content: assistantContent,
      metadata: {
        action,
        topic: newTopic,
        isQuestion: Boolean(newQuestion),
      },
    });

    return sendSuccess(res, {
      assistantMessage: {
        id: assistantMsg._id,
        role: assistantMsg.role,
        content: assistantMsg.content,
        metadata: assistantMsg.metadata,
        createdAt: assistantMsg.createdAt,
      },
      session: {
        topic: session.topic,
        difficulty: session.difficulty,
        currentQuestionText: session.currentQuestionText,
      },
    });
  } catch (err) {
    console.error('[AICoachController] handleQuickAction error:', err);
    return sendError(res, 500, 'QUICK_ACTION_ERROR', 'Could not handle quick action.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. CHATGPT-STYLE CONVERSATIONS API
// ─────────────────────────────────────────────────────────────────────────────

const getConversations = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const conversations = await AIConversation.find({ clerkUserId, status: 'active' })
      .sort({ updatedAt: -1 })
      .limit(30);

    return sendSuccess(res, {
      conversations: conversations.map((c) => ({
        id: c._id,
        title: c.title,
        contextType: c.contextType,
        sourceInterviewId: c.sourceInterviewId,
        topic: c.topic,
        difficulty: c.difficulty,
        lastMessagePreview: c.lastMessagePreview,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[AICoachController] getConversations error:', err);
    return sendError(res, 500, 'CONVERSATIONS_FETCH_ERROR', 'Could not retrieve conversations.', err.message);
  }
};

const createConversation = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { title, contextType = 'dashboard', sourceInterviewId = null, topic = null } = req.body;

    let initialTitle = title || (contextType === 'results' ? 'Interview Performance Review' : 'New Chat');
    let initialTopic = topic || 'General Technical Preparation';
    let initialDifficulty = 'Intermediate';
    let initialAssistantMessage = '';
    let initialSuggestions = [];

    if (contextType === 'results' && sourceInterviewId) {
      // Authorize interview ownership
      const interview = await Interview.findOne({ _id: sourceInterviewId, clerkUserId });
      if (!interview) {
        return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview not found or unauthorized.');
      }

      initialTitle = `Review: ${interview.targetRole || 'Technical Interview'}`;
      initialTopic = interview.targetRole || 'System Design';

      const [questions, responses] = await Promise.all([
        Question.find({ interviewId: sourceInterviewId }).sort({ order: 1 }),
        Response.find({ interviewId: sourceInterviewId }),
      ]);

      const questionBreakdown = questions.map((q) => {
        const resp = responses.find((r) => r.questionId.toString() === q._id.toString());
        return {
          text: q.text,
          category: q.category,
          score: resp?.multimodalEvaluation?.overallScore ?? resp?.textEvaluation?.textScore ?? null,
          textScore: resp?.textEvaluation?.textScore ?? null,
          missingConcepts: resp?.textEvaluation?.missingConcepts || [],
          feedback: resp?.textEvaluation?.feedback || null,
        };
      });

      const analysis = await aiCoachService.analyzeInterview(interview, questionBreakdown);
      initialAssistantMessage = `${analysis.startingExercisePrompt}\n\n**Starting Exercise:**\n${analysis.recommendedStartingQuestion}`;
      initialSuggestions = ['Explain my mistakes', 'Start Day 1 Practice', 'Give me another question'];
    } else {
      const [latestResume, lastInterview] = await Promise.all([
        Resume.findOne({ clerkUserId, processingStatus: 'completed' }).sort({ createdAt: -1 }),
        Interview.findOne({ clerkUserId, status: 'completed' }).sort({ completedAt: -1 }),
      ]);

      initialAssistantMessage = await aiCoachService.generateCoachGreeting({
        resumeSummary: latestResume?.parsedData
          ? {
              targetRole: latestResume.parsedData.basicInfo?.targetRole,
              skills: (latestResume.parsedData.skills || []).map((s) => s.canonicalName || s.name),
            }
          : null,
        lastInterview: lastInterview
          ? {
              targetRole: lastInterview.targetRole,
              difficulty: lastInterview.difficulty,
              overallScore: lastInterview.finalEvaluation?.overallScore,
            }
          : null,
      });

      initialSuggestions = ['Practice interview questions', 'Create a 7-day plan', 'Analyze my weak areas'];
    }

    const conversation = await AIConversation.create({
      clerkUserId,
      title: initialTitle,
      contextType,
      sourceInterviewId: sourceInterviewId || null,
      topic: initialTopic,
      difficulty: initialDifficulty,
      lastMessagePreview: initialAssistantMessage.slice(0, 100),
      state: {
        goal: null,
        learningTrack: initialTopic,
        currentMode: contextType === 'results' ? 'results_coaching' : 'general_chat',
        currentDay: null,
        currentTopic: initialTopic,
        activeInterviewId: sourceInterviewId ? String(sourceInterviewId) : null,
        currentQuestion: {
          difficulty: initialDifficulty,
          questionNumber: 1,
        },
        currentExercise: {
          status: 'idle',
        },
      },
    });

    const firstMsg = await AIMessage.create({
      conversationId: conversation._id,
      clerkUserId,
      role: 'assistant',
      content: initialAssistantMessage,
      metadata: {
        suggestions: initialSuggestions,
      },
    });

    return sendSuccess(
      res,
      {
        conversation: {
          id: conversation._id,
          title: conversation.title,
          contextType: conversation.contextType,
          sourceInterviewId: conversation.sourceInterviewId,
          topic: conversation.topic,
          difficulty: conversation.difficulty,
          updatedAt: conversation.updatedAt,
        },
        messages: [
          {
            id: firstMsg._id,
            role: firstMsg.role,
            content: firstMsg.content,
            attachments: firstMsg.attachments,
            feedback: firstMsg.feedback,
            metadata: firstMsg.metadata,
            createdAt: firstMsg.createdAt,
          },
        ],
      },
      201
    );
  } catch (err) {
    console.error('[AICoachController] createConversation error:', err);
    return sendError(res, 500, 'CONVERSATION_CREATE_ERROR', 'Could not create conversation.', err.message);
  }
};

const getConversation = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;

    const conversation = await AIConversation.findOne({ _id: id, clerkUserId });
    if (!conversation) {
      return sendError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found or unauthorized.');
    }

    const messages = await AIMessage.find({ conversationId: id, clerkUserId })
      .sort({ createdAt: 1 })
      .limit(100);

    return sendSuccess(res, {
      conversation: {
        id: conversation._id,
        title: conversation.title,
        contextType: conversation.contextType,
        sourceInterviewId: conversation.sourceInterviewId,
        topic: conversation.topic,
        difficulty: conversation.difficulty,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        attachments: m.attachments,
        feedback: m.feedback,
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('[AICoachController] getConversation error:', err);
    return sendError(res, 500, 'CONVERSATION_FETCH_ERROR', 'Could not load conversation.', err.message);
  }
};

const deleteConversation = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;

    const conversation = await AIConversation.findOneAndUpdate(
      { _id: id, clerkUserId },
      { status: 'archived' }
    );
    if (!conversation) {
      return sendError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }

    return sendSuccess(res, { message: 'Conversation archived successfully.' });
  } catch (err) {
    console.error('[AICoachController] deleteConversation error:', err);
    return sendError(res, 500, 'CONVERSATION_DELETE_ERROR', 'Could not archive conversation.', err.message);
  }
};

const postConversationMessage = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;
    const { content = '', attachments = [] } = req.body;

    if (!content.trim() && (!attachments || attachments.length === 0)) {
      return sendError(res, 400, 'EMPTY_MESSAGE', 'Message content or attachment is required.');
    }

    const conversation = await AIConversation.findOne({ _id: id, clerkUserId });
    if (!conversation) {
      return sendError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }

    // Save user message
    const userMsg = await AIMessage.create({
      conversationId: conversation._id,
      clerkUserId,
      role: 'user',
      content: content.trim() || (attachments[0] ? `Attached file: ${attachments[0].name}` : ''),
      attachments,
    });

    // Auto-update conversation title if still default
    if (conversation.title === 'New Chat' || conversation.title === 'New Conversation') {
      conversation.title = aiCoachService.generateConversationTitle(content);
    }

    // Retrieve recent conversation history
    const history = await AIMessage.find({ conversationId: conversation._id, clerkUserId })
      .sort({ createdAt: 1 })
      .limit(12);

    // Retrieve candidate background context
    const [latestResume, pastInterviews, candidateProfileRecord] = await Promise.all([
      Resume.findOne({ clerkUserId, processingStatus: 'completed' }).sort({ createdAt: -1 }),
      Interview.find({ clerkUserId, status: 'completed' }).sort({ completedAt: -1 }).limit(3),
      AITrainingProfile.findOne({ clerkUserId }),
    ]);

    const parsedData = latestResume?.parsedData || {};
    const resumeSkills = (parsedData.skills || []).map((s) => s.canonicalName || s.name || s);
    const resumeExperience = (parsedData.experience || [])
      .map((e) => `${e.title || ''} at ${e.company || ''} (${e.duration || ''})`.trim())
      .filter(Boolean);
    const resumeProjects = (parsedData.projects || [])
      .map((p) => `${p.name || p.title || ''}: ${p.description || ''}`.trim())
      .filter(Boolean);
    const targetRole =
      parsedData.basicInfo?.targetRole ||
      candidateProfileRecord?.targetRole ||
      pastInterviews[0]?.targetRole ||
      'Software Engineer';
    const yearsOfExperience =
      parsedData.basicInfo?.yearsOfExperience || candidateProfileRecord?.yearsOfExperience || 0;

    // Resolve candidate name from resume or profile
    const candidateName = parsedData.basicInfo?.name || candidateProfileRecord?.candidateName || 'Candidate';


    // Retrieve specific source interview context if linked
    let sourceInterviewContext = null;
    if (conversation.sourceInterviewId) {
      try {
        const sourceInterview = await Interview.findOne({
          _id: conversation.sourceInterviewId,
          clerkUserId,
        }).lean();

        if (sourceInterview) {
          const [sourceQuestions, sourceResponses] = await Promise.all([
            Question.find({ interviewId: sourceInterview._id }).sort({ order: 1 }).lean(),
            Response.find({ interviewId: sourceInterview._id }).lean(),
          ]);

          const respMap = new Map(sourceResponses.map((r) => [String(r.questionId), r]));
          const questionBreakdown = sourceQuestions.map((q, idx) => {
            const resp = respMap.get(String(q._id));
            return {
              number: idx + 1,
              question: q.text,
              type: q.type,
              category: q.category,
              difficulty: q.difficulty,
              targetSkill: q.targetSkill || q.skill,
              status: q.status,
              userAnswer: resp?.answerText || resp?.code || null,
              score: resp?.textEvaluation?.textScore ?? resp?.evaluation?.score ?? null,
              feedback: resp?.textEvaluation?.feedback || resp?.evaluation?.feedback || null,
              strengths: resp?.textEvaluation?.strengths || [],
              missingConcepts: resp?.textEvaluation?.missingConcepts || [],
            };
          });

          sourceInterviewContext = {
            interviewId: String(sourceInterview._id),
            targetRole: sourceInterview.targetRole,
            difficulty: sourceInterview.difficulty,
            overallScore: sourceInterview.finalEvaluation?.overallScore ?? null,
            technicalScore: sourceInterview.finalEvaluation?.technicalScore ?? null,
            communicationScore: sourceInterview.finalEvaluation?.communicationScore ?? null,
            weakAreas: sourceInterview.finalEvaluation?.weakAreas || [],
            strongAreas: sourceInterview.finalEvaluation?.strongAreas || [],
            questionBreakdown,
          };
        }
      } catch (sourceErr) {
        console.warn('[AICoachController] Could not load source interview context:', sourceErr.message);
      }
    }

    const chatResponse = await aiCoachService.chat({
      message: content,
      history,
      attachments,
      currentTopic: conversation.topic,
      currentDifficulty: conversation.difficulty,
      conversationState: conversation.state || null,
      context: {
        candidateName,
        targetRole,
        yearsOfExperience,
        resumeSkills,
        resumeExperience,
        resumeProjects,
        hasResume: Boolean(latestResume || attachments.some((a) => a.isResume)),
        rawExtractedSnippet: latestResume?.extractedText
          ? latestResume.extractedText.slice(0, 1500)
          : attachments[0]?.extractedSnippet || '',
        interviewWeaknesses: pastInterviews.flatMap((i) => i.finalEvaluation?.weakAreas || []),
        sourceInterviewContext,
      },
    });

    // Apply any updated conversation state returned from the AI engine
    if (chatResponse.updatedState) {
      if (!conversation.state) conversation.state = {};
      const us = chatResponse.updatedState;
      if (us.goal !== undefined) conversation.state.goal = us.goal;
      if (us.learningTrack !== undefined) conversation.state.learningTrack = us.learningTrack;
      if (us.currentMode !== undefined) conversation.state.currentMode = us.currentMode;
      if (us.currentDay !== undefined) conversation.state.currentDay = us.currentDay;
      if (us.currentTopic !== undefined) {
        conversation.state.currentTopic = us.currentTopic;
        conversation.topic = us.currentTopic;
      }
      if (us.currentQuestion) {
        if (!conversation.state.currentQuestion) conversation.state.currentQuestion = {};
        Object.assign(conversation.state.currentQuestion, us.currentQuestion);
        if (us.currentQuestion.difficulty) {
          conversation.difficulty = us.currentQuestion.difficulty;
        }
      }
      if (us.currentExercise) {
        if (!conversation.state.currentExercise) conversation.state.currentExercise = {};
        Object.assign(conversation.state.currentExercise, us.currentExercise);
      }
      if (us.plan) {
        conversation.state.plan = us.plan;
      }
    }

    // Save assistant message
    const assistantMsg = await AIMessage.create({
      conversationId: conversation._id,
      clerkUserId,
      role: 'assistant',
      content: chatResponse.content,
      metadata: {
        intent: chatResponse.intent,
        suggestions: chatResponse.suggestions,
        ...chatResponse.metadata,
      },
    });

    // Update conversation metadata
    conversation.lastMessagePreview = chatResponse.content.slice(0, 100);
    await conversation.save();

    return sendSuccess(res, {
      userMessage: {
        id: userMsg._id,
        role: userMsg.role,
        content: userMsg.content,
        attachments: userMsg.attachments,
        createdAt: userMsg.createdAt,
      },
      assistantMessage: {
        id: assistantMsg._id,
        role: assistantMsg.role,
        content: assistantMsg.content,
        feedback: assistantMsg.feedback,
        metadata: assistantMsg.metadata,
        createdAt: assistantMsg.createdAt,
      },
      conversation: {
        id: conversation._id,
        title: conversation.title,
        topic: conversation.topic,
        difficulty: conversation.difficulty,
        state: conversation.state,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (err) {
    console.error('[AICoachController] postConversationMessage error:', err);
    return sendError(res, 500, 'CONVERSATION_MESSAGE_ERROR', 'Could not process chat message.', err.message);
  }
};

const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'NO_FILE', 'No file was uploaded.');
    }

    const clerkUserId = req.clerkUserId;
    let extractedText = '';
    let extractedSnippet = null;
    let candidateProfile = null;
    let resumeRecord = null;
    let isResume = false;

    try {
      extractedText = await extractTextFromFile(req.file.path, req.file.mimetype);
      extractedSnippet = extractedText ? extractedText.slice(0, 1500) : null;
    } catch (parseErr) {
      console.warn('[AICoachController] Attachment text extract notice:', parseErr.message);
      return sendError(res, 422, 'TEXT_EXTRACTION_FAILED', 'Could not extract text from this file. ' + parseErr.message);
    }

    const lowerName = req.file.originalname.toLowerCase();
    const isDocOrPdf =
      req.file.mimetype.includes('pdf') ||
      req.file.mimetype.includes('word') ||
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md');

    if (extractedText && extractedText.length >= 10 && isDocOrPdf) {
      try {
        candidateProfile = analyzeResume(extractedText);
        const hasSkills = Array.isArray(candidateProfile?.skills) && candidateProfile.skills.length > 0;
        const hasProjects = Array.isArray(candidateProfile?.projects) && candidateProfile.projects.length > 0;
        const hasExp = Array.isArray(candidateProfile?.experience) && candidateProfile.experience.length > 0;

        if (hasSkills || hasProjects || hasExp || lowerName.includes('resume') || lowerName.includes('cv')) {
          isResume = true;

          // 1. Persist/update Resume in database
          resumeRecord = await Resume.create({
            clerkUserId,
            originalName: req.file.originalname,
            storedFilename: req.file.filename,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            extractedText,
            parsedData: candidateProfile,
            processingStatus: 'completed',
          });

          // 2. Persist/update AITrainingProfile
          const targetRole = candidateProfile.basicInfo?.targetRole || 'Software Engineer';
          const skillNames = (candidateProfile.skills || []).map((s) => s.canonicalName || s.name);
          const yearsExp = candidateProfile.basicInfo?.yearsOfExperience || 0;

          await AITrainingProfile.findOneAndUpdate(
            { clerkUserId },
            {
              $set: {
                targetRole,
                skills: skillNames,
                yearsOfExperience: yearsExp,
                summary: `Profile for ${targetRole} skilled in ${skillNames.slice(0, 5).join(', ')}`,
                resumeId: resumeRecord._id,
                lastAnalyzedResumeId: resumeRecord._id,
              },
            },
            { upsert: true }
          );
        }
      } catch (analysisErr) {
        console.warn('[AICoachController] Resume parsing warning:', analysisErr.message);
      }
    }

    return sendSuccess(
      res,
      {
        attachment: {
          id: resumeRecord ? resumeRecord._id : undefined,
          name: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          fileUrl: `/uploads/${req.file.filename}`,
          extractedSnippet,
          isResume,
          status: 'processed',
          candidateProfile: candidateProfile
            ? {
                targetRole: candidateProfile.basicInfo?.targetRole,
                skills: (candidateProfile.skills || []).map((s) => s.canonicalName || s.name),
                yearsOfExperience: candidateProfile.basicInfo?.yearsOfExperience,
                projectsCount: candidateProfile.projects?.length || 0,
              }
            : null,
        },
      },
      201
    );
  } catch (err) {
    console.error('[AICoachController] uploadAttachment error:', err);
    return sendError(res, 500, 'ATTACHMENT_UPLOAD_ERROR', 'Could not upload attachment.', err.message);
  }
};

const rateMessageFeedback = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;
    const { rating } = req.body; // 'like' | 'dislike' | null

    const msg = await AIMessage.findOneAndUpdate(
      { _id: id, clerkUserId },
      { feedback: rating },
      { new: true }
    );

    if (!msg) {
      await AITrainingMessage.findOneAndUpdate(
        { _id: id, clerkUserId },
        { 'metadata.feedback': rating }
      );
    }

    return sendSuccess(res, { feedback: rating });
  } catch (err) {
    console.error('[AICoachController] rateMessageFeedback error:', err);
    return sendError(res, 500, 'FEEDBACK_ERROR', 'Could not update message feedback.', err.message);
  }
};

module.exports = {
  getProfile,
  getProgress,
  createSession,
  getSessions,
  getSession,
  postMessage,
  handleQuickAction,
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  postConversationMessage,
  uploadAttachment,
  rateMessageFeedback,
};

