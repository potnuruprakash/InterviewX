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
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri || uri.trim() === '') {
    console.error('[DB] FATAL ERROR: No MongoDB URI configured.');
    console.error('[DB] MONGODB_URI environment variable is missing.');
    console.error('[DB] Please set MONGODB_URI in your .env file to a valid MongoDB Atlas connection string.');
    process.exit(1);
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
