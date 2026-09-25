const { MongoClient } = require('mongodb');
const { isPostgresConfigured, pingPostgres } = require('../netlify/functions/lib/postgres');
require('dotenv').config();

async function testMongo() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME || 'system_reset';
  console.log('\n========================================');
  console.log('🍃 Testing MongoDB Atlas Connection...');
  console.log('Database:', dbName);

  if (!uri) {
    console.error('❌ MONGO_URI is missing in .env');
    return;
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  try {
    const startTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ MongoDB connected successfully in ${connectTime}ms!`);

    const db = client.db(dbName);
    const pingStart = Date.now();
    const pingResult = await db.command({ ping: 1 });
    const pingTime = Date.now() - pingStart;

    console.log('Ping result:', pingResult);
    console.log(`Ping response time: ${pingTime}ms`);

    const collections = await db.listCollections().toArray();
    console.log('Existing collections:', collections.map((c) => c.name));
  } catch (err) {
    console.error('❌ MongoDB Connection failed:', err.message);
  } finally {
    await client.close();
  }
}

async function testPostgres() {
  console.log('\n========================================');
  console.log('🐘 Testing PostgreSQL Connection...');

  if (!isPostgresConfigured()) {
    console.log('⚠️ postgresql_url is not configured in .env (Skipped)');
    return;
  }

  console.log('Database target:', process.env.postgresql_db || 'postgresql');

  try {
    const res = await pingPostgres();
    console.log(`✅ PostgreSQL connected & pinged successfully!`);
    console.log(`Database: ${res.database}`);
    console.log(`Latency: ${res.responseTime}ms`);
    console.log(`Server Timestamp: ${res.timestamp}`);
  } catch (err) {
    console.error('❌ PostgreSQL Connection failed:', err.message);
  }
}

async function run() {
  await testMongo();
  await testPostgres();
  console.log('\n========================================\n');
  process.exit(0);
}

run();
