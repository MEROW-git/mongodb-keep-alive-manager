const { MongoClient } = require('mongodb');
require('dotenv').config();

async function test() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME || 'system_reset';
  console.log('Testing connection to MongoDB...');
  console.log('Database:', dbName);

  if (!uri) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  try {
    const startTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - startTime;
    console.log(`Connected successfully in ${connectTime}ms!`);

    const db = client.db(dbName);
    const pingStart = Date.now();
    const pingResult = await db.command({ ping: 1 });
    const pingTime = Date.now() - pingStart;

    console.log('Ping result:', pingResult);
    console.log(`Ping response time: ${pingTime}ms`);

    const collections = await db.listCollections().toArray();
    console.log('Existing collections:', collections.map(c => c.name));
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await client.close();
  }
}

test();
