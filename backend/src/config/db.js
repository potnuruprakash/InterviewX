const mongoose = require('mongoose');

let retryTimer = null;
let isInitialConnection = true;

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not defined in environment variables. Check your backend/.env file.');
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
    console.log(`[DB] Database name: ${conn.connection.name}`);
    isInitialConnection = false;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`);
    console.warn('[DB] Make sure MongoDB is running. Run start-mongodb.bat as Administrator, or use: net start MongoDB');
    console.warn(`[DB] Connection string used: ${process.env.MONGO_URI || process.env.MONGODB_URI || 'UNDEFINED'}`);

    // On the very first startup attempt, re-throw so server.js can exit cleanly
    if (isInitialConnection) {
      isInitialConnection = false;
      throw error;
    }

    // After initial connect, silently retry on disconnect
    if (!retryTimer) {
      console.warn('[DB] Retrying connection in 5 seconds...');
      retryTimer = setTimeout(connectDB, 5000);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected. Attempting to reconnect...');
  if (!retryTimer) {
    retryTimer = setTimeout(connectDB, 5000);
  }
});

mongoose.connection.on('connected', () => {
  console.log('[DB] MongoDB connection active.');
});

module.exports = connectDB;
