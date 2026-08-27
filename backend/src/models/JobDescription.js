const mongoose = require('mongoose');

const jdSkillSchema = new mongoose.Schema(
  {
    name: { type: String },
    canonicalName: { type: String },
    category: { type: String },
  },
  { _id: false }
);

const jobDescriptionSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    // Raw user-provided content
    content: {
      type: String,
      required: true,
    },
    targetRole: {
      type: String,
      required: true,
      trim: true,
    },
    // Phase 2 — structured JD profile
    parsedData: {
      jobTitle: { type: String, default: null },
      company: { type: String, default: null },
      location: { type: String, default: null },
      experienceRequirement: { type: String, default: null },
      requiredSkills: [jdSkillSchema],
      preferredSkills: [jdSkillSchema],
      responsibilities: [{ type: String }],
      softSkills: [{ type: String }],
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    processingError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('JobDescription', jobDescriptionSchema);
