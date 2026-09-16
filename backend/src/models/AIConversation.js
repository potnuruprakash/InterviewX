const mongoose = require('mongoose');

const aiConversationStateSchema = new mongoose.Schema(
  {
    goal: { type: String, default: null },
    learningTrack: { type: String, default: null },
    currentMode: {
      type: String,
      enum: ['general_chat', 'interview_prep', 'training_drill', 'plan_review', 'rapid_fire', 'results_coaching'],
      default: 'general_chat',
    },
    currentDay: { type: Number, default: null },
    currentTopic: { type: String, default: null },
    currentQuestion: {
      id: { type: String, default: null },
      text: { type: String, default: null },
      topic: { type: String, default: null },
      difficulty: { type: String, default: 'Intermediate' },
      hint: { type: String, default: null },
      solution: { type: String, default: null },
      prerequisites: { type: String, default: null },
      questionNumber: { type: Number, default: 1 },
    },
    currentExercise: {
      id: { type: String, default: null },
      type: { type: String, default: null },
      status: { type: String, default: null },
    },
    activeInterviewId: { type: String, default: null },
    resumeProfileId: { type: String, default: null },
    plan: {
      goal: { type: String, default: null },
      days: { type: mongoose.Schema.Types.Mixed, default: null },
      createdAt: { type: Date, default: null },
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
    title: {
      type: String,
      required: true,
      default: 'New Chat',
    },
    contextType: {
      type: String,
      enum: ['dashboard', 'results', 'general'],
      default: 'dashboard',
    },
    sourceInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
      index: true,
    },
    topic: {
      type: String,
      default: 'General Technical Preparation',
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Interview-level'],
      default: 'Intermediate',
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    lastMessagePreview: {
      type: String,
      default: '',
    },
    state: {
      type: aiConversationStateSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

aiConversationSchema.index({ clerkUserId: 1, updatedAt: -1 });

module.exports = mongoose.model('AIConversation', aiConversationSchema);
