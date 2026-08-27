const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
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
    },
    targetRole: {
      type: String,
      default: '',
    },
    overallScore: {
      type: Number,
      default: null,
    },
    // Phase 9 — Detailed scores
    technicalScore: {
      type: Number,
      default: null,
    },
    communicationIndicators: {
      speakingDuration: { type: Number, default: null },
      speechRate: { type: Number, default: null },
      audioAvailable: { type: Boolean, default: false },
    },
    videoIndicators: {
      personDetectionRatio: { type: Number, default: null },
      videoAvailable: { type: Boolean, default: false },
    },
    // Phase 11 — Skill-level scores for trend analysis
    skillScores: {
      type: Map,
      of: Number,
      default: {},
    },
    skillCoverage: {
      type: Number,
      default: null,
    },
    // Phase 10 — Improvement areas
    improvementAreas: {
      type: [String],
      default: [],
    },
    strongAreas: {
      type: [String],
      default: [],
    },
    skillGaps: {
      type: [String],
      default: [],
    },
    questionsAnswered: {
      type: Number,
      default: 0,
    },
    interviewType: {
      type: String,
      default: 'mixed',
    },
    difficulty: {
      type: String,
      default: 'medium',
    },
    modalitiesUsed: {
      type: [String],
      default: ['text'],
    },
    isDevelopmentEvaluation: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Progress', progressSchema);
