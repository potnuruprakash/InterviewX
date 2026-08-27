require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { clerkAuth } = require('./middleware/auth');
const { globalErrorHandler } = require('./utils/errorHandler');

// Routes
const resumeRoutes = require('./routes/resume');
const jobRoutes = require('./routes/jobs');
const interviewRoutes = require('./routes/interviews');
const progressRoutes = require('./routes/progress');
const skillAnalysisRoutes = require('./routes/skillAnalysis');

const app = express();

// Security headers
app.use(helmet());

// CORS — allow frontend origin
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS: Origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-dev-clerk-user-id'],
  })
);

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

// Health check — no auth required
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Adaptive AI Interviewer Backend',
    phase: 2,
    status: 'ok',
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
