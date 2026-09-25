const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function seed() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME || 'system_reset';
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!uri) {
    console.error('❌ Error: MONGO_URI is missing in .env');
    process.exit(1);
  }

  if (!adminUsername || !adminPassword) {
    console.error('❌ Error: ADMIN_USERNAME and ADMIN_PASSWORD must be configured in .env before running seed.');
    process.exit(1);
  }

  if (adminPassword === 'admin123456' || adminPassword === 'password' || adminPassword.length < 8) {
    console.error('❌ Error: Insecure ADMIN_PASSWORD detected. Please choose a strong password (minimum 8 characters) in .env.');
    process.exit(1);
  }

  console.log('📡 Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`✅ Connected to database: ${dbName}`);

    // 1. Ensure users collection & admin user
    const usersCol = db.collection('users');
    const existingUser = await usersCol.findOne({ username: adminUsername });

    if (!existingUser) {
      console.log(`Creating initial admin user: ${adminUsername}`);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      await usersCol.insertOne({
        username: adminUsername,
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
      });
      console.log('✅ Admin user created successfully.');
    } else {
      console.log(`ℹ️  Admin user "${adminUsername}" already exists.`);
    }

    // 2. Ensure settings collection
    const settingsCol = db.collection('settings');
    const existingSettings = await settingsCol.findOne({});

    if (!existingSettings) {
      console.log('Initializing default settings...');
      await settingsCol.insertOne({
        enabled: true,
        interval: 5,
        updatedAt: new Date(),
      });
      console.log('✅ Default settings initialized (Keep Alive: ON, Interval: 5m).');
    } else {
      console.log('ℹ️  Settings already exist.');
    }

    // 3. Ensure initial ping log
    const logsCol = db.collection('logs');
    const logsCount = await logsCol.countDocuments();
    if (logsCount === 0) {
      console.log('Creating initial ping log entry...');
      const pingStart = Date.now();
      await db.command({ ping: 1 });
      const pingDuration = Date.now() - pingStart;

      await logsCol.insertOne({
        action: 'PING',
        target: 'MongoDB',
        status: 'SUCCESS',
        responseTime: pingDuration,
        createdAt: new Date(),
      });
      console.log(`✅ Initial ping log stored (${pingDuration}ms).`);
    } else {
      console.log(`ℹ️  Existing logs found: ${logsCount} entries.`);
    }

    console.log('\n🎉 Database seeding completed successfully!\n');
    console.log(`Admin Username: ${adminUsername}`);
    console.log('Admin Password: [PROTECTED - stored as salted bcrypt hash]');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
