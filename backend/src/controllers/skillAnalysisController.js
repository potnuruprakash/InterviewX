/**
 * Skill Analysis Controller — Phase 2
 *
 * Orchestrates the full skill gap analysis:
 *   1. Verify auth + ownership of resume and JD
 *   2. Ensure resume and JD are analyzed
 *   3. Run deterministic skill matching
 *   4. Calculate weighted overall match and skill gap
 *   5. Upsert SkillAnalysis document
 *   6. Return structured result
 */

const SkillAnalysis = require('../models/SkillAnalysis');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const { sendError, sendSuccess } = require('../utils/errorHandler');
const { analyzeSkillGap } = require('../services/skillMatchingService');

const buildSkillAnalysisResponse = ({
  analysisDoc,
  resumeId,
  jobDescriptionId,
  result,
  resume,
  job,
}) => ({
  id: analysisDoc._id,
  resumeId,
  jobDescriptionId,
  matchedRequiredSkills: result.matchedRequiredSkills,
  notIdentifiedRequiredSkills: result.notIdentifiedRequiredSkills,
  matchedPreferredSkills: result.matchedPreferredSkills,
  notIdentifiedPreferredSkills: result.notIdentifiedPreferredSkills,
  strongSkills: result.strongSkills || result.matchedRequiredSkills,
  partialSkills: result.partialSkills || [],
  missingSkills: result.missingSkills || result.notIdentifiedRequiredSkills,
  additionalSkills: result.additionalSkills,

  requiredSkillCount: result.requiredSkillCount,
  matchedRequiredSkillCount: result.matchedRequiredSkillCount,
  partialSkillCount: result.partialSkillCount,
  missingSkillCount: result.missingSkillCount,
  notIdentifiedRequiredSkillCount: result.notIdentifiedRequiredSkillCount,

  // Overall Match is the weighted required-skill score.
  // Skill Gap is its complement.
  overallMatchPercentage: result.overallMatchPercentage,
  skillCoveragePercentage: result.overallMatchPercentage,
  skillGapPercentage: result.skillGapPercentage,
  matchWeights: result.matchWeights,

  candidateProfile: {
    basicInfo: resume.parsedData.basicInfo,
    skills: resume.parsedData.skills,
    projects: resume.parsedData.projects,
    experience: resume.parsedData.experience,
    education: resume.parsedData.education,
    certifications: resume.parsedData.certifications,
  },

  jobProfile: {
    jobTitle: job.parsedData.jobTitle,
    company: job.parsedData.company,
    location: job.parsedData.location,
    experienceRequirement: job.parsedData.experienceRequirement,
    requiredSkills: job.parsedData.requiredSkills,
    preferredSkills: job.parsedData.preferredSkills,
    responsibilities: job.parsedData.responsibilities,
    softSkills: job.parsedData.softSkills,
  },

  analysisVersion: analysisDoc.analysisVersion,
  analyzedAt: analysisDoc.updatedAt,
});

/**
 * POST /api/skill-analysis
 * Body: { resumeId, jobDescriptionId }
 */
const runSkillAnalysis = async (req, res) => {
  try {
    const { resumeId, jobDescriptionId } = req.body;
    const clerkUserId = req.clerkUserId;

    if (!resumeId || !jobDescriptionId) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'resumeId and jobDescriptionId are required.');
    }

    const resume = await Resume.findOne({ _id: resumeId, clerkUserId });
    if (!resume) {
      return sendError(res, 404, 'RESUME_NOT_FOUND', 'Resume not found or access denied.');
    }

    const job = await JobDescription.findOne({ _id: jobDescriptionId, clerkUserId });
    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job description not found or access denied.');
    }

    if (resume.processingStatus !== 'completed' || !resume.parsedData) {
      try {
        const { extractTextFromFile } = require('../services/resumeParserService');
        const { analyzeResume } = require('../services/resumeAnalysisService');
        const extractedText = await extractTextFromFile(resume.filePath, resume.mimeType);
        const candidateProfile = analyzeResume(extractedText);
        resume.extractedText = extractedText;
        resume.parsedData = candidateProfile;
        resume.processingStatus = 'completed';
        await resume.save();
      } catch (resumeErr) {
        return sendError(
          res,
          400,
          'RESUME_NOT_ANALYZED',
          'Resume has not been analyzed yet. Please run resume analysis first.'
        );
      }
    }

    if (job.processingStatus !== 'completed' || !job.parsedData) {
      try {
        const { analyzeJobDescription } = require('../services/jobAnalysisService');
        const jdProfile = analyzeJobDescription(job.content, job.targetRole);
        job.parsedData = jdProfile;
        job.processingStatus = 'completed';
        await job.save();
      } catch (jobErr) {
        job.parsedData = {
          requiredSkills: [],
          preferredSkills: [],
          responsibilities: [],
          softSkills: [],
        };
        job.processingStatus = 'completed';
        await job.save();
      }
    }

    const candidateSkills = resume.parsedData.skills || [];
    const requiredSkills = job.parsedData.requiredSkills || [];
    const preferredSkills = job.parsedData.preferredSkills || [];

    const result = analyzeSkillGap(candidateSkills, requiredSkills, preferredSkills);

    const analysisDoc = await SkillAnalysis.findOneAndUpdate(
      { clerkUserId, resumeId, jobDescriptionId },
      {
        $set: {
          matchedRequiredSkills: result.matchedRequiredSkills,
          notIdentifiedRequiredSkills: result.notIdentifiedRequiredSkills,
          matchedPreferredSkills: result.matchedPreferredSkills,
          notIdentifiedPreferredSkills: result.notIdentifiedPreferredSkills,
          strongSkills: result.strongSkills || result.matchedRequiredSkills,
          partialSkills: result.partialSkills || [],
          missingSkills: result.missingSkills || result.notIdentifiedRequiredSkills,
          additionalSkills: result.additionalSkills,
          requiredSkillCount: result.requiredSkillCount,
          matchedRequiredSkillCount: result.matchedRequiredSkillCount,
          notIdentifiedRequiredSkillCount: result.notIdentifiedRequiredSkillCount,
          skillCoveragePercentage: result.overallMatchPercentage,
          skillGapPercentage: result.skillGapPercentage,
        },
        $inc: { analysisVersion: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, {
      message: 'Skill gap analysis completed.',
      skillAnalysis: buildSkillAnalysisResponse({
        analysisDoc,
        resumeId,
        jobDescriptionId,
        result,
        resume,
        job,
      }),
    });
  } catch (error) {
    console.error('[SkillAnalysis] Run error:', error);
    return sendError(
      res,
      500,
      'SKILL_ANALYSIS_FAILED',
      'Skill analysis failed.',
      error.message
    );
  }
};

