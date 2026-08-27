const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getUserProgress } = require('../controllers/progressController');

router.use(requireAuth);

router.get('/', getUserProgress);

module.exports = router;
