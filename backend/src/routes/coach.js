const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  sendMessage,
  getConversationState,
  resetConversation,
} = require('../controllers/coachController');

router.use(requireAuth);

router.post('/chat', sendMessage);
router.get('/state', getConversationState);
router.post('/reset', resetConversation);

module.exports = router;
