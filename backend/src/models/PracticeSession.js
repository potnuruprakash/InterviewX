const mongoose = require('mongoose');

const practiceQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true }, // 0-based index
    explanation: { type: String, required: true },
    topic: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'advanced'], default: 'medium' },
  },
  { _id: false }
);

const selectedAnswerSchema = new mongoose.Schema(
  {
    questionIndex: { type: Number, required: true },
    selectedOption: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const practiceSessionSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
      index: true,
    },
    mode: {
      type: String,
      enum: ['topic_practice', 'targeted_mock'],
      required: true,
      default: 'topic_practice',
    },
    targetSkill: {
      type: String,
      required: true,
    },
    targetSkills: [{ type: String }],
    questions: [practiceQuestionSchema],
    selectedAnswers: [selectedAnswerSchema],
    score: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 20,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    weakTopics: [{ type: String }],
    strongTopics: [{ type: String }],
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user query performance and strict tenant isolation
practiceSessionSchema.index({ clerkUserId: 1, createdAt: -1 });
practiceSessionSchema.index({ clerkUserId: 1, interviewId: 1 });

module.exports = mongoose.model('PracticeSession', practiceSessionSchema);
