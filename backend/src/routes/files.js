const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getResumeFile, getAudioFile, getVideoFile } = require('../controllers/fileController');

// All file access requires verified Clerk session
router.use(requireAuth);

router.get('/resume/:id', getResumeFile);
router.get('/audio/:id', getAudioFile);
router.get('/video/:id', getVideoFile);

module.exports = router;
