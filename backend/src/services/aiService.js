/**
 * AI Service HTTP Client
 *
 * Provides a typed interface for communicating with the Python FastAPI AI service.
 *
 * Endpoints:
 *   GET  /health                  — Health check
 *   POST /api/ai/text-evaluate    — SBERT semantic evaluation (Phase 4)
 *   POST /api/ai/audio-analyze    — MFCC + audio analysis (Phase 5)
 *   POST /api/ai/video-analyze    — YOLOv8 video analysis (Phase 6)
 *   POST /api/ai/multimodal-evaluate — Fusion (Phase 7)
 *
 * Flow: React → Express → FastAPI → AI models → Express → MongoDB → React
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || '60000', 10);

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_SERVICE_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────

const checkHealth = async () => {
  try {
    const res = await aiClient.get('/health');
    return res.data;
  } catch (err) {
    console.warn('[AI Service] Health check failed:', err.message);
    return { status: 'unavailable', phase: 0, message: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — SBERT TEXT EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a text answer using SBERT semantic similarity.
 *
 * @param {string} question - The interview question
 * @param {string} answer   - The candidate's answer
 * @param {string[]} expectedConcepts - Concepts expected in a good answer
 * @returns {Object} { semanticScore, conceptCoverage, textScore, feedback, strengths, missingConcepts, confidence, modelStatus }
 */
const evaluateText = async (question, answer, expectedConcepts = []) => {
  try {
    const res = await aiClient.post('/api/ai/text-evaluate', {
      question,
      answer,
      expectedConcepts,
    });
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
// PHASE 5 — AUDIO ANALYSIS
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
      contentType: 'audio/wav',
    });

    const res = await axios.post(`${AI_SERVICE_URL}/api/ai/audio-analyze`, form, {
      headers: { ...form.getHeaders() },
      timeout: AI_SERVICE_TIMEOUT,
    });
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
// PHASE 6 — VIDEO ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a video file using YOLOv8 frame extraction.
 *
 * @param {string} videoFilePath - Absolute path to the video file
 * @returns {Object} Video analysis result
 */
const analyzeVideo = async (videoFilePath) => {
  try {
    if (!fs.existsSync(videoFilePath)) {
      return { modelStatus: 'file_not_found', framesProcessed: 0 };
    }

    const form = new FormData();
    form.append('video', fs.createReadStream(videoFilePath), {
      filename: path.basename(videoFilePath),
      contentType: 'video/webm',
    });

    const res = await axios.post(`${AI_SERVICE_URL}/api/ai/video-analyze`, form, {
      headers: { ...form.getHeaders() },
      timeout: AI_SERVICE_TIMEOUT,
    });
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
// PHASE 7 — MULTIMODAL EVALUATION (AI-side fusion, optional)
// ─────────────────────────────────────────────────────────────────────────────

const evaluateMultimodal = async (textScore, audioResult, videoResult) => {
  try {
    const res = await aiClient.post('/api/ai/multimodal-evaluate', {
      textScore,
      audioResult,
      videoResult,
    });
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('[AI Service] Multimodal evaluation failed:', err.message);
    return { modelStatus: 'ai_service_unavailable', error: err.message };
  }
};

// Legacy aliases for backward compatibility
const analyzeText = evaluateText;

module.exports = {
  checkHealth,
  evaluateText,
  analyzeAudio,
  analyzeVideo,
  evaluateMultimodal,
  analyzeText, // legacy
};
