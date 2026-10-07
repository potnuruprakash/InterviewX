/**
 * AI Service HTTP Client - Phase 2/6 Optimization
 *
 * Typed interface for the Python FastAPI AI service with:
 *   - Per-operation timeouts (text=15s, audio=60s, video=120s)
 *   - Smart retry logic: only 502/503/504, never 400/413/422
 *   - Jitter in retry delays to avoid thundering herd
 *   - Graceful degradation with structured fallback objects
 *
 * Endpoints:
 *   GET  /health                   - Fast liveness probe
 *   GET  /ready                    - Model readiness probe
 *   POST /api/ai/text-evaluate     - SBERT semantic evaluation (Phase 4)
 *   POST /api/ai/audio-analyze     - MFCC + audio analysis (Phase 5)
 *   POST /api/ai/video-analyze     - YOLOv8 video analysis (Phase 6)
 */

'use strict';

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || '120000', 10);
const AI_SERVICE_SECRET_KEY = process.env.AI_SERVICE_SECRET_KEY;

if (!AI_SERVICE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.error('[AI Service] CRITICAL: AI_SERVICE_SECRET_KEY is not defined in environment variables.');
}

// Shared headers builder
const getAuthHeaders = () => (
  AI_SERVICE_SECRET_KEY ? { 'x-internal-service-key': AI_SERVICE_SECRET_KEY } : {}
);

// Per-operation timeout constants
const TIMEOUTS = {
  TEXT: 15000,   // SBERT is fast once loaded: 3-8s typical
  AUDIO: 60000,  // Librosa can be slow on cold start
  VIDEO: 120000, // YOLOv8 + MediaPipe over many frames
  HEALTH: 5000,
};

// Non-retryable HTTP status codes (client errors - no point retrying)
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 413, 422]);

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
      console.warn(`[AI Service] ${opName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms: ${err.message}`);
      await sleep(delay, jitter);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────

const checkHealth = async () => {
  try {
    const res = await axios.get(`${AI_SERVICE_URL}/health`, {
      headers: getAuthHeaders(),
      timeout: TIMEOUTS.HEALTH,
    });
    return res.data;
  } catch (err) {
    console.warn('[AI Service] Health check failed:', err.message);
    return { status: 'unavailable', message: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 - SBERT TEXT EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a text answer using SBERT semantic similarity.
 *
 * @param {string} question          - The interview question
 * @param {string} answer            - The candidate's answer
 * @param {string[]} expectedConcepts - Concepts expected in a good answer
 * @returns {Object} { semanticScore, conceptCoverage, textScore, feedback, ... }
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
    console.warn('[AI Service] Text evaluation failed:', err.message);
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
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5 - AUDIO ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze an audio file for MFCC and speech features.
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
      { maxAttempts: 2, retryDelayMs: 3000, jitter: 1000, operationName: 'AUDIO_ANALYZE' }
    );
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Audio analysis failed:', err.message);
    return {
      audioFeaturesAvailable: false,
      modelStatus: 'ai_service_unavailable',
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 - VIDEO ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a video file using YOLOv8 + MediaPipe frame extraction.
 *
 * Retries up to 3 times for MODEL_WARMING_UP (503) responses.
 * Does not retry for client errors (400, 413, 422).
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
      () => axios.post(`${AI_SERVICE_URL}/api/ai/video-analyze`, form, {
        headers: { ...form.getHeaders(), ...getAuthHeaders() },
        timeout: TIMEOUTS.VIDEO,
      }),
      { maxAttempts: 3, retryDelayMs: 4000, jitter: 2000, operationName: 'VIDEO_ANALYZE' }
    );

    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Video analysis failed:', err.message);
    return {
      framesProcessed: 0,
      personDetectionRatio: null,
      modelStatus: 'ai_service_unavailable',
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 - MULTIMODAL EVALUATION (optional AI-side fusion)
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
    console.warn('[AI Service] Multimodal evaluation failed:', err.message);
    return { modelStatus: 'ai_service_unavailable', error: err.message };
  }
};

// Legacy alias for backward compatibility
const analyzeText = evaluateText;

module.exports = {
  checkHealth,
  evaluateText,
  analyzeAudio,
  analyzeVideo,
  evaluateMultimodal,
  analyzeText, // legacy
};
