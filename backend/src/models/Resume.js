const mongoose = require('mongoose');

const skillObjectSchema = new mongoose.Schema(
  {
    name: { type: String },
    canonicalName: { type: String },
    category: { type: String },
    source: { type: String, enum: ['skills_section', 'project', 'experience', 'implied', 'unknown'], default: 'unknown' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String },
    description: { type: String },
    technologies: [{ type: String }],
    contribution: { type: String },
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    jobTitle: { type: String },
    organization: { type: String },
    duration: { type: String },
    responsibilities: [{ type: String }],
    technologies: [{ type: String }],
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    degree: { type: String },
    institution: { type: String },
    fieldOfStudy: { type: String },
    graduationYear: { type: Number },
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String },
    issuingOrganization: { type: String },
    date: { type: String },
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    storedFilename: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    // Phase 2 — extracted text
    extractedText: {
      type: String,
      default: null,
    },
    // Extracted and structured candidate profile
    parsedData: {
      name: { type: String, default: null },
      summary: { type: String, default: null },
      basicInfo: {
        name: { type: String, default: null },
        email: { type: String, default: null },
        phone: { type: String, default: null },
        location: { type: String, default: null },
        summary: { type: String, default: null },
      },
      skills: [{ type: String }],
      detailedSkills: [skillObjectSchema],
      languages: [{ type: String }],
      frameworks: [{ type: String }],
      libraries: [{ type: String }],
      databases: [{ type: String }],
      tools: [{ type: String }],
      cloud: [{ type: String }],
      projects: [projectSchema],
      experience: [experienceSchema],
      education: [educationSchema],
      certifications: [certificationSchema],
    },
    // Backwards compatibility alias for components expecting resume.analysis
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

// Virtual alias: resume.profile -> resume.parsedData
resumeSchema.virtual('profile').get(function () {
  return this.parsedData || this.analysis || {};
});

module.exports = mongoose.model('Resume', resumeSchema);

