const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      default: null, // e.g. 'start_mock', 'give_hint', 'adjust_difficulty', 'explain_result', 'train_topic'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const aiConversationSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    // Dedicated chat-session metadata used by the Dashboard and Results chat APIs.
    title: {
      type: String,
      default: 'New Chat',
    },
    contextType: {
      type: String,
      enum: ['dashboard', 'results'],
      default: 'dashboard',
      index: true,
    },
    sourceInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
      index: true,
    },
    topic: {
      type: String,
      default: 'General Interview Preparation',
    },
    difficulty: {
      type: String,
      default: 'Intermediate',
    },
    lastMessagePreview: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    goal: {
      type: String,
      default: 'General interview preparation and technical skill improvement',
    },
    learningTrack: {
      type: String,
      default: null,
    },
    currentMode: {
      type: String,
      enum: [
        'general',
        'learning',
        'mock_interview',
        'practice',
        'resume_analysis',
        'results_training',
      ],
      default: 'general',
    },
    activeTopic: {
      type: String,
      default: null,
    },
    currentDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    activeInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
    },
    activeTrainingSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
      default: null,
    },
    currentQuestion: {
      id: { type: String, default: null },
      text: { type: String, default: null },
      topic: { type: String, default: null },
      difficulty: { type: String, default: null },
      type: { type: String, default: null },
    },
    messages: [chatMessageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('AIConversation', aiConversationSchema);
