const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { audioUpload, videoUpload, handleUploadError } = require('../middleware/upload');
const {
  createInterview,
  getUserInterviews,
  getInterview,
  startInterview,
  getCurrentQuestion,
  submitResponse,
  submitAudioResponse,
  submitVideoResponse,
  completeInterview,
  getResults,
  getRoadmap,
} = require('../controllers/interviewController');

router.use(requireAuth);

// Core interview CRUD
router.post('/', createInterview);
router.get('/', getUserInterviews);
router.get('/:id', getInterview);

// Interview flow
router.post('/:id/start', startInterview);
router.get('/:id/questions/current', getCurrentQuestion);

// Response submission — text (Phase 4 SBERT), audio (Phase 5), video (Phase 6)
router.post('/:id/responses', submitResponse);
router.post('/:id/audio-response', audioUpload.single('audio'), handleUploadError, submitAudioResponse);
router.post('/:id/video-response', videoUpload.single('video'), handleUploadError, submitVideoResponse);

// Interview lifecycle
router.post('/:id/complete', completeInterview);

// Results + Roadmap (Phase 9, 10)
router.get('/:id/results', getResults);
router.get('/:id/roadmap', getRoadmap);

module.exports = router;
