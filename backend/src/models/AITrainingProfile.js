const mongoose = require('mongoose');

const aiTrainingProfileSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    focusTopics: {
      type: [String],
      default: [],
    },
    skillLevels: {
      type: Map,
      of: Number,
      default: {},
    },
    currentDifficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Interview-level'],
      default: 'Intermediate',
    },
    targetRole: {
      type: String,
      default: null,
    },
    skills: {
      type: [String],
      default: [],
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
    },
    summary: {
      type: String,
      default: null,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      default: null,
    },
    lastAnalyzedResumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AITrainingProfile', aiTrainingProfileSchema);
