/**
 * Centralized error response formatter.
 * Never exposes internal stack traces.
 */

const sendError = (res, statusCode, errorCode, message, details = null) => {
  const body = {
    success: false,
    error: errorCode,
    message,
  };
  if (details && process.env.NODE_ENV === 'development') {
    body.details = details;
  }
  return res.status(statusCode).json(body);
};

const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
};

/**
 * Express global error handler middleware.
 */
const globalErrorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 413, 'FILE_TOO_LARGE', 'File exceeds the 10 MB size limit.');
  }
  if (err.message && err.message.startsWith('INVALID_FILE_TYPE')) {
    return sendError(res, 415, 'INVALID_FILE_TYPE', 'Only PDF and DOCX files are allowed.');
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, 400, 'VALIDATION_ERROR', err.message);
  }

  // Default
  return sendError(
    res,
    err.statusCode || 500,
    err.code || 'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : err.message
  );
};

module.exports = { sendError, sendSuccess, globalErrorHandler };
