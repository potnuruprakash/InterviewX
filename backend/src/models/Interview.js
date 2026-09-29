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
      enum: ['technical', 'coding', 'behavioral', 'hr', 'system_design', 'system design', 'mixed'],
      default: 'mixed',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['setup', 'created', 'in_progress', 'completed', 'cancelled', 'abandoned'],
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
      enum: [
        'completed',
        'time_expired',
        'user_ended',
        'final_question_skipped',
        'all_questions_skipped',
        'all_questions_completed',
      ],
      default: null,
    },
    skippedQuestionsCount: {
      type: Number,
      default: 0,
    },
    answeredQuestionsCount: {
      type: Number,
      default: 0,
    },

    // Active question snapshot for immediate UI retrieval & state restoration
    currentQuestion: {
      id: { type: String, default: null },
      text: { type: String, default: null },
      topic: { type: String, default: null },
      category: { type: String, default: null },
      difficulty: { type: String, default: 'medium' },
      type: { type: String, default: 'technical' },
      expectedConcepts: [{ type: String }],
      order: { type: Number, default: 0 },
      starterCode: { type: String, default: null },
      language: { type: String, default: 'javascript' },
    },

    // Rolling performance history for smooth adaptive difficulty adjustment
    recentPerformance: {
      type: [Number],
      default: [],
    },

    // Topic coverage tracking
    topicCoverage: {
      type: Map,
      of: Number,
      default: {},
    },

    // Associated training session from Train Me
    trainingSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
      default: null,
    },

    // Phase 3 — Personalized question generation
    questionGenerationSource: {
      type: String,
      enum: ['personalized', 'static_bank', 'hybrid', 'adaptive_dynamic'],
      default: 'personalized',
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
      status: {
        type: String,
        enum: ['pending', 'ready', 'unavailable'],
        default: 'pending',
      },
      audioStatus: {
        type: String,
        enum: ['available', 'processing', 'unavailable'],
        default: 'unavailable',
      },
      videoStatus: {
        type: String,
        enum: ['available', 'processing', 'unavailable'],
        default: 'unavailable',
      },
      textStatus: {
        type: String,
        enum: ['available', 'processing', 'unavailable'],
        default: 'available',
      },
      overallScore: { type: Number, default: null },
      technicalScore: { type: Number, default: null },
      problemSolvingScore: { type: Number, default: null },
      communicationScore: { type: Number, default: null },
      jobRelevanceScore: { type: Number, default: null },
      audioScore: { type: Number, default: null },
      videoScore: { type: Number, default: null },
      modalitiesUsed: { type: [String], default: [] },
      jobReadinessScore: { type: Number, default: null },
      jobReadinessLabel: { type: String, default: null },
      skillScores: { type: Map, of: Number, default: {} },
      strongAreas: { type: [String], default: [] },
      weakAreas: { type: [String], default: [] },
      skillGaps: { type: [String], default: [] },
      improvementAreas: { type: [String], default: [] },
      recommendedTrainingTopics: { type: [String], default: [] },
      summary: { type: String, default: null },
      completedAt: { type: Date, default: null },
      isDevelopmentEvaluation: { type: Boolean, default: false },
    },

    // Skill gap data — populated from SkillAnalysis in Phase 3+
    skillAnalysis: {
      matchedSkills: [String],
      missingSkills: [String],
      weakSkills: [String],
      strongSkills: [String],
      partialSkills: [String],
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interviewSchema.index({ clerkUserId: 1, createdAt: -1 });
interviewSchema.index({ clerkUserId: 1, status: 1 });
interviewSchema.index({ _id: 1, clerkUserId: 1 });

module.exports = mongoose.model('Interview', interviewSchema);

