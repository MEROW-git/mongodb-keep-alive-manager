const { MongoClient } = require('mongodb');
require('dotenv').config();

let cachedClient = null;
let cachedDb = null;

/**
 * Reusable MongoDB Connection Pool for Netlify Serverless Functions.
 * Caches the connection across warm function invocations.
 */
async function connectToDatabase() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME || 'system_reset';

  if (!uri) {
    throw new Error('MONGO_URI is missing in environment variables');
  }

  if (cachedClient && cachedDb) {
    try {
      // Test if cached connection is alive
      await cachedDb.command({ ping: 1 });
      return { client: cachedClient, db: cachedDb };
    } catch (e) {
      console.warn('Cached MongoDB connection stale, reconnecting...', e.message);
      cachedClient = null;
      cachedDb = null;
    }
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await client.connect();
  cachedClient = client;
  cachedDb = client.db(dbName);

  return { client: cachedClient, db: cachedDb };
}

module.exports = {
  connectToDatabase,
};
