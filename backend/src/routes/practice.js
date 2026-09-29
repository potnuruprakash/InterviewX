const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  createTopicPractice,
  createTargetedMock,
  submitAnswer,
  getPracticeSession,
  completePracticeSession,
} = require('../controllers/practiceController');

// All practice endpoints require verified authentication
router.use(requireAuth);

router.post('/topic', createTopicPractice);
router.post('/targeted', createTargetedMock);
router.post('/:id/answer', submitAnswer);
router.get('/:id', getPracticeSession);
router.post('/:id/complete', completePracticeSession);

module.exports = router;
