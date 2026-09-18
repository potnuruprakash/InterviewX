/**
 * Chat Controller — Dedicated Endpoints for Dashboard AI and Results AI
 *
 * Implements strict zero-shared-history isolation between Dashboard and Results chatbots.
 * Guarantees result-scoping and multi-tenant authorization.
 */

const mongoose = require('mongoose');
const AIConversation = require('../models/AIConversation');
const AIMessage = require('../models/AIMessage');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');
const Resume = require('../models/Resume');
const AITrainingProfile = require('../models/AITrainingProfile');
const aiCoachService = require('../services/aiCoachService');
const { sendSuccess, sendError } = require('../utils/errorHandler');

const DASHBOARD_WELCOME_MESSAGE = `Dashboard AI 👋

Hi! I'm your InterviewX AI assistant.

I can help you with:
• Technical concepts
• Coding
• Resume
• Projects
• Interview preparation
• Career guidance

How can I help you?`;

const RESULTS_WELCOME_MESSAGE = `Results AI 📊

Hi! I can help you understand your interview results.

You can ask me about:
• Your score
• Weak areas
• Feedback
• Individual questions
• Improvement strategies
• Study plans

What would you like to understand?`;

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD CHATBOT CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/chat/dashboard/sessions
 * Returns only Dashboard conversations for the authenticated user
 */
const getDashboardSessions = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const sessions = await AIConversation.find({
      clerkUserId,
      contextType: 'dashboard',
      sourceInterviewId: null,
      status: 'active',
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    return sendSuccess(res, {
      sessions: sessions.map((s) => ({
        id: s._id,
        title: s.title,
        contextType: s.contextType,
        lastMessagePreview: s.lastMessagePreview,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('[ChatController] getDashboardSessions error:', err);
    return sendError(res, 500, 'DASHBOARD_SESSIONS_ERROR', 'Could not retrieve Dashboard chat sessions.', err.message);
  }
};

/**
 * POST /api/chat/dashboard/sessions
 * Creates a brand new Dashboard chat session with the initial welcome greeting
 */
const createDashboardSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;

    const session = await AIConversation.create({
      clerkUserId,
      title: 'New Chat',
      contextType: 'dashboard',
      sourceInterviewId: null,
      topic: 'General Interview Preparation',
      difficulty: 'Intermediate',
      lastMessagePreview: DASHBOARD_WELCOME_MESSAGE.slice(0, 100),
      status: 'active',
    });

    const initialMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'assistant',
      content: DASHBOARD_WELCOME_MESSAGE,
      metadata: {
        isWelcome: true,
        chatType: 'dashboard',
        suggestions: [
          'Explain Django MVT',
          'What are MongoDB indexes?',
          'Help me understand REST APIs',
          'How should I prepare for backend development?',
        ],
      },
    });

    return sendSuccess(
      res,
      {
        session: {
          id: session._id,
          title: session.title,
          contextType: session.contextType,
          updatedAt: session.updatedAt,
          createdAt: session.createdAt,
        },
        messages: [
          {
            id: initialMsg._id,
            role: initialMsg.role,
            content: initialMsg.content,
            metadata: initialMsg.metadata,
            createdAt: initialMsg.createdAt,
          },
        ],
      },
      201
    );
  } catch (err) {
    console.error('[ChatController] createDashboardSession error:', err);
    return sendError(res, 500, 'DASHBOARD_CREATE_SESSION_ERROR', 'Could not create Dashboard session.', err.message);
  }
};

/**
 * GET /api/chat/dashboard/sessions/:id
 * Retrieves a specific Dashboard session and its messages
 */
const getDashboardSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'INVALID_SESSION_ID', 'Invalid session ID provided.');
    }

    const session = await AIConversation.findOne({
      _id: id,
      clerkUserId,
      contextType: 'dashboard',
      sourceInterviewId: null,
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Dashboard chat session not found or unauthorized.');
    }

    const messages = await AIMessage.find({
      conversationId: session._id,
      clerkUserId,
    })
      .sort({ createdAt: 1 })
      .limit(100);

    return sendSuccess(res, {
      session: {
        id: session._id,
        title: session.title,
        contextType: session.contextType,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
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
    console.error('[ChatController] getDashboardSession error:', err);
    return sendError(res, 500, 'DASHBOARD_GET_SESSION_ERROR', 'Could not retrieve Dashboard session.', err.message);
  }
};

/**
 * DELETE /api/chat/dashboard/sessions/:id
 * Archives a Dashboard conversation
 */
const deleteDashboardSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'INVALID_SESSION_ID', 'Invalid session ID provided.');
    }

    const session = await AIConversation.findOneAndUpdate(
      {
        _id: id,
        clerkUserId,
        contextType: 'dashboard',
        sourceInterviewId: null,
      },
      { status: 'archived' }
    );

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Dashboard chat session not found.');
    }

    return sendSuccess(res, { message: 'Dashboard chat session archived successfully.' });
  } catch (err) {
    console.error('[ChatController] deleteDashboardSession error:', err);
    return sendError(res, 500, 'DASHBOARD_DELETE_SESSION_ERROR', 'Could not archive session.', err.message);
  }
};

