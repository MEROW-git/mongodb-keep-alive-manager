const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });

// Connection pool cache by instance index (1..5)
const cachedClients = new Map();
const cachedDbs = new Map();

/**
 * Returns configuration objects for all configured MongoDB instances (up to 5).
 * Instance 1 defaults to MONGO_URI / MONGO_URI1, MONGO_DB_NAME / MONGO_DB_NAME1.
 * Instances 2..5 use MONGO_URI2..5, MONGO_DB_NAME2..5.
 */
function getMongoConfigs() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
  const configs = [];

  for (let i = 1; i <= 5; i++) {
    const uri = i === 1
      ? (process.env.MONGO_URI || process.env.MONGO_URI1)
      : process.env['MONGO_URI' + i];

    if (uri && uri.trim()) {
      const defaultDb = process.env.MONGO_DB_NAME || 'system_reset';
      const dbName = i === 1
        ? (process.env.MONGO_DB_NAME || process.env.MONGO_DB_NAME1 || defaultDb)
        : (process.env['MONGO_DB_NAME' + i] || defaultDb);

      configs.push({
        index: i,
        id: 'mongodb_' + i,
        uri: uri.trim(),
        dbName: (dbName || 'system_reset').trim(),
        isPrimary: i === 1,
      });
    }
  }

  const hasMultiple = configs.length > 1;
  return configs.map((c) => ({
    ...c,
    label: hasMultiple ? 'MongoDB ' + c.index : 'MongoDB',
  }));
}

function isMongoConfigured(index) {
  const configs = getMongoConfigs();
  if (index === undefined || index === null || index === 'any') {
    return configs.length > 0;
  }
  return configs.some((c) => c.index === index);
}

/**
 * Reusable MongoDB Connection for an instance index (1..5).
 * Defaults to primary instance (1).
 */
async function connectToMongoInstance(index = 1, testLiveness = true) {
  const configs = getMongoConfigs();
  const config = configs.find((c) => c.index === index);

  if (!config) {
    throw new Error('MongoDB instance ' + index + ' is not configured in environment variables');
  }

  const cachedClient = cachedClients.get(index);
  const cachedDb = cachedDbs.get(index);

  if (cachedClient && cachedDb) {
    if (!testLiveness) {
      return { client: cachedClient, db: cachedDb, config };
    }
    try {
      await cachedDb.command({ ping: 1 });
      return { client: cachedClient, db: cachedDb, config };
    } catch (e) {
      console.warn('Cached MongoDB [' + config.label + '] connection stale, reconnecting...', e.message);
      cachedClients.delete(index);
      cachedDbs.delete(index);
    }
  }

  const client = new MongoClient(config.uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(config.dbName);

  cachedClients.set(index, client);
  cachedDbs.set(index, db);

  return { client, db, config };
}

/**
 * Primary MongoDB connection used for dashboard state, logs, and settings.
 * Backward compatible with existing connectToDatabase() calls.
 */
async function connectToDatabase() {
  const { client, db } = await connectToMongoInstance(1, true);
  return { client, db };
}

/**
 * Pings a specific MongoDB instance and measures pure round-trip command latency.
 */
async function pingMongoInstance(index = 1) {
  const configs = getMongoConfigs();
  const config = configs.find((c) => c.index === index);

  if (!config) {
    return {
      index,
      target: 'MongoDB ' + index,
      configured: false,
      status: 'SKIPPED',
      message: 'MongoDB ' + index + ' is not configured',
    };
  }

  let dbInstance;
  try {
    const res = await connectToMongoInstance(index, false);
    dbInstance = res.db;
  } catch (err) {
    return {
      index: config.index,
      target: config.label,
      configured: true,
      status: 'FAILED',
      database: config.dbName,
      responseTime: 0,
      error: err.message || 'Database connection error',
      timestamp: new Date().toISOString(),
    };
  }

  const pingStart = Date.now();
  try {
    const pingResult = await dbInstance.command({ ping: 1 });
    const latency = Date.now() - pingStart;

    return {
      index: config.index,
      target: config.label,
      configured: true,
      status: 'SUCCESS',
      database: config.dbName,
      responseTime: latency,
      pingResult,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const latency = Date.now() - pingStart;
    console.error('MongoDB [' + config.label + '] Ping operation failed:', err.message);
    cachedClients.delete(index);
    cachedDbs.delete(index);
    return {
      index: config.index,
      target: config.label,
      configured: true,
      status: 'FAILED',
      database: config.dbName,
      responseTime: latency,
      error: err.message || 'Database ping error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Pings all configured MongoDB instances in parallel.
 */
async function pingAllMongo() {
  const configs = getMongoConfigs();
  if (configs.length === 0) return [];
  return Promise.all(configs.map((c) => pingMongoInstance(c.index)));
}

module.exports = {
  connectToDatabase,
  connectToMongoInstance,
  getMongoConfigs,
  isMongoConfigured,
  pingMongoInstance,
  pingAllMongo,
};
