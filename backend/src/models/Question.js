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
    // Phase 3 — expanded type system
    type: {
      type: String,
      enum: ['technical', 'project', 'experience', 'behavioral', 'job_specific', 'skill_gap', 'follow_up'],
      default: 'technical',
    },
    category: {
      type: String,
      enum: ['technical', 'behavioral', 'hr', 'project', 'conceptual', 'situational', 'skill_gap', 'experience', 'follow_up'],
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
    // Phase 3 — question source
    source: {
      type: String,
      enum: ['resume', 'job_description', 'skill_gap', 'behavioral', 'experience', 'static_bank'],
      default: 'static_bank',
    },
    // Phase 3 — which project from resume this references
    sourceProject: {
      type: String,
      default: null,
    },
    // Phase 4 — expected concepts for SBERT evaluation
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