/**
 * POST /api/chat/dashboard/sessions/:id/messages
 * Posts a message to a Dashboard session and generates an AI assistant response
 */
const postDashboardMessage = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;
    const { content = '', attachments = [] } = req.body;

    if (!content.trim() && (!attachments || attachments.length === 0)) {
      return sendError(res, 400, 'EMPTY_MESSAGE', 'Message content or attachment is required.');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'INVALID_SESSION_ID', 'Invalid session ID provided.');
    }

    const session = await AIConversation.findOne({
      _id: id,
      clerkUserId,
      contextType: 'dashboard',
      sourceInterviewId: null,
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Dashboard chat session not found or unauthorized.');
    }

    // Save user message
    const userMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'user',
      content: content.trim() || (attachments[0] ? `Attached file: ${attachments[0].name}` : ''),
      attachments,
    });

    // Auto-update conversation title from first meaningful user message if still default
    if (session.title === 'New Chat' || session.title === 'New Conversation') {
      session.title = aiCoachService.generateChatTitle(content, 'dashboard');
    }

    // Retrieve conversation history
    const historyDocs = await AIMessage.find({
      conversationId: session._id,
      clerkUserId,
    })
      .sort({ createdAt: 1 })
      .limit(12);

    const history = historyDocs.map((m) => ({ role: m.role, content: m.content }));

    // Retrieve background context (resume, candidate name)
    const [latestResume, candidateProfile] = await Promise.all([
      Resume.findOne({ clerkUserId, processingStatus: 'completed' }).sort({ createdAt: -1 }),
      AITrainingProfile.findOne({ clerkUserId }),
    ]);

    const parsedData = latestResume?.parsedData || {};
    const skills = (parsedData.skills || []).map((s) => s.canonicalName || s.name || s);
    const projects = (parsedData.projects || []).map((p) => p.name || p.title || '').filter(Boolean);
    const targetRole = parsedData.basicInfo?.targetRole || candidateProfile?.targetRole || 'Software Engineer';
    const candidateName = parsedData.basicInfo?.name || candidateProfile?.candidateName || null;

    // Generate response using Dashboard AI Assistant prompt
    const aiResult = await aiCoachService.generateDashboardAssistantResponse({
      message: content,
      history,
      context: {
        candidateName,
        targetRole,
        skills,
        projects,
      },
    });

    // Save assistant message
    const assistantMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'assistant',
      content: aiResult.content,
      metadata: {
        chatType: 'dashboard',
        suggestions: [
          'Explain Django MVT',
          'What are MongoDB indexes?',
          'Help me understand REST APIs',
          'How should I prepare for backend development?',
        ],
      },
    });

    // Update conversation metadata
    session.lastMessagePreview = aiResult.content.slice(0, 100);
    session.updatedAt = new Date();
    await session.save();

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
        metadata: assistantMsg.metadata,
        createdAt: assistantMsg.createdAt,
      },
      session: {
        id: session._id,
        title: session.title,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err) {
    console.error('[ChatController] postDashboardMessage error:', err);
    return sendError(res, 500, 'DASHBOARD_POST_MESSAGE_ERROR', 'Could not process Dashboard message.', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS CHATBOT CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/chat/results/:resultId/sessions
 * Returns only Results conversations specifically associated with the requested interview result
 */
const getResultSessions = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { resultId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      return sendError(res, 400, 'INVALID_RESULT_ID', 'Invalid result ID provided.');
    }

    // Verify interview result belongs to the authenticated user
    const interview = await Interview.findOne({ _id: resultId, clerkUserId });
    if (!interview) {
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview result not found or unauthorized.');
    }

    const sessions = await AIConversation.find({
      clerkUserId,
      contextType: 'results',
      sourceInterviewId: resultId,
      status: 'active',
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    return sendSuccess(res, {
      sessions: sessions.map((s) => ({
        id: s._id,
        title: s.title,
        contextType: s.contextType,
        sourceInterviewId: s.sourceInterviewId,
        lastMessagePreview: s.lastMessagePreview,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
      })),
      interview: {
        id: interview._id,
        targetRole: interview.targetRole,
        overallScore: interview.finalEvaluation?.overallScore ?? null,
      },
    });
  } catch (err) {
    console.error('[ChatController] getResultSessions error:', err);
    return sendError(res, 500, 'RESULT_SESSIONS_ERROR', 'Could not retrieve Results chat sessions.', err.message);
  }
};

/**
 * POST /api/chat/results/:resultId/sessions
 * Creates a brand new Results chat session connected to the specific interview result
 */
const createResultSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { resultId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      return sendError(res, 400, 'INVALID_RESULT_ID', 'Invalid result ID provided.');
    }

    // Verify interview ownership
    const interview = await Interview.findOne({ _id: resultId, clerkUserId });
    if (!interview) {
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview result not found or unauthorized.');
    }

    const defaultTitle = interview.targetRole
      ? `Review: ${interview.targetRole}`
      : 'Interview Result Analysis';

    let convDifficulty = 'Intermediate';
    if (interview.difficulty === 'easy') convDifficulty = 'Beginner';
    else if (interview.difficulty === 'hard') convDifficulty = 'Advanced';
    else if (['Beginner', 'Intermediate', 'Advanced', 'Interview-level'].includes(interview.difficulty)) {
      convDifficulty = interview.difficulty;
    }

    const session = await AIConversation.create({
      clerkUserId,
      title: defaultTitle,
      contextType: 'results',
      sourceInterviewId: interview._id,
      topic: interview.targetRole || 'Interview Performance Review',
      difficulty: convDifficulty,
      lastMessagePreview: RESULTS_WELCOME_MESSAGE.slice(0, 100),
      status: 'active',
    });

    const initialMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'assistant',
      content: RESULTS_WELCOME_MESSAGE,
      metadata: {
        isWelcome: true,
        chatType: 'results',
        resultId: String(interview._id),
        targetRole: interview.targetRole,
        suggestions: [
          'Why did I get this score?',
          'Explain my weak areas',
          'How can I improve Question 1?',
          'Generate a study plan',
        ],
      },
    });

    return sendSuccess(
      res,
      {
        session: {
          id: session._id,
          title: session.title,
          contextType: session.contextType,
          sourceInterviewId: session.sourceInterviewId,
          updatedAt: session.updatedAt,
          createdAt: session.createdAt,
        },
        messages: [
          {
            id: initialMsg._id,
            role: initialMsg.role,
            content: initialMsg.content,
            metadata: initialMsg.metadata,
            createdAt: initialMsg.createdAt,
          },
        ],
      },
      201
    );
  } catch (err) {
    console.error('[ChatController] createResultSession error:', err);
    return sendError(res, 500, 'RESULT_CREATE_SESSION_ERROR', 'Could not create Results session.', err.message);
  }
};

