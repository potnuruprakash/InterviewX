const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
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
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    answerText: {
      type: String,
      default: null,
    },
    // Phase 5 — Audio
    audioFilePath: {
      type: String,
      default: null,
    },
    audioFileSize: {
      type: Number,
      default: null,
    },
    // Phase 6 — Video
    videoFilePath: {
      type: String,
      default: null,
    },
    videoFileSize: {
      type: Number,
      default: null,
    },
    // Phase 4 — SBERT text evaluation
    textEvaluation: {
      semanticScore: { type: Number, default: null },
      conceptCoverage: { type: Number, default: null },
      textScore: { type: Number, default: null },
      feedback: { type: String, default: null },
      strengths: { type: [String], default: [] },
      missingConcepts: { type: [String], default: [] },
      improvementSuggestion: { type: String, default: null },
      confidence: { type: Number, default: null },
      modelStatus: { type: String, default: null },
    },
    // Phase 5 — Audio evaluation
    audioEvaluation: {
      speakingDuration: { type: Number, default: null },
      pauseDuration: { type: Number, default: null },
      speechRate: { type: Number, default: null },
      mfccSummary: { type: mongoose.Schema.Types.Mixed, default: null },
      energyCharacteristics: { type: mongoose.Schema.Types.Mixed, default: null },
      pitchStatistics: { type: mongoose.Schema.Types.Mixed, default: null },
      audioFeaturesAvailable: { type: Boolean, default: false },
      modelStatus: { type: String, default: 'not_processed' },
    },
    // Phase 6 — Video evaluation
    videoEvaluation: {
      framesProcessed: { type: Number, default: null },
      personDetectionRatio: { type: Number, default: null },
      faceVisibilityRatio: { type: Number, default: null },
      videoQualityIndicator: { type: String, default: null },
      modelStatus: { type: String, default: 'not_processed' },
      processingConfidence: { type: Number, default: null },
    },
    // Phase 7 — Multimodal evaluation
    multimodalEvaluation: {
      overallScore: { type: Number, default: null },
      textWeight: { type: Number, default: 0.5 },
      audioWeight: { type: Number, default: 0.25 },
      videoWeight: { type: Number, default: 0.25 },
      modalitiesUsed: { type: [String], default: [] },
      weightedScore: { type: Number, default: null },
      scoringNote: { type: String, default: null },
    },
    // Phase 1 legacy — keep for backward compat
    evaluation: {
      score: { type: Number, default: null },
      status: { type: String, default: null },
      semanticSimilarity: { type: Number, default: null },
      textScore: { type: Number, default: null },
      audioScore: { type: Number, default: null },
      videoScore: { type: Number, default: null },
      overallScore: { type: Number, default: null },
      feedback: { type: String, default: null },
      isDevelopmentEvaluation: { type: Boolean, default: true },
      notice: { type: String, default: null },
      wordCount: { type: Number, default: null },
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Response', responseSchema);
