const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  runSkillAnalysis,
  getSkillAnalysis,
  getUserSkillAnalyses,
  getAnalysisByContext,
} = require('../controllers/skillAnalysisController');

// All Phase 2 skill analysis routes require Clerk authentication
router.use(requireAuth);

// Run a new (or update existing) skill gap analysis
router.post('/', runSkillAnalysis);

// List all analyses for the authenticated user
router.get('/', getUserSkillAnalyses);

// Get analysis for a specific resume+JD combination (by query params)
router.get('/by-context', getAnalysisByContext);

// Get a specific analysis by ID
router.get('/:id', getSkillAnalysis);

module.exports = router;
