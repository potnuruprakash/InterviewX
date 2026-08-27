const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { resumeUpload } = require('../config/multer');
const {
  uploadResume,
  getUserResumes,
  getResume,
  analyzeResumeController,
  getResumeAnalysis,
} = require('../controllers/resumeController');

// All routes require authentication
router.use(requireAuth);

router.post('/upload', resumeUpload.single('resume'), uploadResume);
router.get('/', getUserResumes);
router.get('/:id', getResume);

// Phase 2 — Analysis routes
router.post('/:id/analyze', analyzeResumeController);
router.get('/:id/analysis', getResumeAnalysis);

module.exports = router;
