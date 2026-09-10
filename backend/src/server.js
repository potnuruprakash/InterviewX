require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    // Connect to MongoDB FIRST before accepting any requests
    await connectDB();

    app.listen(PORT, () => {
      console.log(`[Server] Adaptive AI Interviewer Backend running on port ${PORT}`);
      console.log(`[Server] Phase: 13 — Complete`);
      console.log(`[Server] Health: http://localhost:${PORT}/health`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

start();
