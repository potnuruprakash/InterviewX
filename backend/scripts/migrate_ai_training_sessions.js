/**
 * Non-Destructive Migration Script: AI Training Sessions -> Unified AI Conversations
 *
 * Converts legacy AITrainingSession and AITrainingMessage documents into
 * AIConversation (contextType: 'training') and AIMessage records.
 *
 * Preserves all original data in AITrainingSession and AITrainingMessage for backward compatibility.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node backend/scripts/migrate_ai_training_sessions.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const AITrainingSession = require('../src/models/AITrainingSession');
const AITrainingMessage = require('../src/models/AITrainingMessage');
const AIConversation = require('../src/models/AIConversation');
const AIMessage = require('../src/models/AIMessage');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/adaptive-ai-interviewer';

async function runMigration() {
  console.log('====================================================');
  console.log('Starting Non-Destructive AI Chat Data Migration');
  console.log('Connecting to MongoDB at:', MONGO_URI.replace(/\/\/.*@/, '//<redacted>@'));
  console.log('====================================================');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database successfully.');

    const sessions = await AITrainingSession.find({}).lean();
    console.log(`Found ${sessions.length} legacy AITrainingSession documents.`);

    let sessionsMigrated = 0;
    let messagesMigrated = 0;
    let sessionsSkipped = 0;

    for (const session of sessions) {
      // Idempotency check: check if already migrated
      const existingConv = await AIConversation.findOne({
        clerkUserId: session.clerkUserId,
        title: session.title || session.topic || 'Training Drill',
        contextType: 'training',
        createdAt: session.createdAt,
      });

      if (existingConv) {
        sessionsSkipped += 1;
        continue;
      }

      // Create unified AIConversation
      const conv = await AIConversation.create({
        clerkUserId: session.clerkUserId,
        title: session.title || session.topic || 'Training Drill',
        contextType: 'training',
        topic: session.topic || 'Technical Practice',
        difficulty: session.difficulty || 'Intermediate',
        status: session.status === 'archived' ? 'archived' : 'active',
        lastMessagePreview: '',
        createdAt: session.createdAt || new Date(),
        updatedAt: session.updatedAt || new Date(),
      });

      // Migrate messages for this session
      const messages = await AITrainingMessage.find({ sessionId: session._id }).sort({ createdAt: 1 }).lean();

      for (const msg of messages) {
        await AIMessage.create({
          conversationId: conv._id,
          clerkUserId: session.clerkUserId,
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content || '',
          metadata: msg.metadata || {},
          feedback: msg.feedback || null,
          createdAt: msg.createdAt || new Date(),
          updatedAt: msg.updatedAt || new Date(),
        });
        messagesMigrated += 1;
      }

      // Update preview with last message if available
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        await AIConversation.updateOne(
          { _id: conv._id },
          { lastMessagePreview: (lastMsg.content || '').slice(0, 100) }
        );
      }

      sessionsMigrated += 1;
    }

    console.log('====================================================');
    console.log('MIGRATION SUMMARY:');
    console.log(`  Legacy Sessions Found:    ${sessions.length}`);
    console.log(`  New Conversations Created: ${sessionsMigrated}`);
    console.log(`  Messages Migrated:        ${messagesMigrated}`);
    console.log(`  Sessions Skipped (Exist):  ${sessionsSkipped}`);
    console.log('  Original Collections:     PRESERVED 100% (No data deleted)');
    console.log('====================================================');
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
