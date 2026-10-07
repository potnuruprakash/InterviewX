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
    // Structured JD profile
    parsedData: {
      title: { type: String, default: null },
      jobTitle: { type: String, default: null },
      company: { type: String, default: null },
      location: { type: String, default: null },
      experienceRequirement: { type: String, default: null },
      requiredSkills: [jdSkillSchema],
      preferredSkills: [jdSkillSchema],
      requiredSkillNames: [{ type: String }],
      preferredSkillNames: [{ type: String }],
      roleExpectations: [{ type: String }],
      responsibilities: [{ type: String }],
      softSkills: [{ type: String }],
    },
    // Backwards compatibility alias for components expecting job.analysis
    analysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias: job.profile -> job.parsedData
jobDescriptionSchema.virtual('profile').get(function () {
  return this.parsedData || this.analysis || {};
});

jobDescriptionSchema.index({ clerkUserId: 1, createdAt: -1 });

module.exports = mongoose.model('JobDescription', jobDescriptionSchema);