/**
 * GET /api/chat/results/:resultId/sessions/:sessionId
 * Retrieves a specific Results session and its messages
 */
const getResultSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { resultId, sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId) || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid result ID or session ID provided.');
    }

    // Verify interview ownership
    const interview = await Interview.findOne({ _id: resultId, clerkUserId });
    if (!interview) {
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview result not found or unauthorized.');
    }

    const session = await AIConversation.findOne({
      _id: sessionId,
      clerkUserId,
      contextType: 'results',
      sourceInterviewId: resultId,
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Results chat session not found or unauthorized.');
    }

    const messages = await AIMessage.find({
      conversationId: session._id,
      clerkUserId,
    })
      .sort({ createdAt: 1 })
      .limit(100);

    return sendSuccess(res, {
      session: {
        id: session._id,
        title: session.title,
        contextType: session.contextType,
        sourceInterviewId: session.sourceInterviewId,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
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
    console.error('[ChatController] getResultSession error:', err);
    return sendError(res, 500, 'RESULT_GET_SESSION_ERROR', 'Could not retrieve Results session.', err.message);
  }
};

/**
 * DELETE /api/chat/results/:resultId/sessions/:sessionId
 * Archives a Results conversation
 */
const deleteResultSession = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { resultId, sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId) || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid result ID or session ID provided.');
    }

    const session = await AIConversation.findOneAndUpdate(
      {
        _id: sessionId,
        clerkUserId,
        contextType: 'results',
        sourceInterviewId: resultId,
      },
      { status: 'archived' }
    );

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Results chat session not found.');
    }

    return sendSuccess(res, { message: 'Results chat session archived successfully.' });
  } catch (err) {
    console.error('[ChatController] deleteResultSession error:', err);
    return sendError(res, 500, 'RESULT_DELETE_SESSION_ERROR', 'Could not archive Results session.', err.message);
  }
};

