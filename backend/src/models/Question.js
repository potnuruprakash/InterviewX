const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    // Phase 3 & Structured Question Engine
    type: {
      type: String,
      enum: ['introduction', 'resume', 'technical', 'coding', 'project', 'experience', 'behavioral', 'job_specific', 'skill_gap', 'follow_up'],
      default: 'technical',
    },
    category: {
      type: String,
      enum: ['introduction', 'resume', 'project', 'technical', 'coding', 'behavioral', 'hr', 'conceptual', 'situational', 'skill_gap', 'experience', 'follow_up', 'job_description'],
      default: 'technical',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    // Phase 3 — target skill/context
    targetSkill: {
      type: String,
      default: null,
    },
    // Legacy field — keep for backward compat
    skill: {
      type: String,
      default: 'general',
    },
    // Phase 3 & Master Prompt — question source
    source: {
      type: String,
      enum: ['resume', 'project', 'job_description', 'skill_gap', 'behavioral', 'experience', 'previous_answer', 'general_pool', 'static_bank'],
      default: 'static_bank',
    },
    // Phase 3 — which project from resume this references
    sourceProject: {
      type: String,
      default: null,
    },
    // Master Prompt & SBERT evaluation
    expectedTopics: {
      type: [String],
      default: [],
    },
    expectedConcepts: {
      type: [String],
      default: [],
    },
    // Legacy — keep for backward compat
    expectedKeyPoints: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      required: true,
    },
    // Phase 8 — adaptive engine
    isAdaptive: {
      type: Boolean,
      default: false,
    },
    followUpAllowed: {
      type: Boolean,
      default: true,
    },
    parentQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null,
    },
    // Phase 3 — context note for skill gap questions
    contextNote: {
      type: String,
      default: null,
    },
    // Coding challenge properties
    starterCode: {
      type: String,
      default: null,
    },
    language: {
      type: String,
      default: 'javascript',
    },
    // Question Status (e.g. pending, answered, skipped, timeout)
    status: {
      type: String,
      enum: ['pending', 'answered', 'skipped', 'timeout'],
      default: 'pending',
    },
    skippedAt: {
      type: Date,
      default: null,
    },
    skipReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

questionSchema.index({ interviewId: 1, order: 1 });
questionSchema.index({ clerkUserId: 1, interviewId: 1 });

module.exports = mongoose.model('Question', questionSchema);