const getSkillAnalysis = async (req, res) => {
  try {
    const analysis = await SkillAnalysis.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    });

    if (!analysis) {
      return sendError(res, 404, 'SKILL_ANALYSIS_NOT_FOUND', 'Skill analysis not found.');
    }

    const resume = await Resume.findById(analysis.resumeId).select(
      'originalName parsedData.basicInfo parsedData.skills parsedData.projects parsedData.education parsedData.experience processingStatus'
    );
    const job = await JobDescription.findById(analysis.jobDescriptionId).select(
      'targetRole parsedData processingStatus'
    );

    return sendSuccess(res, {
      skillAnalysis: {
        ...analysis.toObject(),
        candidateProfile: resume?.parsedData || null,
        resumeName: resume?.originalName || null,
        jobProfile: job?.parsedData || null,
        targetRole: job?.targetRole || null,
      },
    });
  } catch (error) {
    return sendError(
      res,
      500,
      'SKILL_ANALYSIS_FETCH_FAILED',
      'Could not retrieve skill analysis.',
      error.message
    );
  }
};

const getUserSkillAnalyses = async (req, res) => {
  try {
    const analyses = await SkillAnalysis.find({ clerkUserId: req.clerkUserId })
      .select(
        'resumeId jobDescriptionId skillCoveragePercentage skillGapPercentage matchedRequiredSkillCount requiredSkillCount createdAt updatedAt analysisVersion'
      )
      .sort({ updatedAt: -1 });

    return sendSuccess(res, { skillAnalyses: analyses });
  } catch (error) {
    return sendError(
      res,
      500,
      'SKILL_ANALYSIS_FETCH_FAILED',
      'Could not retrieve skill analyses.',
      error.message
    );
  }
};

const getAnalysisByContext = async (req, res) => {
  try {
    const { resumeId, jobDescriptionId } = req.query;
    const clerkUserId = req.clerkUserId;

    if (!resumeId || !jobDescriptionId) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'resumeId and jobDescriptionId query params are required.'
      );
    }

    const analysis = await SkillAnalysis.findOne({
      clerkUserId,
      resumeId,
      jobDescriptionId,
    });

    if (!analysis) {
      return sendSuccess(res, {
        skillAnalysis: null,
        message: 'No analysis found for this combination.',
      });
    }

    const resume = await Resume.findById(resumeId).select(
      'originalName parsedData.basicInfo parsedData.skills parsedData.projects parsedData.education parsedData.experience processingStatus'
    );
    const job = await JobDescription.findById(jobDescriptionId).select(
      'targetRole parsedData processingStatus'
    );

    return sendSuccess(res, {
      skillAnalysis: {
        ...analysis.toObject(),
        candidateProfile: resume?.parsedData || null,
        resumeName: resume?.originalName || null,
        jobProfile: job?.parsedData || null,
        targetRole: job?.targetRole || null,
      },
    });
  } catch (error) {
    return sendError(
      res,
      500,
      'SKILL_ANALYSIS_FETCH_FAILED',
      'Could not retrieve skill analysis.',
      error.message
    );
  }
};

module.exports = {
  runSkillAnalysis,
  getSkillAnalysis,
  getUserSkillAnalyses,
  getAnalysisByContext,
};
