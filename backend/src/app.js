const path = require('path');
if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { clerkAuth } = require('./middleware/auth');
const { globalErrorHandler } = require('./utils/errorHandler');

const mongoose = require('mongoose');

// Routes
const resumeRoutes = require('./routes/resume');
const jobRoutes = require('./routes/jobs');
const interviewRoutes = require('./routes/interviews');
const progressRoutes = require('./routes/progress');
const skillAnalysisRoutes = require('./routes/skillAnalysis');
const coachRoutes = require('./routes/coach');
const aiCoachRoutes = require('./routes/aiCoach');
const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');
const practiceRoutes = require('./routes/practice');

const app = express();


// CORS — must be registered before all other middleware, including helmet,
// so that pre-flight OPTIONS requests and error responses carry CORS headers.
//
// Environment variable: FRONTEND_URL
//   Set this on Render to the exact Vercel origin, e.g.:
//     https://interview-x-five.vercel.app
//   Multiple origins are supported as a comma-separated list:
//     https://interview-x-five.vercel.app,https://interview-o4wai632-prakash-1cc8.vercel.app

const normalizeOrigin = (url) => {
  if (!url || typeof url !== 'string') return '';
  return url
    .trim()
    .replace(/^["']|["']$/g, '') // strip quotes
    .replace(/\/+$/, '')          // strip trailing slashes
    .toLowerCase();              // normalize protocol & hostname case
};

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'https://interview-x-five.vercel.app',
  'https://interview-o4wai632-prakash-1cc8.vercel.app',
];

const getAllowedOrigins = () => {
  const envRaw = process.env.FRONTEND_URL || '';
  const envOrigins = envRaw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  return new Set([
    ...defaultAllowedOrigins.map(normalizeOrigin),
    ...envOrigins,
  ]);
};

// Log at startup so Render logs show exactly what is allowed
console.log('[CORS] Allowed origins:', Array.from(getAllowedOrigins()));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server, health checks)
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    const allowed = getAllowedOrigins();

    if (allowed.has(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: "${origin}" (normalized: "${normalizedOrigin}")`);
    return callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-dev-clerk-user-id',
    'x-test-clerk-user-id',
  ],
};

// Handle pre-flight OPTIONS for every route FIRST — before helmet or any auth
// path-to-regexp 8.x (Express 5) wildcard syntax: '{/*path}'
app.options('{/*path}', cors(corsOptions));

// Apply CORS to all other requests
app.use(cors(corsOptions));

// Security headers (after CORS so CORS headers are not overwritten)
app.use(helmet());


// Request logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 5000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
});
app.use('/api', globalLimiter);

// Upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, error: 'UPLOAD_RATE_LIMITED', message: 'Too many uploads. Please try again in an hour.' },
});
app.use('/api/resumes/upload', uploadLimiter);

// AI Service availability probe — runs at startup so Render logs reveal SBERT status immediately.
// Does NOT block startup; failures are logged as warnings only.
const { checkHealth: checkAiServiceHealth } = require('./services/aiService');
let aiServiceStatus = 'checking';
(async () => {
  try {
    const health = await checkAiServiceHealth();
    aiServiceStatus = health?.status === 'ok' || health?.status === 'healthy' ? 'available' : (health?.status || 'degraded');
    if (aiServiceStatus === 'available') {
      console.log('[AI Service] SBERT/AI service is reachable and healthy — production scoring active.');
    } else {
      console.warn('[AI Service] SBERT/AI service probe returned:', health);
      console.warn('[AI Service] Fallback keyword scoring will be used until AI service is available.');
    }
  } catch (err) {
    aiServiceStatus = 'unavailable';
    console.warn('[AI Service] Could not reach AI service at startup:', err.message);
    console.warn('[AI Service] Fallback keyword scoring active. Set AI_SERVICE_URL correctly if SBERT scoring is required in production.');
  }
})();

// Health check — no auth required
app.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  let queueStats = { video: { queued: 0, active: 0 }, audio: { queued: 0, active: 0 } };
  try {
    const { getQueueStats } = require('./services/asyncJobService');
    queueStats = getQueueStats();
  } catch (_) { /* service not yet initialized */ }

  res.json({
    success: true,
    service: 'InterviewX Backend',
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    aiService: aiServiceStatus,
    jobQueue: queueStats,
    timestamp: new Date().toISOString(),
  });
});

// Apply Clerk middleware globally for API routes
app.use(clerkAuth);

// API Routes
app.use('/api/resumes', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/skill-analysis', skillAnalysisRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/ai/coach', aiCoachRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/practice', practiceRoutes);

// 404 handler

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// Global error handler — must be last
app.use(globalErrorHandler);

module.exports = app;
