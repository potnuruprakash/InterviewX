const mongoose = require('mongoose');

const practiceQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answerGuidance: { type: String, default: null },
    keyPoints: [{ type: String }],
  },
  { _id: false }
);

const codingExerciseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    starterCode: { type: String, default: null },
    language: { type: String, default: 'javascript' },
    solution: { type: String, default: null },
  },
  { _id: false }
);

const topicModuleSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    category: { type: String, default: 'technical' },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'high' },
    explanation: { type: String, required: true },
    examples: [{ type: String }],
    practiceQuestions: [practiceQuestionSchema],
    codingExercises: [codingExerciseSchema],
    completed: { type: Boolean, default: false },
    userNotes: { type: String, default: '' },
  },
  { _id: false }
);

const trainingSessionSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    targetRole: {
      type: String,
      required: true,
    },
    interviewScore: {
      type: Number,
      default: null,
    },
    weaknesses: [{ type: String }],
    skillGaps: [{ type: String }],
    topics: [topicModuleSchema],
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
    completedTopicsCount: {
      type: Number,
      default: 0,
    },
    totalTopicsCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);
