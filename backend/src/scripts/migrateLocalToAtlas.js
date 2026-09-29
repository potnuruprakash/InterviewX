require('dotenv').config();
const { MongoClient } = require('mongodb');
const dns = require('dns');

// DNS server fallback for Atlas SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const LOCAL_URI = process.env.LOCAL_MONGO_URI || 'mongodb://localhost:27017/adaptive-ai-interviewer';
const ATLAS_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const COLLECTIONS_TO_MIGRATE = [
  'users',
  'resumes',
  'jobdescriptions',
  'skillanalyses',
  'interviews',
  'questions',
  'responses',
  'trainingsessions',
  'aiconversations',
  'progresses',
];

async function migrateData() {
  console.log('====================================================');
  console.log('  InterviewX: Local to MongoDB Atlas Data Migration  ');
  console.log('====================================================\n');

  if (!ATLAS_URI || (!ATLAS_URI.includes('mongodb+srv://') && !ATLAS_URI.includes('.mongodb.net'))) {
    console.error('ERROR: MONGODB_URI must be configured with a valid MongoDB Atlas connection string.');
    process.exit(1);
  }

  let localClient, atlasClient;

  try {
    console.log('[1/4] Connecting to Local MongoDB...');
    localClient = new MongoClient(LOCAL_URI, { serverSelectionTimeoutMS: 5000 });
    await localClient.connect();
    console.log('✓ Connected to Local MongoDB\n');

    console.log('[2/4] Connecting to MongoDB Atlas...');
    atlasClient = new MongoClient(ATLAS_URI, { serverSelectionTimeoutMS: 8000 });
    await atlasClient.connect();
    console.log('✓ Connected to MongoDB Atlas\n');

    const localDb = localClient.db();
    const atlasDb = atlasClient.db();

    // Discover collections in local DB
    const localCollectionList = await localDb.listCollections().toArray();
    const localCollectionNames = localCollectionList.map(c => c.name);

    console.log(`[3/4] Migrating collections to Atlas (Safe Upsert Mode)...`);
    console.log('Found local collections:', localCollectionNames.join(', '));
    console.log('----------------------------------------------------');

    const results = [];

    for (const collName of localCollectionNames) {
      if (collName.startsWith('system.')) continue;

      const localColl = localDb.collection(collName);
      const atlasColl = atlasDb.collection(collName);

      const localCount = await localColl.countDocuments();
      if (localCount === 0) {
        results.push({ collection: collName, local: 0, atlas: 0, status: 'SKIPPED (Empty)' });
        continue;
      }

      console.log(`Migrating '${collName}' (${localCount} documents)...`);
      
      const cursor = localColl.find({});
      const BATCH_SIZE = 250;
      let batch = [];
      let migrated = 0;

      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        batch.push({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true,
          },
        });

        if (batch.length >= BATCH_SIZE) {
          await atlasColl.bulkWrite(batch, { ordered: false });
          migrated += batch.length;
          process.stdout.write(`  Upserted ${migrated}/${localCount}...\r`);
          batch = [];
        }
      }

      if (batch.length > 0) {
        await atlasColl.bulkWrite(batch, { ordered: false });
        migrated += batch.length;
      }

      const atlasCount = await atlasColl.countDocuments();
      const match = localCount <= atlasCount; // Atlas may already have or equal count
      results.push({
        collection: collName,
        local: localCount,
        atlas: atlasCount,
        status: match ? 'MATCH' : 'MISMATCH',
      });
      console.log(`  ✓ Finished '${collName}': Local=${localCount}, Atlas=${atlasCount}`);
    }

    console.log('\n[4/4] Migration Summary:');
    console.log('====================================================');
    console.table(results);
    console.log('====================================================');
    console.log('Data migration completed successfully! Local data was preserved intact.');

  } catch (err) {
    console.error('\nMigration Failed:', err.message);
    if (err.message.includes('whitelist') || err.message.includes('Could not connect to any servers')) {
      console.error('\n--> Atlas IP Whitelist Notice: Please ensure your current IP address (or 0.0.0.0/0) is whitelisted in MongoDB Atlas Network Access.');
    }
    process.exit(1);
  } finally {
    if (localClient) await localClient.close();
    if (atlasClient) await atlasClient.close();
  }
}

migrateData();
