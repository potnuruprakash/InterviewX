const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
    },
    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
      required: true,
    },
    skillAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillAnalysis',
      default: null,
    },
    targetRole: {
      type: String,
      required: true,
    },
    interviewType: {
      type: String,
      enum: ['technical', 'behavioral', 'hr', 'mixed'],
      default: 'mixed',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['created', 'in_progress', 'completed', 'abandoned'],
      default: 'created',
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 10,
    },
    durationMinutes: {
      type: Number,
      default: 30,
    },
    completionReason: {
      type: String,
      enum: ['completed', 'time_expired', 'user_ended', 'final_question_skipped'],
      default: null,
    },
    skippedQuestionsCount: {
      type: Number,
      default: 0,
    },

    // Phase 3 — Personalized question generation
    questionGenerationSource: {
      type: String,
      enum: ['personalized', 'static_bank', 'hybrid'],
      default: 'static_bank',
    },

    // Phase 8 — Adaptive interview state
    interviewState: {
      skillPerformance: {
        type: Map,
        of: new mongoose.Schema({
          score: { type: Number, default: 0 },
          confidence: { type: Number, default: 0 },
          questionsAsked: { type: Number, default: 0 },
        }, { _id: false }),
        default: {},
      },
      weakAreas: { type: [String], default: [] },
      strongAreas: { type: [String], default: [] },
      answeredQuestions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      currentDifficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium',
      },
      remainingSkills: { type: [String], default: [] },
    },

    // Phase 5 — Modality availability
    modalityAvailability: {
      text: { type: Boolean, default: true },
      audio: { type: Boolean, default: false },
      video: { type: Boolean, default: false },
    },

    // Phase 9 — Final evaluation
    finalEvaluation: {
      overallScore: { type: Number, default: null },
      technicalScore: { type: Number, default: null },
      audioScore: { type: Number, default: null },
      videoScore: { type: Number, default: null },
      modalitiesUsed: { type: [String], default: [] },
      jobReadinessScore: { type: Number, default: null },
      jobReadinessLabel: { type: String, default: null },
      skillScores: { type: Map, of: Number, default: {} },
      strongAreas: { type: [String], default: [] },
      weakAreas: { type: [String], default: [] },
      skillGaps: { type: [String], default: [] },
      summary: { type: String, default: null },
      completedAt: { type: Date, default: null },
      isDevelopmentEvaluation: { type: Boolean, default: false },
    },

    // Skill gap data — populated from SkillAnalysis in Phase 3+
    skillAnalysis: {
      matchedSkills: [String],
      missingSkills: [String],
      weakSkills: [String],
      skillGapPercentage: Number,
    },

    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Interview', interviewSchema);
