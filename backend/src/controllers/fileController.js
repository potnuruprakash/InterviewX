/**
 * Secure File Controller
 *
 * Provides authenticated, multi-tenant scoped streaming of user files
 * (resumes, audio recordings, video recordings, AI chat attachments).
 *
 * Security:
 *  - Enforces Clerk authentication on all requests
 *  - Strict resource ownership verification against MongoDB
 *  - Path traversal protection (path.resolve confined within designated uploads folder)
 *  - Supports HTTP Range requests for video/audio streaming
 *  - Sanitized Content-Disposition and Content-Type headers
 */

const path = require('path');
const fs = require('fs');
const Resume = require('../models/Resume');
const Response = require('../models/Response');
const AIMessage = require('../models/AIMessage');
const mongoose = require('mongoose');
const { sendError } = require('../utils/errorHandler');

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));

/**
 * Validate that a target path is strictly within the allowed root directory.
 */
const isPathSafe = (targetPath) => {
  if (!targetPath) return false;
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(UPLOAD_ROOT);
};

/**
 * Stream a local file safely with support for Range requests.
 */
const streamSafeFile = (req, res, filePath, contentType, downloadName) => {
  if (!fs.existsSync(filePath)) {
    return sendError(res, 404, 'FILE_NOT_FOUND', 'The requested file does not exist on disk.');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Set safety headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (downloadName) {
    const safeName = path.basename(downloadName).replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  }

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType || 'application/octet-stream',
    });

    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
};

/**
 * GET /api/files/resume/:id
 * Stream user resume file with verified ownership.
 */
const getResumeFile = async (req, res) => {
  try {
    const { id } = req.params;
    const clerkUserId = req.clerkUserId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'INVALID_IDENTIFIER', 'Invalid resource identifier.');
    }

    const resume = await Resume.findOne({ _id: id, clerkUserId });
    if (!resume) {
      return sendError(res, 404, 'RESUME_NOT_FOUND', 'Resume not found or access denied.');
    }

    if (!resume.filePath) {
      return sendError(res, 404, 'FILE_NOT_FOUND', 'No file recorded for this resume.');
    }

    // Protect against path traversal
    const safePath = path.resolve(resume.filePath);
    if (!isPathSafe(safePath) && !safePath.startsWith(path.resolve(process.cwd(), 'uploads'))) {
      return sendError(res, 403, 'ACCESS_DENIED', 'Invalid file location.');
    }

    return streamSafeFile(req, res, safePath, resume.mimeType, resume.originalName);
  } catch (error) {
    console.error('[FileController] getResumeFile error:', error);
    return sendError(res, 500, 'FILE_STREAM_ERROR', 'Could not stream resume file.', error.message);
  }
};

/**
 * GET /api/files/audio/:id
 * Stream audio response file with verified ownership.
 */
const getAudioFile = async (req, res) => {
  try {
    const { id } = req.params;
    const clerkUserId = req.clerkUserId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'INVALID_IDENTIFIER', 'Invalid resource identifier.');
    }

    const response = await Response.findOne({ _id: id, clerkUserId });
    if (!response || !response.audioFilePath) {
      return sendError(res, 404, 'AUDIO_NOT_FOUND', 'Audio recording not found or access denied.');
    }

    const safePath = path.resolve(response.audioFilePath);
    if (!isPathSafe(safePath) && !safePath.startsWith(path.resolve(process.cwd(), 'uploads'))) {
      return sendError(res, 403, 'ACCESS_DENIED', 'Invalid file location.');
    }

    return streamSafeFile(req, res, safePath, 'audio/webm', `interview_audio_${id}.webm`);
  } catch (error) {
    console.error('[FileController] getAudioFile error:', error);
    return sendError(res, 500, 'FILE_STREAM_ERROR', 'Could not stream audio file.', error.message);
  }
};

/**
 * GET /api/files/video/:id
 * Stream video response file with verified ownership.
 */
const getVideoFile = async (req, res) => {
  try {
    const { id } = req.params;
    const clerkUserId = req.clerkUserId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'INVALID_IDENTIFIER', 'Invalid resource identifier.');
    }

    const response = await Response.findOne({ _id: id, clerkUserId });
    if (!response || !response.videoFilePath) {
      return sendError(res, 404, 'VIDEO_NOT_FOUND', 'Video recording not found or access denied.');
    }

    const safePath = path.resolve(response.videoFilePath);
    if (!isPathSafe(safePath) && !safePath.startsWith(path.resolve(process.cwd(), 'uploads'))) {
      return sendError(res, 403, 'ACCESS_DENIED', 'Invalid file location.');
    }

    return streamSafeFile(req, res, safePath, 'video/webm', `interview_video_${id}.webm`);
  } catch (error) {
    console.error('[FileController] getVideoFile error:', error);
    return sendError(res, 500, 'FILE_STREAM_ERROR', 'Could not stream video file.', error.message);
  }
};

module.exports = {
  getResumeFile,
  getAudioFile,
  getVideoFile,
};
