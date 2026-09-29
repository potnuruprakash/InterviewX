const mongoose = require('mongoose');
const dns = require('dns');

// DNS server fallback for SRV resolution (fixes Windows/ISP local DNS SRV resolution issues)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS cannot be set
}

let isConnected = false;

const connectDB = async () => {
  // Use MONGODB_URI as primary, MONGO_URI as backward compatibility fallback
  let uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const localUri = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/adaptive-ai-interviewer';

  if (!uri || uri.trim() === '') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DB] No MongoDB URI configured. Falling back to local MongoDB: ${localUri}`);
      uri = localUri;
    } else {
      console.error('[DB] FATAL ERROR: No MongoDB URI configured.');
      console.error('[DB] MONGODB_URI environment variable is missing.');
      console.error('[DB] Please set MONGODB_URI in your .env file to a valid MongoDB Atlas connection string.');
      process.exit(1);
    }
  }

  // Check if URI still contains unpopulated placeholder like <db_password> or <password>
  const hasPlaceholder = uri && (uri.includes('<db_password>') || uri.includes('<password>'));
  if (hasPlaceholder) {
    console.warn('[DB] NOTICE: Your Atlas connection string still contains the placeholder ("<db_password>").');
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DB] Falling back to running local MongoDB instance (${localUri}) for local development.`);
      console.warn('[DB] To connect to MongoDB Atlas, replace <db_password> in backend/.env with your actual Atlas password.');
      uri = localUri;
    } else {
      console.error('[DB] FATAL ERROR: Replace <db_password> in your .env with your actual MongoDB Atlas password.');
      process.exit(1);
    }
  }

  // Prevent silent localhost fallback when Atlas is expected
  if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
    console.warn('[DB] WARNING: Connecting to local MongoDB. Ensure MONGODB_URI is set to MongoDB Atlas for cloud deployment.');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: true,
    });

    isConnected = true;

    // Extract safe cluster host without exposing credentials
    let displayHost = conn.connection.host;
    try {
      const match = uri.match(/@([^/?]+)/);
      if (match && match[1]) {
        displayHost = match[1];
      }
    } catch (_) {}

    const dbName = conn.connection.name;

    console.log('[DB] MongoDB connection active.');
    console.log(`[DB] MongoDB connected: ${displayHost}`);
    console.log(`[DB] Database name: ${dbName}`);

    return conn;
  } catch (error) {
    console.error(`[DB] MongoDB Connection failed: ${error.message}`);

    // If Atlas auth or network fails in development, try local MongoDB fallback
    if (process.env.NODE_ENV !== 'production' && !uri.includes('127.0.0.1') && !uri.includes('localhost')) {
      console.warn(`[DB] Attempting fallback to local MongoDB (${localUri})...`);
      try {
        const localConn = await mongoose.connect(localUri, {
          serverSelectionTimeoutMS: 4000,
          autoIndex: true,
        });
        isConnected = true;
        console.log(`[DB] Local MongoDB fallback connected successfully.`);
        console.log(`[DB] Database name: ${localConn.connection.name}`);
        return localConn;
      } catch (localErr) {
        console.error(`[DB] Local MongoDB fallback also failed: ${localErr.message}`);
      }
    }

    if (error.message.includes('bad auth') || error.message.includes('authentication failed')) {
      console.error('[DB] Authentication Failed: Please check your MongoDB Atlas password in backend/.env (ensure <db_password> is replaced with your real database password).');
    }
    if (error.message.includes('whitelist') || error.message.includes('Could not connect to any servers')) {
      console.error('[DB] Atlas IP Whitelist Notice: Please ensure your current IP is whitelisted in MongoDB Atlas Network Access (or set to 0.0.0.0/0).');
    }
    process.exit(1);
  }
};

// Lifecycle listeners
mongoose.connection.on('disconnected', () => {
  if (isConnected) {
    console.warn('[DB] MongoDB disconnected. Attempting reconnection...');
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('[DB] MongoDB reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
  console.error(`[DB] MongoDB error: ${err.message}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  try {
    console.log(`\n[Server] Received ${signal}. Closing MongoDB connection gracefully...`);
    await mongoose.connection.close(false);
    console.log('[DB] MongoDB connection closed safely.');
    process.exit(0);
  } catch (err) {
    console.error('[DB] Error during disconnection:', err.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;
