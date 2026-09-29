/**
 * AI Coach Controller
 * 
 * Manages persistent conversational state, contextual actions, and intent handling:
 *   - "run mock on Python" -> starts/sets up mock interview context with Python
 *   - "give me a hint" -> provides a hint for the current active question
 *   - "make it harder" -> adjusts interview difficulty to 'hard'
 *   - "explain result" -> breaks down strengths and weaknesses of an interview
 *   - "I want to learn..." -> tracks learning track and active topics
 */

const AIConversation = require('../models/AIConversation');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Resume = require('../models/Resume');
const TrainingSession = require('../models/TrainingSession');
const llmService = require('../services/llmService');
const { sendError, sendSuccess } = require('../utils/errorHandler');

/**
 * Handle incoming chat message to AI Coach with strict context hierarchy.
 */
const sendMessage = async (req, res) => {
  try {
    const { message, activeInterviewId, activeQuestionId } = req.body;
    const clerkUserId = req.clerkUserId;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return sendError(res, 400, 'INVALID_MESSAGE', 'Message cannot be empty.');
    }

    const cleanMsg = message.trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. Load or initialize persistent conversation state
    let conversation = await AIConversation.findOne({ clerkUserId });
    if (!conversation) {
      conversation = await AIConversation.create({
        clerkUserId,
        messages: [],
      });
    }

    // 2. Resolve Active Interview & Question Context
    let currentInterview = null;
    const targetInterviewId = activeInterviewId || conversation.activeInterviewId;
    if (targetInterviewId) {
      currentInterview = await Interview.findOne({ _id: targetInterviewId, clerkUserId });
      if (currentInterview) {
        conversation.activeInterviewId = currentInterview._id;
      }
    }

    let currentQuestion = null;
    if (currentInterview) {
      if (activeQuestionId) {
        currentQuestion = await Question.findOne({ _id: activeQuestionId, interviewId: currentInterview._id });
      } else if (currentInterview.currentQuestion?.text) {
        currentQuestion = currentInterview.currentQuestion;
      } else {
        currentQuestion = await Question.findOne({
          interviewId: currentInterview._id,
          order: currentInterview.currentQuestionIndex,
        });
      }
    }

    if (currentQuestion) {
      conversation.currentQuestion = {
        id: String(currentQuestion._id || currentQuestion.id),
        text: currentQuestion.text,
        topic: currentQuestion.targetSkill || currentQuestion.skill || currentQuestion.topic,
        difficulty: currentQuestion.difficulty,
        type: currentQuestion.type,
      };
    }

    // 3. Contextual Intent Detection & Execution
    let assistantReply = '';
    let executedAction = null;
    let actionPayload = {};

    // ── Intent A: "give me a hint" / Hint request ────────────────────────────
    if (lowerMsg.includes('hint') || lowerMsg.includes('clue') || lowerMsg.includes('help me start')) {
      executedAction = 'give_hint';
      if (conversation.currentQuestion?.text) {
        const qText = conversation.currentQuestion.text;
        const topic = conversation.currentQuestion.topic || 'the core concept';
        assistantReply = `💡 **Hint for the current question**:\n\n> *"${qText}"*\n\nFocus on the architectural trade-offs of **${topic}**. Think about how data flows, where state is preserved, and consider any performance bottlenecks (such as I/O vs CPU limits, concurrency, or memory footprint). Outline your approach in 2–3 structured steps before diving into syntax or details.`;
      } else if (conversation.activeTopic && /python/i.test(conversation.activeTopic)) {
        assistantReply = `💡 **Hint for your ${conversation.activeTopic} track**:\n\nFocus on idiomatic Python constructs, memory efficiency (generators vs lists), async event loops (FastAPI / asyncio), and clean separation of concerns between your data models and API routes.`;
      } else {
        assistantReply = `💡 I'd be glad to give you a hint! Once you have an active interview question open, I'll provide contextual guidance tailored specifically to that problem.`;
      }
    }

    // ── Intent B: "make it harder" / Difficulty adjustment ───────────────────
    else if (lowerMsg.includes('harder') || lowerMsg.includes('increase difficulty') || lowerMsg.includes('challenge me')) {
      executedAction = 'adjust_difficulty';
      actionPayload = { newDifficulty: 'hard' };
      conversation.currentDifficulty = 'hard';

      if (currentInterview && currentInterview.status === 'in_progress') {
        currentInterview.difficulty = 'hard';
        if (currentInterview.interviewState) {
          currentInterview.interviewState.currentDifficulty = 'hard';
        }
        await currentInterview.save();
        assistantReply = `⚡ Interview difficulty elevated to **Hard** for your active **${currentInterview.targetRole}** session! The upcoming questions will demand deeper architectural reasoning, edge case analysis, and distributed system trade-offs.`;
      } else {
        const targetTrack = conversation.activeTopic || conversation.learningTrack || 'Full Stack';
        assistantReply = `⚡ Difficulty set to **Hard** for your upcoming **${targetTrack}** sessions! Upcoming questions will focus on deep internals, concurrency, memory models, and scalability trade-offs.`;
      }
    }

    // ── Intent C: "make it easier" ──────────────────────────────────────────
    else if (lowerMsg.includes('easier') || lowerMsg.includes('lower difficulty') || lowerMsg.includes('fundamentals')) {
      executedAction = 'adjust_difficulty';
      actionPayload = { newDifficulty: 'easy' };
      conversation.currentDifficulty = 'easy';

      if (currentInterview && currentInterview.status === 'in_progress') {
        currentInterview.difficulty = 'easy';
        if (currentInterview.interviewState) {
          currentInterview.interviewState.currentDifficulty = 'easy';
        }
        await currentInterview.save();
        assistantReply = `🌱 Difficulty adjusted to **Easy / Fundamentals** for your session. Questions will focus on core concepts and practical essentials.`;
      } else {
        assistantReply = `🌱 Difficulty set to **Fundamentals** for your practice sessions.`;
      }
    }

    // ── Intent D: "run mock on [Topic/Role]" ──────────────────────────────────
    else if (lowerMsg.includes('run mock') || lowerMsg.includes('mock interview') || lowerMsg.includes('start interview')) {
      executedAction = 'start_mock';

      let extractedTopic = 'Software Engineer';
      if (/python/i.test(lowerMsg)) extractedTopic = 'Python Full Stack Developer';
      else if (/react|frontend/i.test(lowerMsg)) extractedTopic = 'React Frontend Developer';
      else if (/docker|devops/i.test(lowerMsg)) extractedTopic = 'DevOps Engineer';
      else if (/java/i.test(lowerMsg)) extractedTopic = 'Java Backend Engineer';
      else if (conversation.activeTopic) extractedTopic = conversation.activeTopic;

      conversation.activeTopic = extractedTopic;
      conversation.currentMode = 'mock_interview';
      actionPayload = { targetRole: extractedTopic };

      assistantReply = `🚀 Ready to run a personalized mock interview for **${extractedTopic}**!\n\nI have aligned your session configuration with this track. Navigate to **Start Interview** to begin, or use the setup page to review your target skills and upload a matching resume.`;
    }

    // ── Intent E: "I want to learn..." / Track establishment ────────────────
    else if (lowerMsg.includes('i want to learn') || lowerMsg.includes('learning path') || lowerMsg.includes('study plan')) {
      executedAction = 'set_learning_track';

      let topic = 'Full Stack Development';
      if (/python/i.test(lowerMsg)) topic = 'Python Full Stack Development';
      else if (/react/i.test(lowerMsg)) topic = 'React & Modern Frontend';
      else if (/system design/i.test(lowerMsg)) topic = 'Distributed System Design';

      conversation.learningTrack = topic;
      conversation.activeTopic = topic;
      conversation.currentMode = 'learning';
      actionPayload = { learningTrack: topic };

      assistantReply = `🎯 Great choice! I've set your primary learning track to **${topic}**.\n\nHere is your structured progression plan:\n1. **Core Fundamentals & Idiomatic Syntax**: Memory model, language constructs, and runtime execution.\n2. **Architecture & Frameworks**: Component lifecycle, REST/GraphQL design, and state persistence.\n3. **Production Engineering**: Testing, Docker containerization, CI/CD, and scalability.\n\nWhenever you're ready, say *"run mock on ${topic.split(' ')[0]}"* to test your knowledge!`;
    }

    // ── Intent F: "give answer" / Model Solution ────────────────────────────
    else if (lowerMsg.includes('give answer') || lowerMsg.includes('show solution') || lowerMsg.includes('what is the answer')) {
      if (conversation.currentQuestion?.text) {
        const topic = conversation.currentQuestion.topic || 'the topic';
        assistantReply = `📘 **Model Solution Guidance** for:\n> *"${conversation.currentQuestion.text}"*\n\n**Key Architectural Points:**\n- Clarify the core mechanism of ${topic}.\n- Address trade-offs between performance and simplicity.\n- Mention real-world resilience (error handling, logging, caching).\n\n*Pro-tip: In technical interviews, explaining your thought process is worth more than a memorized one-liner.*`;
      } else {
        assistantReply = `To review a specific answer or model solution, please open an active interview question or results report.`;
      }
    }

    // ── Intent G: Natural Conversational AI Response (Context-Grounded) ─────
    else {
      try {
        const systemPrompt = `You are InterviewX Coach, an expert technical interview mentor.
Candidate current track: ${conversation.activeTopic || conversation.learningTrack || 'Full Stack Engineering'}.
Active difficulty: ${conversation.currentDifficulty || 'medium'}.
Provide clear, accurate, professional explanations. Do not generate SVG artifacts or raw escaped markdown syntax. Ground responses strictly in the relevant technology.`;

        assistantReply = await llmService.generateCompletion({
          messages: [{ role: 'user', content: cleanMsg }],
          systemPrompt,
          temperature: 0.7,
          allowLocalFallback: req.headers['x-test-error-mode'] !== 'true',
        });
      } catch (llmErr) {
        if (req.headers['x-test-error-mode'] === 'true' || (!llmService.isConfigured() && !llmService.generateLocalExplanation(cleanMsg))) {
          return sendError(res, 503, 'LLM_CONFIG_ERROR', llmErr.message);
        }
        let contextNote = '';
        if (currentInterview) {
          contextNote += ` You are currently reviewing your **${currentInterview.targetRole}** interview.`;
        } else if (conversation.activeTopic) {
          contextNote += ` Your active focus is **${conversation.activeTopic}**.`;
        }
        assistantReply = `I'm InterviewX Coach — your personal technical mentor.${contextNote}\n\nI can help you with:\n- **Interactive Hints**: Ask *"give me a hint"* during any interview.\n- **Adaptive Difficulty**: Say *"make it harder"* or *"give me fundamentals"*.\n- **Targeted Mock Sessions**: Say *"run mock on Python"* or any tech stack.\n- **Deep Explanations**: Ask any architecture, system design, or coding question.\n\nWhat would you like to focus on right now?`;
      }
    }

    // 4. Persist User & Assistant Messages
    conversation.messages.push({
      role: 'user',
      content: cleanMsg,
      timestamp: new Date(),
    });

    conversation.messages.push({
      role: 'assistant',
      content: assistantReply,
      action: executedAction,
      metadata: actionPayload,
      timestamp: new Date(),
    });

    // Keep conversation history compact (last 50 messages)
    if (conversation.messages.length > 50) {
      conversation.messages = conversation.messages.slice(-50);
    }

    await conversation.save();

    return sendSuccess(res, {
      message: assistantReply,
      action: executedAction,
      metadata: actionPayload,
      conversation: {
        activeTopic: conversation.activeTopic,
        currentDifficulty: conversation.currentDifficulty,
        currentMode: conversation.currentMode,
        learningTrack: conversation.learningTrack,
      },
    });
  } catch (error) {
    console.error('[AI Coach] Error handling message:', error);
    return sendError(res, 500, 'COACH_ERROR', 'AI Coach was unable to process message.', error.message);
  }
};

