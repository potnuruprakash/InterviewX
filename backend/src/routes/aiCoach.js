const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { chatAttachmentUpload } = require('../config/multer');
const {
  getProfile,
  getProgress,
  createSession,
  getSessions,
  getSession,
  postMessage,
  handleQuickAction,
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  postConversationMessage,
  uploadAttachment,
  rateMessageFeedback,
} = require('../controllers/aiCoachController');

// All AI Coach routes require authenticated user session
router.use(requireAuth);

// Candidate Training Profile & Historical Mastery
router.get('/profile', getProfile);
router.get('/progress', getProgress);

// Conversations API (ChatGPT-Style History & Context)
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);
router.post('/conversations/:id/messages', postConversationMessage);

// File Attachment Upload (📎)
router.post('/upload-attachment', chatAttachmentUpload.single('file'), uploadAttachment);

// Message Feedback (👍 👎)
router.post('/messages/:id/feedback', rateMessageFeedback);

// Training Sessions (Backward Compatibility & Active Drills)
router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.get('/sessions/:id', getSession);
router.post('/sessions/:id/messages', postMessage);
router.post('/sessions/:id/action', handleQuickAction);

module.exports = router;