/**
 * POST /api/chat/results/:resultId/sessions/:sessionId/messages
 * Posts a message to a Results session, supplying grounded interview context to the AI
 */
const postResultMessage = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { resultId, sessionId } = req.params;
    const { content = '', attachments = [] } = req.body;

    if (!content.trim() && (!attachments || attachments.length === 0)) {
      return sendError(res, 400, 'EMPTY_MESSAGE', 'Message content or attachment is required.');
    }

    if (!mongoose.Types.ObjectId.isValid(resultId) || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid result ID or session ID provided.');
    }

    // Verify interview result ownership
    const interview = await Interview.findOne({ _id: resultId, clerkUserId }).lean();
    if (!interview) {
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview result not found or unauthorized.');
    }

    // Verify session ownership and contextType
    const session = await AIConversation.findOne({
      _id: sessionId,
      clerkUserId,
      contextType: 'results',
      sourceInterviewId: resultId,
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Results chat session not found or unauthorized.');
    }

    // Save user message
    const userMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'user',
      content: content.trim() || (attachments[0] ? `Attached file: ${attachments[0].name}` : ''),
      attachments,
    });

    // Auto-update conversation title from first user message if default
    if (
      session.title.startsWith('Review:') ||
      session.title === 'Interview Performance Review' ||
      session.title === 'New Chat'
    ) {
      session.title = aiCoachService.generateChatTitle(content, 'results');
    }

    // Retrieve conversation history
    const historyDocs = await AIMessage.find({
      conversationId: session._id,
      clerkUserId,
    })
      .sort({ createdAt: 1 })
      .limit(12);

    const history = historyDocs.map((m) => ({ role: m.role, content: m.content }));

    // Retrieve questions and responses for this interview
    const [questions, responses] = await Promise.all([
      Question.find({ interviewId: interview._id }).sort({ order: 1 }).lean(),
      Response.find({ interviewId: interview._id }).lean(),
    ]);

    const respMap = new Map(responses.map((r) => [String(r.questionId), r]));
    const questionBreakdown = questions.map((q, idx) => {
      const resp = respMap.get(String(q._id));
      return {
        number: idx + 1,
        text: q.text,
        category: q.category,
        difficulty: q.difficulty,
        userAnswer: resp?.answerText || resp?.code || null,
        score: resp?.textEvaluation?.textScore ?? resp?.multimodalEvaluation?.overallScore ?? null,
        strengths: resp?.textEvaluation?.strengths || [],
        missingConcepts: resp?.textEvaluation?.missingConcepts || [],
        feedback: resp?.textEvaluation?.feedback || null,
      };
    });

    const resultContext = {
      targetRole: interview.targetRole,
      difficulty: interview.difficulty,
      overallScore: interview.finalEvaluation?.overallScore ?? null,
      technicalScore: interview.finalEvaluation?.technicalScore ?? null,
      communicationScore:
        interview.finalEvaluation?.communicationScore ??
        interview.finalEvaluation?.audioScore ??
        null,
      problemSolvingScore: interview.finalEvaluation?.problemSolvingScore ?? null,
      strengths: interview.finalEvaluation?.strongAreas || [],
      weaknesses: interview.finalEvaluation?.weakAreas || [],
      recommendations: interview.finalEvaluation?.recommendations || [],
      questions: questionBreakdown,
    };

    // Generate grounded Results AI response
    const aiResult = await aiCoachService.generateResultsAssistantResponse({
      message: content,
      history,
      resultContext,
    });

    // Save assistant message
    const assistantMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'assistant',
      content: aiResult.content,
      metadata: {
        chatType: 'results',
        resultId: String(interview._id),
        suggestions: getResultFollowUps(content),
      },
    });

    // Update session metadata
    session.lastMessagePreview = aiResult.content.slice(0, 100);
    session.updatedAt = new Date();
    await session.save();

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
        metadata: assistantMsg.metadata,
        createdAt: assistantMsg.createdAt,
      },
      session: {
        id: session._id,
        title: session.title,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err) {
    console.error('[ChatController] postResultMessage error:', err);
    return sendError(res, 500, 'RESULT_POST_MESSAGE_ERROR', 'Could not process Results message.', err.message);
  }
};