/**
 * Get active conversation state and recent message history.
 */
const getConversationState = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    let conversation = await AIConversation.findOne({ clerkUserId });

    if (!conversation) {
      conversation = await AIConversation.create({
        clerkUserId,
        messages: [
          {
            role: 'assistant',
            content: 'Hello! I am your InterviewX AI Coach. I can help you practice mock interviews, break down complex technical topics, analyze skill gaps, and give you real-time hints during interviews. What role or tech stack are you preparing for?',
            timestamp: new Date(),
          },
        ],
      });
    }

    return sendSuccess(res, {
      conversation: {
        id: conversation._id,
        goal: conversation.goal,
        learningTrack: conversation.learningTrack,
        currentMode: conversation.currentMode,
        activeTopic: conversation.activeTopic,
        currentDifficulty: conversation.currentDifficulty,
        activeInterviewId: conversation.activeInterviewId,
        currentQuestion: conversation.currentQuestion,
        messages: conversation.messages,
      },
    });
  } catch (error) {
    return sendError(res, 500, 'COACH_FETCH_FAILED', 'Could not retrieve AI Coach conversation.', error.message);
  }
};

/**
 * Reset conversation messages and clear session markers.
 */
const resetConversation = async (req, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    let conversation = await AIConversation.findOne({ clerkUserId });
    if (conversation) {
      conversation.messages = [
        {
          role: 'assistant',
          content: 'Conversation history reset. What would you like to prepare for next?',
          timestamp: new Date(),
        },
      ];
      conversation.activeInterviewId = null;
      conversation.currentQuestion = null;
      await conversation.save();
    }
    return sendSuccess(res, { message: 'AI Coach conversation reset successfully.' });
  } catch (error) {
    return sendError(res, 500, 'RESET_FAILED', 'Could not reset conversation.', error.message);
  }
};

module.exports = {
  sendMessage,
  getConversationState,
  resetConversation,
};
