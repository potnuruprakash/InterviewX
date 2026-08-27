/**
 * File Upload Middleware
 *
 * Handles audio and video file uploads using multer.
 * Files are stored in uploads/audio/ and uploads/video/.
 * Access is protected — files are served only through authenticated endpoints.
 *
 * Security:
 *   - File type validation (MIME + extension)
 *   - Size limits
 *   - Sanitized filenames
 *   - No path traversal
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_BASE = path.join(__dirname, '../../uploads');
const AUDIO_DIR = path.join(UPLOAD_BASE, 'audio');
const VIDEO_DIR = path.join(UPLOAD_BASE, 'video');

// Ensure upload directories exist
[AUDIO_DIR, VIDEO_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_DIR),
  filename: (req, file, cb) => {
    const ext = '.webm'; // Default from MediaRecorder
    const safe = `audio_${req.clerkUserId || 'unknown'}_${uuidv4()}${ext}`;
    cb(null, safe);
  },
});

const audioFilter = (req, file, cb) => {
  const allowed = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg', 'application/octet-stream'];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|ogg|wav|mp4|mp3)$/i)) {
    cb(null, true);
  } else {
    cb(new Error(`INVALID_AUDIO_TYPE: ${file.mimetype} is not allowed.`));
  }
};

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename: (req, file, cb) => {
    const ext = '.webm';
    const safe = `video_${req.clerkUserId || 'unknown'}_${uuidv4()}${ext}`;
    cb(null, safe);
  },
});

const videoFilter = (req, file, cb) => {
  const allowed = ['video/webm', 'video/mp4', 'video/ogg', 'application/octet-stream'];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|mp4|ogg|mov)$/i)) {
    cb(null, true);
  } else {
    cb(new Error(`INVALID_VIDEO_TYPE: ${file.mimetype} is not allowed.`));
  }
};

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
    files: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a file safely. Used to clean up processing temp files.
 */
const deleteFile = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn('[Upload] Could not delete file:', filePath, err.message);
  }
};

/**
 * Multer error handler middleware.
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the size limit.',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message: err.message,
    });
  }
  if (err && err.message && err.message.startsWith('INVALID_')) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE_TYPE',
      message: err.message,
    });
  }
  next(err);
};

module.exports = {
  audioUpload,
  videoUpload,
  deleteFile,
  handleUploadError,
  AUDIO_DIR,
  VIDEO_DIR,
};
