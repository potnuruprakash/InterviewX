const mongoose = require('mongoose');

const aiTrainingProgressSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
    },
    skillLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Interview-level'],
      default: 'Intermediate',
    },
    initialScore: {
      type: Number,
      default: null,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50,
    },
    attempts: {
      type: Number,
      default: 1,
    },
    lastPracticedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

aiTrainingProgressSchema.index({ clerkUserId: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('AITrainingProgress', aiTrainingProgressSchema);
