/**
 * AI Service HTTP Client — Split Workloads Architecture
 *
 * Routes requests across two independent Render AI services:
 *   1. Core AI Service (AI_SERVICE_URL):
 *      - POST /api/ai/text-evaluate     (SBERT semantic evaluation)
 *      - POST /api/ai/audio-analyze     (Librosa MFCC feature extraction)
 *      - POST /api/ai/multimodal-evaluate (Multimodal score fusion)
 *      - GET  /health, GET /ready       (Core service liveness and readiness)
 *
 *   2. Video AI Service (VIDEO_AI_SERVICE_URL):
 *      - POST /api/ai/video-analyze     (YOLOv8 + MediaPipe video analysis)
 *      - GET  /api/ai/video-model-info  (Video model capabilities and audit)
 *      - GET  /health, GET /ready       (Video service liveness and readiness)
 *
 * Security & Reliability:
 *   - Shared internal secret: AI_SERVICE_SECRET_KEY sent via x-internal-service-key header
 *   - Configurable per-operation timeouts
 *   - No automatic retries for expensive media jobs (avoids duplicate processing)
 *   - Structured, actionable errors with sanitization (never leaks internal URLs or secrets)
 *   - Genuine scoring only — never fabricates fallback scores
 */

'use strict';

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const VIDEO_AI_SERVICE_URL = process.env.VIDEO_AI_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_SECRET_KEY = process.env.AI_SERVICE_SECRET_KEY;

if (!AI_SERVICE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.error('[AI Service] CRITICAL: AI_SERVICE_SECRET_KEY is not defined in environment variables.');
}

// Shared headers builder
const getAuthHeaders = () => (
  AI_SERVICE_SECRET_KEY ? { 'x-internal-service-key': AI_SERVICE_SECRET_KEY } : {}
);

// Configurable per-operation timeouts (in milliseconds)
const TIMEOUTS = {
  TEXT: parseInt(process.env.AI_SERVICE_TEXT_TIMEOUT || process.env.AI_SERVICE_TIMEOUT || '15000', 10),
  AUDIO: parseInt(process.env.AI_SERVICE_AUDIO_TIMEOUT || process.env.AI_SERVICE_TIMEOUT || '60000', 10),
  VIDEO: parseInt(process.env.VIDEO_AI_SERVICE_TIMEOUT || process.env.AI_SERVICE_TIMEOUT || '120000', 10),
  HEALTH: parseInt(process.env.AI_SERVICE_HEALTH_TIMEOUT || '5000', 10),
};

// Non-retryable HTTP status codes (client errors - no point retrying)
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 413, 422]);

/**
 * Sanitize error message to prevent leaking internal network addresses, ports, or secrets.
 */
const sanitizeErrorMessage = (message) => {
  if (!message || typeof message !== 'string') return 'AI service request failed';
  let sanitized = message;
  if (AI_SERVICE_URL) {
    sanitized = sanitized.split(AI_SERVICE_URL).join('[CORE_AI_SERVICE]');
  }
  if (VIDEO_AI_SERVICE_URL) {
    sanitized = sanitized.split(VIDEO_AI_SERVICE_URL).join('[VIDEO_AI_SERVICE]');
  }
  if (AI_SERVICE_SECRET_KEY) {
    sanitized = sanitized.split(AI_SERVICE_SECRET_KEY).join('[REDACTED_SECRET]');
  }
  return sanitized;
};

/**
 * Sleep with optional jitter.
 */
const sleep = (ms, jitter = 0) =>
  new Promise((r) => setTimeout(r, ms + Math.floor(Math.random() * jitter)));

/**
 * Generic AI service request with retry for transient server errors.
 *
 * @param {Function} requestFn - Async function that returns axios response
 * @param {Object} opts        - { maxAttempts, retryDelayMs, jitter, operationName }
 */
