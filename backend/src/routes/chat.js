const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getDashboardSessions,
  createDashboardSession,
  getDashboardSession,
  deleteDashboardSession,
  postDashboardMessage,
  postDashboardRegenerate,
  getResultSessions,
  createResultSession,
  getResultSession,
  deleteResultSession,
  postResultMessage,
  postResultRegenerate,
} = require('../controllers/chatController');

// All chat routes require user authentication
router.use(requireAuth);

// ── Dashboard AI Routes ──────────────────────────────────────────────────────
router.get('/dashboard/sessions', getDashboardSessions);
router.post('/dashboard/sessions', createDashboardSession);
router.get('/dashboard/sessions/:id', getDashboardSession);
router.delete('/dashboard/sessions/:id', deleteDashboardSession);
router.post('/dashboard/sessions/:id/messages', postDashboardMessage);
router.post('/dashboard/sessions/:id/regenerate', postDashboardRegenerate);

// ── Results AI Routes (Scoped strictly per Interview Result) ─────────────────
router.get('/results/:resultId/sessions', getResultSessions);
router.post('/results/:resultId/sessions', createResultSession);
router.get('/results/:resultId/sessions/:sessionId', getResultSession);
router.delete('/results/:resultId/sessions/:sessionId', deleteResultSession);
router.post('/results/:resultId/sessions/:sessionId/messages', postResultMessage);
router.post('/results/:resultId/sessions/:sessionId/regenerate', postResultRegenerate);

module.exports = router;
