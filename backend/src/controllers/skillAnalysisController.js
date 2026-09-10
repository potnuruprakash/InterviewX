/**
 * Skill Analysis Controller — Phase 2
 *
 * Orchestrates the full skill gap analysis:
 *   1. Verify auth + ownership of resume and JD
 *   2. Check both have been analyzed (status: completed)
 *   3. Run skill matching
 *   4. Calculate coverage
 *   5. Upsert SkillAnalysis document (one per resumeId+jobDescriptionId+user)
 *   6. Return structured result
 */

const SkillAnalysis = require('../models/SkillAnalysis');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const { sendError, sendSuccess } = require('../utils/errorHandler');
const { analyzeSkillGap } = require('../services/skillMatchingService');

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

    // Verify resume ownership
    const resume = await Resume.findOne({ _id: resumeId, clerkUserId });
    if (!resume) {
      return sendError(res, 404, 'RESUME_NOT_FOUND', 'Resume not found or access denied.');
    }

    // Verify JD ownership
    const job = await JobDescription.findOne({ _id: jobDescriptionId, clerkUserId });
    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job description not found or access denied.');
    }

    // Auto-analyze resume if not yet analyzed OR if skills array is empty
    // (empty skills = previous analysis extracted 0 skills, needs re-run with improved parser)
    const resumeNeedsAnalysis = (
      resume.processingStatus !== 'completed' ||
      !resume.parsedData ||
      !Array.isArray(resume.parsedData.skills) ||
      resume.parsedData.skills.length === 0
    );

    if (resumeNeedsAnalysis) {
      try {
        const { extractTextFromFile } = require('../services/resumeParserService');
        const { analyzeResume } = require('../services/resumeAnalysisService');

        // Re-use already extracted text if available, otherwise re-extract
        let extractedText = resume.extractedText;
        if (!extractedText) {
          extractedText = await extractTextFromFile(resume.filePath, resume.mimeType);
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`[SkillAnalysis] Auto-analyzing resume. Text: ${extractedText.length} chars, Prior skill count: ${resume.parsedData?.skills?.length || 0}`);
        }

        const candidateProfile = analyzeResume(extractedText);
        resume.extractedText = resume.extractedText || extractedText;
        resume.parsedData = candidateProfile;
        resume.processingStatus = 'completed';
        await resume.save();
      } catch (resumeErr) {
        if (resume.processingStatus !== 'completed') {
          return sendError(
            res, 400, 'RESUME_NOT_ANALYZED',
            'Resume has not been analyzed yet. Please run resume analysis first.'
          );
        }
        // If re-analysis failed but resume was previously completed, use existing data
        console.warn('[SkillAnalysis] Resume re-analysis failed, using existing parsedData:', resumeErr.message);
      }
    }

    // Auto-analyze job description if not yet analyzed OR if it extracted 0 required skills
    const jobNeedsAnalysis = (
      job.processingStatus !== 'completed' ||
      !job.parsedData ||
      !Array.isArray(job.parsedData.requiredSkills) ||
      job.parsedData.requiredSkills.length === 0
    );

    if (jobNeedsAnalysis) {
      try {
        const { analyzeJobDescription } = require('../services/jobAnalysisService');
        const jdProfile = analyzeJobDescription(job.content, job.targetRole);
        job.parsedData = jdProfile;
        job.processingStatus = 'completed';
        await job.save();

        if (process.env.NODE_ENV === 'development') {
          console.log(`[SkillAnalysis] JD re-analyzed. Required skills: ${jdProfile.requiredSkills?.length || 0}`);
        }
      } catch (jobErr) {
        console.warn('[SkillAnalysis] JD auto-analysis failed:', jobErr.message);
        if (!job.parsedData) {
          job.parsedData = { requiredSkills: [], preferredSkills: [], responsibilities: [], softSkills: [] };
          job.processingStatus = 'completed';
          await job.save();
        }
      }
    }

    // Run skill gap analysis
    const candidateSkills = resume.parsedData?.skills || [];
    const requiredSkills = job.parsedData?.requiredSkills || [];
    const preferredSkills = job.parsedData?.preferredSkills || [];

    // ── Dev-only debug logging ──────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      console.log('\n[SkillAnalysis] ══════════════════════════════════════════');
      console.log(`[SkillAnalysis] Resume extracted text length: ${resume.extractedText?.length || '(not stored)'} chars`);
      console.log(`[SkillAnalysis] Candidate skill count: ${candidateSkills.length}`);
      console.log(`[SkillAnalysis] Candidate canonical names: ${candidateSkills.map((s) => s.canonicalName).join(', ') || '(none)'}`);
      console.log(`[SkillAnalysis] Required skill count: ${requiredSkills.length}`);
      console.log(`[SkillAnalysis] Required canonical names: ${requiredSkills.map((s) => s.canonicalName).join(', ') || '(none)'}`);
      console.log(`[SkillAnalysis] Preferred skill count: ${preferredSkills.length}`);
      console.log('[SkillAnalysis] ══════════════════════════════════════════\n');
    }

    // Validation: warn if skills are empty
    if (candidateSkills.length === 0) {
      console.warn('[SkillAnalysis] WARNING: No candidate skills found in resume. Returning 0% coverage.');
    }
    if (requiredSkills.length === 0) {
      console.warn('[SkillAnalysis] WARNING: No required skills found in JD. Coverage will be 0%.');
    }

    const result = analyzeSkillGap(candidateSkills, requiredSkills, preferredSkills);

    // ── Dev-only result logging ─────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      console.log('[SkillAnalysis] Results:');
      console.log(`  Matched required: [${result.matchedRequiredSkills.join(', ')}]`);
      console.log(`  Missing required: [${result.notIdentifiedRequiredSkills.join(', ')}]`);
      console.log(`  Additional (candidate-only): [${result.additionalSkills.join(', ')}]`);
      console.log(`  Coverage: ${result.skillCoveragePercentage}% (${result.matchedRequiredSkillCount}/${result.requiredSkillCount})`);
      console.log(`  Gap: ${result.skillGapPercentage}%\n`);
    }

    // Upsert SkillAnalysis — one document per (user + resume + JD)
    const analysisDoc = await SkillAnalysis.findOneAndUpdate(
      { clerkUserId, resumeId, jobDescriptionId },
      {
        $set: {
          matchedRequiredSkills: result.matchedRequiredSkills,
          notIdentifiedRequiredSkills: result.notIdentifiedRequiredSkills,
          matchedPreferredSkills: result.matchedPreferredSkills,
          notIdentifiedPreferredSkills: result.notIdentifiedPreferredSkills,
          additionalSkills: result.additionalSkills,
          requiredSkillCount: result.requiredSkillCount,
          matchedRequiredSkillCount: result.matchedRequiredSkillCount,
          notIdentifiedRequiredSkillCount: result.notIdentifiedRequiredSkillCount,
          skillCoveragePercentage: result.skillCoveragePercentage,
          skillGapPercentage: result.skillGapPercentage,
        },
        $inc: { analysisVersion: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, {
      message: 'Skill gap analysis completed.',
      skillAnalysis: {
        id: analysisDoc._id,
        resumeId,
        jobDescriptionId,
        matchedRequiredSkills: result.matchedRequiredSkills,
        notIdentifiedRequiredSkills: result.notIdentifiedRequiredSkills,
        matchedPreferredSkills: result.matchedPreferredSkills,
        notIdentifiedPreferredSkills: result.notIdentifiedPreferredSkills,
        additionalSkills: result.additionalSkills,
        requiredSkillCount: result.requiredSkillCount,
        matchedRequiredSkillCount: result.matchedRequiredSkillCount,
        notIdentifiedRequiredSkillCount: result.notIdentifiedRequiredSkillCount,
        skillCoveragePercentage: result.skillCoveragePercentage,
        skillGapPercentage: result.skillGapPercentage,
        candidateSkillCount: candidateSkills.length,
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
      },
    });
  } catch (error) {
    console.error('[SkillAnalysis] Run error:', error);
    return sendError(res, 500, 'SKILL_ANALYSIS_FAILED', 'Skill analysis failed.', error.message);
  }
};

