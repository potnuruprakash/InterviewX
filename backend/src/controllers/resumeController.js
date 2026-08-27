const path = require('path');
const Resume = require('../models/Resume');
const { sendError, sendSuccess } = require('../utils/errorHandler');
const { extractTextFromFile } = require('../services/resumeParserService');
const { analyzeResume } = require('../services/resumeAnalysisService');

/**
 * POST /api/resumes/upload
 * Uploads and stores a resume file for the authenticated user.
 */
const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'NO_FILE', 'No file was uploaded. Please attach a PDF or DOCX file.');
    }

    const clerkUserId = req.clerkUserId;

    const resume = await Resume.create({
      clerkUserId,
      originalName: req.file.originalname,
      storedFilename: req.file.filename,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      processingStatus: 'pending',
    });

    return sendSuccess(res, {
      message: 'Resume uploaded successfully.',
      resume: {
        id: resume._id,
        originalName: resume.originalName,
        fileSize: resume.fileSize,
        mimeType: resume.mimeType,
        processingStatus: resume.processingStatus,
        uploadedAt: resume.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('[Resume] Upload error:', error);
    return sendError(res, 500, 'RESUME_UPLOAD_FAILED', 'The resume could not be uploaded.', error.message);
  }
};

/**
 * GET /api/resumes
 * Get all resumes for the authenticated user.
 */
const getUserResumes = async (req, res) => {
  try {
    const resumes = await Resume.find({ clerkUserId: req.clerkUserId })
      .select('-filePath -storedFilename -extractedText')
      .sort({ createdAt: -1 });

    return sendSuccess(res, { resumes });
  } catch (error) {
    return sendError(res, 500, 'RESUME_FETCH_FAILED', 'Could not retrieve resumes.', error.message);
  }
};

/**
 * GET /api/resumes/:id
 * Get a specific resume — verifies ownership.
 */
const getResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    }).select('-filePath -storedFilename -extractedText');

    if (!resume) {
      return sendError(res, 404, 'RESUME_NOT_FOUND', 'Resume not found.');
    }

    return sendSuccess(res, { resume });
  } catch (error) {
    return sendError(res, 500, 'RESUME_FETCH_FAILED', 'Could not retrieve resume.', error.message);
  }
};

/**
 * POST /api/resumes/:id/analyze
 * Extract text and analyze the resume — Phase 2.
 *
 * 1. Verify Clerk auth + ownership
 * 2. Extract text from PDF/DOCX
 * 3. Section-aware analysis
 * 4. Skill normalization
 * 5. Save structured parsedData
 * 6. Return candidate profile
 */
const analyzeResumeController = async (req, res) => {
  let resume = null;

  try {
    resume = await Resume.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    });

    if (!resume) {
      return sendError(res, 404, 'RESUME_NOT_FOUND', 'Resume not found.');
    }

    // If already completed and not forcing re-analysis, return cached result
    if (
      resume.processingStatus === 'completed' &&
      resume.parsedData &&
      !req.query.force
    ) {
      return sendSuccess(res, {
        message: 'Resume already analyzed. Returning cached result.',
        resume: {
          id: resume._id,
          processingStatus: resume.processingStatus,
          parsedData: resume.parsedData,
        },
      });
    }

    // Mark as processing
    await Resume.updateOne({ _id: resume._id }, { processingStatus: 'processing', processingError: null });

    // Step 1: Extract text
    let extractedText;
    try {
      extractedText = await extractTextFromFile(resume.filePath, resume.mimeType);
    } catch (parseErr) {
      await Resume.updateOne(
        { _id: resume._id },
        { processingStatus: 'failed', processingError: parseErr.message }
      );
      return sendError(res, 422, 'TEXT_EXTRACTION_FAILED', parseErr.message);
    }

    // Step 2: Analyze
    let candidateProfile;
    try {
      candidateProfile = analyzeResume(extractedText);
    } catch (analysisErr) {
      await Resume.updateOne(
        { _id: resume._id },
        { processingStatus: 'failed', processingError: analysisErr.message }
      );
      return sendError(res, 422, 'RESUME_ANALYSIS_FAILED', 'Unable to analyze the resume content.', analysisErr.message);
    }

    // Step 3: Save
    await Resume.updateOne(
      { _id: resume._id },
      {
        extractedText,
        parsedData: candidateProfile,
        processingStatus: 'completed',
        processingError: null,
      }
    );

    return sendSuccess(res, {
      message: 'Resume analyzed successfully.',
      resume: {
        id: resume._id,
        processingStatus: 'completed',
        parsedData: candidateProfile,
      },
    });
  } catch (error) {
    console.error('[Resume] Analysis error:', error);
    if (resume) {
      await Resume.updateOne(
        { _id: resume._id },
        { processingStatus: 'failed', processingError: error.message }
      ).catch(() => {});
    }
    return sendError(res, 500, 'RESUME_ANALYSIS_FAILED', 'Resume analysis failed.', error.message);
  }
};

/**
 * GET /api/resumes/:id/analysis
 * Get the analysis result for a resume (without raw text).
 */
const getResumeAnalysis = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      clerkUserId: req.clerkUserId,
    }).select('-filePath -storedFilename -extractedText');

    if (!resume) {
      return sendError(res, 404, 'RESUME_NOT_FOUND', 'Resume not found.');
    }

    if (resume.processingStatus !== 'completed') {
      return sendSuccess(res, {
        resume: {
          id: resume._id,
          processingStatus: resume.processingStatus,
          processingError: resume.processingError,
          parsedData: null,
        },
      });
    }

    return sendSuccess(res, {
      resume: {
        id: resume._id,
        originalName: resume.originalName,
        processingStatus: resume.processingStatus,
        parsedData: resume.parsedData,
        analyzedAt: resume.updatedAt,
      },
    });
  } catch (error) {
    return sendError(res, 500, 'RESUME_FETCH_FAILED', 'Could not retrieve resume analysis.', error.message);
  }
};

module.exports = {
  uploadResume,
  getUserResumes,
  getResume,
  analyzeResumeController,
  getResumeAnalysis,
};
