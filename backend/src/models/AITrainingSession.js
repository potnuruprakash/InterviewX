const mongoose = require('mongoose');

const aiTrainingSessionSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
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
      required: true,
      default: 'General Technical Preparation',
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Interview-level'],
      default: 'Intermediate',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused'],
      default: 'active',
    },
    contextType: {
      type: String,
      enum: ['dashboard', 'results'],
      default: 'dashboard',
    },
    currentQuestionId: {
      type: String,
      default: null,
    },
    currentQuestionText: {
      type: String,
      default: null,
    },
    questionHistory: {
      type: [String],
      default: [],
    },
    sessionMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AITrainingSession', aiTrainingSessionSchema);