/**
 * GET /api/skill-analysis/:id
 * Get a specific skill analysis — verifies ownership.
 */
const getSkillAnalysis = async (req, res) => {
  try {
    const analysis = await SkillAnalysis.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    });

    if (!analysis) {
      return sendError(res, 404, 'SKILL_ANALYSIS_NOT_FOUND', 'Skill analysis not found.');
    }

    // Optionally populate resume and JD info
    const resume = await Resume.findById(analysis.resumeId).select('originalName parsedData.basicInfo parsedData.skills parsedData.projects parsedData.education parsedData.experience processingStatus');
    const job = await JobDescription.findById(analysis.jobDescriptionId).select('targetRole parsedData processingStatus');

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
    return sendError(res, 500, 'SKILL_ANALYSIS_FETCH_FAILED', 'Could not retrieve skill analysis.', error.message);
  }
};

/**
 * GET /api/skill-analysis
 * Get all skill analyses for the authenticated user.
 */
const getUserSkillAnalyses = async (req, res) => {
  try {
    const analyses = await SkillAnalysis.find({ clerkUserId: req.clerkUserId })
      .select('resumeId jobDescriptionId skillCoveragePercentage skillGapPercentage matchedRequiredSkillCount requiredSkillCount createdAt updatedAt analysisVersion')
      .sort({ updatedAt: -1 });

    return sendSuccess(res, { skillAnalyses: analyses });
  } catch (error) {
    return sendError(res, 500, 'SKILL_ANALYSIS_FETCH_FAILED', 'Could not retrieve skill analyses.', error.message);
  }
};

/**
 * GET /api/skill-analysis/by-context
 * Get analysis for a specific resume + JD combination.
 * Query params: ?resumeId=...&jobDescriptionId=...
 */
const getAnalysisByContext = async (req, res) => {
  try {
    const { resumeId, jobDescriptionId } = req.query;
    const clerkUserId = req.clerkUserId;

    if (!resumeId || !jobDescriptionId) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'resumeId and jobDescriptionId query params are required.');
    }

    const analysis = await SkillAnalysis.findOne({ clerkUserId, resumeId, jobDescriptionId });

    if (!analysis) {
      return sendSuccess(res, { skillAnalysis: null, message: 'No analysis found for this combination.' });
    }

    const resume = await Resume.findById(resumeId).select('originalName parsedData.basicInfo parsedData.skills parsedData.projects parsedData.education parsedData.experience processingStatus');
    const job = await JobDescription.findById(jobDescriptionId).select('targetRole parsedData processingStatus');

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
    return sendError(res, 500, 'SKILL_ANALYSIS_FETCH_FAILED', 'Could not retrieve skill analysis.', error.message);
  }
};

module.exports = {
  runSkillAnalysis,
  getSkillAnalysis,
  getUserSkillAnalyses,
  getAnalysisByContext,
};
