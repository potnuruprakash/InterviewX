const mongoose = require('mongoose');

const skillAnalysisSchema = new mongoose.Schema(
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

    // Required skill matching
    matchedRequiredSkills: [{ type: String }],
    notIdentifiedRequiredSkills: [{ type: String }],

    // Preferred skill matching (reported separately, not mixed into main coverage)
    matchedPreferredSkills: [{ type: String }],
    notIdentifiedPreferredSkills: [{ type: String }],

    // Tri-state skill gap engine fields
    strongSkills: [{ type: String }],
    partialSkills: [{ type: String }],
    missingSkills: [{ type: String }],

    // Candidate has skills not listed in JD at all
    additionalSkills: [{ type: String }],

    // Coverage / match metrics — based on required skills only
    requiredSkillCount: { type: Number, default: 0 },
    matchedRequiredSkillCount: { type: Number, default: 0 },
    partialSkillCount: { type: Number, default: 0 },
    missingSkillCount: { type: Number, default: 0 },
    notIdentifiedRequiredSkillCount: { type: Number, default: 0 },

    // Overall Match is the weighted required-skill score.
    // Skill Gap is its complement.
    overallMatchPercentage: { type: Number, default: 0 },
    skillCoveragePercentage: { type: Number, default: 0 },
    skillGapPercentage: { type: Number, default: 100 },

    // Analysis version (allows detecting staleness)
    analysisVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

skillAnalysisSchema.index(
  { clerkUserId: 1, resumeId: 1, jobDescriptionId: 1 },
  { unique: true }
);

module.exports = mongoose.model('SkillAnalysis', skillAnalysisSchema);
