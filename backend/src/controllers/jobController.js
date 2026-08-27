const JobDescription = require('../models/JobDescription');
const { sendError, sendSuccess } = require('../utils/errorHandler');
const { validateJobDescription } = require('../utils/validators');
const { analyzeJobDescription } = require('../services/jobAnalysisService');

/**
 * POST /api/jobs
 * Create a new job description for the authenticated user.
 */
const createJob = async (req, res) => {
  try {
    const errors = validateJobDescription(req.body);
    if (errors.length > 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', errors.join(' '));
    }

    const { content, targetRole } = req.body;

    const job = await JobDescription.create({
      clerkUserId: req.clerkUserId,
      content: content.trim(),
      targetRole: targetRole.trim(),
      processingStatus: 'pending',
    });

    return sendSuccess(res, {
      message: 'Job description saved successfully.',
      job: {
        id: job._id,
        targetRole: job.targetRole,
        processingStatus: job.processingStatus,
        createdAt: job.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('[Job] Create error:', error);
    return sendError(res, 500, 'JOB_CREATE_FAILED', 'Could not save job description.', error.message);
  }
};

/**
 * GET /api/jobs
 * Get all job descriptions for the authenticated user.
 */
const getUserJobs = async (req, res) => {
  try {
    const jobs = await JobDescription.find({ clerkUserId: req.clerkUserId })
      .select('targetRole processingStatus createdAt parsedData.jobTitle')
      .sort({ createdAt: -1 });

    return sendSuccess(res, { jobs });
  } catch (error) {
    return sendError(res, 500, 'JOB_FETCH_FAILED', 'Could not retrieve job descriptions.', error.message);
  }
};

/**
 * GET /api/jobs/:id
 * Get a specific job description — verifies ownership.
 */
const getJob = async (req, res) => {
  try {
    const job = await JobDescription.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    });

    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job description not found.');
    }

    return sendSuccess(res, { job });
  } catch (error) {
    return sendError(res, 500, 'JOB_FETCH_FAILED', 'Could not retrieve job description.', error.message);
  }
};

/**
 * POST /api/jobs/:id/analyze
 * Analyze the stored JD text — Phase 2.
 *
 * 1. Verify Clerk auth + ownership
 * 2. Run JD section detection + skill extraction
 * 3. Save structured parsedData
 * 4. Return structured JD profile
 */
const analyzeJob = async (req, res) => {
  let job = null;

  try {
    job = await JobDescription.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    });

    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job description not found.');
    }

    // Return cached result if already analyzed and not forcing re-analysis
    if (
      job.processingStatus === 'completed' &&
      job.parsedData &&
      !req.query.force
    ) {
      return sendSuccess(res, {
        message: 'Job description already analyzed. Returning cached result.',
        job: {
          id: job._id,
          processingStatus: job.processingStatus,
          parsedData: job.parsedData,
        },
      });
    }

    // Mark as processing
    await JobDescription.updateOne(
      { _id: job._id },
      { processingStatus: 'processing', processingError: null }
    );

    let jdProfile;
    try {
      jdProfile = analyzeJobDescription(job.content, job.targetRole);
    } catch (analysisErr) {
      await JobDescription.updateOne(
        { _id: job._id },
        { processingStatus: 'failed', processingError: analysisErr.message }
      );
      return sendError(res, 422, 'JD_ANALYSIS_FAILED', 'Unable to analyze the job description.', analysisErr.message);
    }

    // Save
    await JobDescription.updateOne(
      { _id: job._id },
      {
        parsedData: jdProfile,
        processingStatus: 'completed',
        processingError: null,
      }
    );

    return sendSuccess(res, {
      message: 'Job description analyzed successfully.',
      job: {
        id: job._id,
        processingStatus: 'completed',
        parsedData: jdProfile,
      },
    });
  } catch (error) {
    console.error('[Job] Analysis error:', error);
    if (job) {
      await JobDescription.updateOne(
        { _id: job._id },
        { processingStatus: 'failed', processingError: error.message }
      ).catch(() => {});
    }
    return sendError(res, 500, 'JD_ANALYSIS_FAILED', 'Job description analysis failed.', error.message);
  }
};

/**
 * GET /api/jobs/:id/analysis
 * Get the analysis result for a JD.
 */
const getJobAnalysis = async (req, res) => {
  try {
    const job = await JobDescription.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    }).select('-content');

    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job description not found.');
    }

    return sendSuccess(res, {
      job: {
        id: job._id,
        targetRole: job.targetRole,
        processingStatus: job.processingStatus,
        processingError: job.processingError,
        parsedData: job.parsedData || null,
        analyzedAt: job.updatedAt,
      },
    });
  } catch (error) {
    return sendError(res, 500, 'JOB_FETCH_FAILED', 'Could not retrieve job analysis.', error.message);
  }
};

module.exports = {
  createJob,
  getUserJobs,
  getJob,
  analyzeJob,
  getJobAnalysis,
};