/**
 * POST /api/chat/dashboard/sessions/:id/regenerate
 * Regenerates the last assistant response in a Dashboard session
 */
const postDashboardRegenerate = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'INVALID_SESSION_ID', 'Invalid session ID provided.');
    }

    const session = await AIConversation.findOne({
      _id: id,
      clerkUserId,
      contextType: 'dashboard',
      sourceInterviewId: null,
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Dashboard chat session not found.');
    }

    // Find all messages
    const messages = await AIMessage.find({ conversationId: session._id, clerkUserId }).sort({ createdAt: 1 });
    if (messages.length === 0) {
      return sendError(res, 400, 'NO_MESSAGES', 'No messages to regenerate.');
    }

    // Find last user message
    let lastUserMsg = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i];
        break;
      }
    }

    if (!lastUserMsg) {
      return sendError(res, 400, 'NO_USER_MESSAGE', 'No user query found to regenerate.');
    }

    // If last message is an assistant message, delete it
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant') {
      await AIMessage.deleteOne({ _id: lastMsg._id });
    }

    // Retrieve remaining history (up to last user message)
    const history = messages
      .filter((m) => m._id.toString() !== lastMsg._id.toString() && m._id.toString() !== lastUserMsg._id.toString())
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    const [latestResume, candidateProfile] = await Promise.all([
      Resume.findOne({ clerkUserId, processingStatus: 'completed' }).sort({ createdAt: -1 }),
      AITrainingProfile.findOne({ clerkUserId }),
    ]);

    const parsedData = latestResume?.parsedData || {};
    const skills = (parsedData.skills || []).map((s) => s.canonicalName || s.name || s);
    const projects = (parsedData.projects || []).map((p) => p.name || p.title || '').filter(Boolean);
    const targetRole = parsedData.basicInfo?.targetRole || candidateProfile?.targetRole || 'Software Engineer';
    const candidateName = parsedData.basicInfo?.name || candidateProfile?.candidateName || null;

    const aiResult = await aiCoachService.generateDashboardAssistantResponse({
      message: lastUserMsg.content,
      history,
      context: { candidateName, targetRole, skills, projects },
    });

    const newAssistantMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'assistant',
      content: aiResult.content,
      metadata: {
        chatType: 'dashboard',
        isRegenerated: true,
        suggestions: getDashboardFollowUps(lastUserMsg.content),
      },
    });

    session.lastMessagePreview = aiResult.content.slice(0, 100);
    session.updatedAt = new Date();
    await session.save();

    return sendSuccess(res, {
      assistantMessage: {
        id: newAssistantMsg._id,
        role: newAssistantMsg.role,
        content: newAssistantMsg.content,
        metadata: newAssistantMsg.metadata,
        createdAt: newAssistantMsg.createdAt,
      },
      session: {
        id: session._id,
        title: session.title,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err) {
    console.error('[ChatController] postDashboardRegenerate error:', err);
    return sendError(res, 500, 'DASHBOARD_REGENERATE_ERROR', 'Could not regenerate response.', err.message);
  }
};

/**
 * POST /api/chat/results/:resultId/sessions/:sessionId/regenerate
 * Regenerates the last assistant response in a Results session
 */
const postResultRegenerate = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    const { resultId, sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(resultId) || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid result ID or session ID.');
    }

    const interview = await Interview.findOne({ _id: resultId, clerkUserId }).lean();
    if (!interview) {
      return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Interview result not found.');
    }

    const session = await AIConversation.findOne({
      _id: sessionId,
      clerkUserId,
      contextType: 'results',
      sourceInterviewId: resultId,
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', 'Results chat session not found.');
    }

    const messages = await AIMessage.find({ conversationId: session._id, clerkUserId }).sort({ createdAt: 1 });
    if (messages.length === 0) {
      return sendError(res, 400, 'NO_MESSAGES', 'No messages to regenerate.');
    }

    let lastUserMsg = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i];
        break;
      }
    }

    if (!lastUserMsg) {
      return sendError(res, 400, 'NO_USER_MESSAGE', 'No user query found to regenerate.');
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant') {
      await AIMessage.deleteOne({ _id: lastMsg._id });
    }

    const history = messages
      .filter((m) => m._id.toString() !== lastMsg._id.toString() && m._id.toString() !== lastUserMsg._id.toString())
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    const [questions, responses] = await Promise.all([
      Question.find({ interviewId: interview._id }).sort({ order: 1 }).lean(),
      Response.find({ interviewId: interview._id }).lean(),
    ]);

    const respMap = new Map(responses.map((r) => [String(r.questionId), r]));
    const questionBreakdown = questions.map((q, idx) => {
      const resp = respMap.get(String(q._id));
      return {
        number: idx + 1,
        text: q.text,
        category: q.category,
        difficulty: q.difficulty,
        userAnswer: resp?.answerText || resp?.code || null,
        score: resp?.textEvaluation?.textScore ?? resp?.multimodalEvaluation?.overallScore ?? null,
        strengths: resp?.textEvaluation?.strengths || [],
        missingConcepts: resp?.textEvaluation?.missingConcepts || [],
        feedback: resp?.textEvaluation?.feedback || null,
      };
    });

    const resultContext = {
      targetRole: interview.targetRole,
      difficulty: interview.difficulty,
      overallScore: interview.finalEvaluation?.overallScore ?? null,
      technicalScore: interview.finalEvaluation?.technicalScore ?? null,
      communicationScore:
        interview.finalEvaluation?.communicationScore ??
        interview.finalEvaluation?.audioScore ??
        null,
      problemSolvingScore: interview.finalEvaluation?.problemSolvingScore ?? null,
      strengths: interview.finalEvaluation?.strongAreas || [],
      weaknesses: interview.finalEvaluation?.weakAreas || [],
      recommendations: interview.finalEvaluation?.recommendations || [],
      questions: questionBreakdown,
    };

    const aiResult = await aiCoachService.generateResultsAssistantResponse({
      message: lastUserMsg.content,
      history,
      resultContext,
    });

    const newAssistantMsg = await AIMessage.create({
      conversationId: session._id,
      clerkUserId,
      role: 'assistant',
      content: aiResult.content,
      metadata: {
        chatType: 'results',
        resultId: String(interview._id),
        isRegenerated: true,
        suggestions: getResultFollowUps(lastUserMsg.content),
      },
    });

    session.lastMessagePreview = aiResult.content.slice(0, 100);
    session.updatedAt = new Date();
    await session.save();

    return sendSuccess(res, {
      assistantMessage: {
        id: newAssistantMsg._id,
        role: newAssistantMsg.role,
        content: newAssistantMsg.content,
        metadata: newAssistantMsg.metadata,
        createdAt: newAssistantMsg.createdAt,
      },
      session: {
        id: session._id,
        title: session.title,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err) {
    console.error('[ChatController] postResultRegenerate error:', err);
    return sendError(res, 500, 'RESULT_REGENERATE_ERROR', 'Could not regenerate Results response.', err.message);
  }
};

/**
 * Helper to get contextual follow-up suggestions for Dashboard AI
 */
function getDashboardFollowUps(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('django')) {
    return ['Explain Django ORM', 'Explain Django URLs', 'Django MVT vs MVC'];
  }
  if (lower.includes('mongo')) {
    return ['Explain compound indexes', 'Show a real-world example', 'How do I optimize MongoDB queries?'];
  }
  if (lower.includes('rest') || lower.includes('api')) {
    return ['HTTP methods & idempotence', 'REST vs GraphQL', 'API status codes'];
  }
  if (lower.includes('backend')) {
    return ['System design basics', 'Database indexing guide', 'Mock interview tips'];
  }
  if (lower.includes('python')) {
    return ['Python decorators', 'Python generators', 'List vs Tuple'];
  }
  if (lower.includes('react')) {
    return ['React Hooks overview', 'useMemo vs useCallback', 'State management patterns'];
  }
  return ['Give me a code example', 'Explain the trade-offs', 'How is this tested in interviews?'];
}

/**
 * Helper to get contextual follow-up suggestions for Results AI
 */
function getResultFollowUps(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('score') || lower.includes('why')) {
    return ['Explain my weak areas', 'How can I improve Question 1?', 'Generate a 5-day study plan'];
  }
  if (lower.includes('weak')) {
    return ['How to practice these gaps', 'Give an architectural example', 'Generate a study plan'];
  }
  if (lower.includes('question') || lower.includes('q1') || lower.includes('q2')) {
    return ['Give a model answer', 'What concepts were missing?', 'How to structure trade-offs'];
  }
  if (lower.includes('study') || lower.includes('plan')) {
    return ['Customize for 7 days', 'Prioritize technical topics', 'How to test my progress'];
  }
  return ['Analyze my weakest question', 'How can I improve?', 'Generate a study plan'];
}

module.exports = {
  getDashboardSessions,
  createDashboardSession,
  getDashboardSession,
  deleteDashboardSession,
  postDashboardMessage,
  postDashboardRegenerate,
  getResultSessions,
  createResultSession,
  getResultSession,
  deleteResultSession,
  postResultMessage,
  postResultRegenerate,
};