const withRetry = async (requestFn, opts = {}) => {
  const maxAttempts = opts.maxAttempts || 2;
  const retryDelayMs = opts.retryDelayMs || 3000;
  const jitter = opts.jitter || 1000;
  const opName = opts.operationName || 'AI_REQUEST';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await requestFn();
      return result;
    } catch (err) {
      const status = err?.response?.status;
      const isRetryable = !status || !NON_RETRYABLE_STATUSES.has(status);
      const isLastAttempt = attempt >= maxAttempts;

      if (!isRetryable || isLastAttempt) {
        throw err;
      }

      const delay = retryDelayMs * attempt;
      console.warn(`[AI Service] ${opName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms: ${sanitizeErrorMessage(err.message)}`);
      await sleep(delay, jitter);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH & READINESS PROBES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check health of the Core AI service (SBERT, Audio, Fusion).
 */
const checkCoreHealth = async () => {
  try {
    const res = await axios.get(`${AI_SERVICE_URL}/health`, {
      headers: getAuthHeaders(),
      timeout: TIMEOUTS.HEALTH,
    });
    return { ...res.data, service: 'core' };
  } catch (err) {
    console.warn('[AI Service] Core health check failed:', sanitizeErrorMessage(err.message));
    return {
      status: 'unavailable',
      service: 'core',
      error: sanitizeErrorMessage(err.message),
    };
  }
};

/**
 * Check health of the Video AI service (YOLO, MediaPipe).
 */
const checkVideoHealth = async () => {
  try {
    const res = await axios.get(`${VIDEO_AI_SERVICE_URL}/health`, {
      headers: getAuthHeaders(),
      timeout: TIMEOUTS.HEALTH,
    });
    return { ...res.data, service: 'video' };
  } catch (err) {
    console.warn('[AI Service] Video health check failed:', sanitizeErrorMessage(err.message));
    return {
      status: 'unavailable',
      service: 'video',
      error: sanitizeErrorMessage(err.message),
    };
  }
};

/**
 * Overall health check — probes both Core and Video services concurrently.
 * Maintains complete backward compatibility for backend app.js and tests.
 */
const checkHealth = async () => {
  const [coreResult, videoResult] = await Promise.all([
    checkCoreHealth(),
    checkVideoHealth(),
  ]);

  const coreOk = coreResult?.status === 'ok' || coreResult?.status === 'healthy';
  const videoOk = videoResult?.status === 'ok' || videoResult?.status === 'healthy';

  let status = 'unavailable';
  if (coreOk && videoOk) {
    status = 'ok';
  } else if (coreOk || videoOk) {
    status = 'degraded';
  }

  return {
    status,
    core: coreResult,
    video: videoResult,
    services: {
      core: coreResult.status || 'unavailable',
      video: videoResult.status || 'unavailable',
    },
    // Expose root model dictionaries for backward compatibility
    models: {
      ...(coreResult.models || {}),
      ...(videoResult.models || {}),
    },
  };
};

/**
 * Check readiness of Core and Video models.
 */
const checkReady = async () => {
  const [coreRes, videoRes] = await Promise.allSettled([
    axios.get(`${AI_SERVICE_URL}/ready`, { headers: getAuthHeaders(), timeout: TIMEOUTS.HEALTH }),
    axios.get(`${VIDEO_AI_SERVICE_URL}/ready`, { headers: getAuthHeaders(), timeout: TIMEOUTS.HEALTH }),
  ]);

  const coreReady = coreRes.status === 'fulfilled' && coreRes.value.data?.ready;
  const videoReady = videoRes.status === 'fulfilled' && videoRes.value.data?.ready;

  return {
    status: (coreReady && videoReady) ? 'ready' : (coreReady || videoReady ? 'partial' : 'loading'),
    ready: coreReady && videoReady,
    core: coreRes.status === 'fulfilled' ? coreRes.value.data : { ready: false, error: sanitizeErrorMessage(coreRes.reason?.message) },
    video: videoRes.status === 'fulfilled' ? videoRes.value.data : { ready: false, error: sanitizeErrorMessage(videoRes.reason?.message) },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE AI SERVICE — SBERT TEXT EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a text answer using SBERT semantic similarity on the Core AI service.
 *
 * @param {string} question          - The interview question
 * @param {string} answer            - The candidate's answer
 * @param {string[]} expectedConcepts - Concepts expected in a good answer
 * @returns {Object} Evaluation metrics object
 */
const evaluateText = async (question, answer, expectedConcepts = []) => {
  try {
    const res = await withRetry(
      () => axios.post(
        `${AI_SERVICE_URL}/api/ai/text-evaluate`,
        { question, answer, expectedConcepts },
        {
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          timeout: TIMEOUTS.TEXT,
        }
      ),
      { maxAttempts: 2, retryDelayMs: 2000, operationName: 'TEXT_EVALUATE' }
    );
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Text evaluation failed on Core service:', sanitizeErrorMessage(err.message));
    return {
      semanticScore: null,
      conceptCoverage: null,
      textScore: null,
      feedback: null,
      strengths: [],
      missingConcepts: [],
      improvementSuggestion: null,
      confidence: null,
      modelStatus: 'ai_service_unavailable',
      error: sanitizeErrorMessage(err.message),
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE AI SERVICE — AUDIO ANALYSIS (Librosa MFCC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze an audio file for speech delivery and MFCC features on the Core AI service.
 *
 * @param {string} audioFilePath - Absolute path to the audio file
 * @returns {Object} Audio analysis result
 */
const analyzeAudio = async (audioFilePath) => {
  try {
    if (!fs.existsSync(audioFilePath)) {
      return { modelStatus: 'file_not_found', audioFeaturesAvailable: false };
    }

    const form = new FormData();
    form.append('audio', fs.createReadStream(audioFilePath), {
      filename: path.basename(audioFilePath),
      contentType: 'audio/webm',
    });

    const res = await withRetry(
      () => axios.post(`${AI_SERVICE_URL}/api/ai/audio-analyze`, form, {
        headers: { ...form.getHeaders(), ...getAuthHeaders() },
        timeout: TIMEOUTS.AUDIO,
      }),
      // Do not auto-retry heavy media jobs: avoids duplicating CPU load if service is busy
      { maxAttempts: 1, retryDelayMs: 3000, jitter: 1000, operationName: 'AUDIO_ANALYZE' }
    );
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Audio analysis failed on Core service:', sanitizeErrorMessage(err.message));
    return {
      audioFeaturesAvailable: false,
      modelStatus: 'ai_service_unavailable',
      error: sanitizeErrorMessage(err.message),
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO AI SERVICE — VIDEO ANALYSIS (YOLOv8 + MediaPipe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a video file using YOLOv8 + MediaPipe on the dedicated Video AI service.
 *
 * @param {string} videoFilePath - Absolute path to the video file
 * @returns {Object} Video analysis result
 */
const analyzeVideo = async (videoFilePath) => {
  if (!fs.existsSync(videoFilePath)) {
    return { modelStatus: 'file_not_found', framesProcessed: 0 };
  }

  try {
    const form = new FormData();
    form.append('video', fs.createReadStream(videoFilePath), {
      filename: path.basename(videoFilePath),
      contentType: 'application/octet-stream',
    });

    const res = await withRetry(
      () => axios.post(`${VIDEO_AI_SERVICE_URL}/api/ai/video-analyze`, form, {
        headers: { ...form.getHeaders(), ...getAuthHeaders() },
        timeout: TIMEOUTS.VIDEO,
      }),
      // Avoid duplicate inference on timeout or transient drop: never replay heavy video processing automatically
      { maxAttempts: 1, retryDelayMs: 4000, jitter: 2000, operationName: 'VIDEO_ANALYZE' }
    );

    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Video analysis failed on Video service:', sanitizeErrorMessage(err.message));
    return {
      framesProcessed: 0,
      personDetectionRatio: null,
      modelStatus: 'ai_service_unavailable',
      error: sanitizeErrorMessage(err.message),
    };
  }
};

/**
 * Fetch video model capabilities and audit specifications from Video AI service.
 */
const getVideoModelInfo = async () => {
  try {
    const res = await axios.get(`${VIDEO_AI_SERVICE_URL}/api/ai/video-model-info`, {
      headers: getAuthHeaders(),
      timeout: TIMEOUTS.HEALTH,
    });
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Video model info fetch failed:', sanitizeErrorMessage(err.message));
    return { error: sanitizeErrorMessage(err.message), modelStatus: 'unavailable' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE AI SERVICE — MULTIMODAL EVALUATION (Optional fusion)
// ─────────────────────────────────────────────────────────────────────────────

const evaluateMultimodal = async (textScore, audioResult, videoResult) => {
  try {
    const res = await axios.post(
      `${AI_SERVICE_URL}/api/ai/multimodal-evaluate`,
      { textScore, audioResult, videoResult },
      {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        timeout: TIMEOUTS.TEXT,
      }
    );
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Multimodal evaluation failed on Core service:', sanitizeErrorMessage(err.message));
    return { modelStatus: 'ai_service_unavailable', error: sanitizeErrorMessage(err.message) };
  }
};

// Legacy alias for backward compatibility
const analyzeText = evaluateText;

module.exports = {
  checkHealth,
  checkCoreHealth,
  checkVideoHealth,
  checkReady,
  evaluateText,
  analyzeAudio,
  analyzeVideo,
  getVideoModelInfo,
  evaluateMultimodal,
  analyzeText, // legacy
  // Export URLs and timeouts for testing verification
  _config: {
    AI_SERVICE_URL,
    VIDEO_AI_SERVICE_URL,
    TIMEOUTS,
  },
};
