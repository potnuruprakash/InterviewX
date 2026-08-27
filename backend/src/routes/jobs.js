const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  createJob,
  getUserJobs,
  getJob,
  analyzeJob,
  getJobAnalysis,
} = require('../controllers/jobController');

router.use(requireAuth);

router.post('/', createJob);
router.get('/', getUserJobs);
router.get('/:id', getJob);

// Phase 2 — Analysis routes
router.post('/:id/analyze', analyzeJob);
router.get('/:id/analysis', getJobAnalysis);

module.exports = router;
