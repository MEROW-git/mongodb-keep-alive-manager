const { schedule } = require('@netlify/functions');
const { connectToDatabase } = require('./lib/mongodb');
const { notifyPingSuccess } = require('./lib/telegramNotifier');

/**
 * Netlify Scheduled Function: runs automatically every 5 minutes
 * to ping MongoDB Atlas and keep the cluster active.
 */
const scheduledPingHandler = async (event, context) => {
  console.log('⏰ Netlify Scheduled Function triggered for MongoDB Keep Alive...');
  const startTime = Date.now();
  const dbName = process.env.MONGO_DB_NAME || 'system_reset';

  try {
    const { db } = await connectToDatabase();

    // Check if keep-alive automation is enabled in settings
    const settingsCol = db.collection('settings');
    const settings = await settingsCol.findOne({});
    if (settings && settings.enabled === false) {
      console.log('⏸️ MongoDB Keep Alive is currently disabled in settings. Skipping ping.');
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'skipped', reason: 'Automation disabled in settings' }),
      };
    }

    const pingStart = Date.now();
    const pingResult = await db.command({ ping: 1 });
    const responseTimeMs = Date.now() - pingStart;

    // Record success log in MongoDB
    const logsCol = db.collection('logs');
    await logsCol.insertOne({
      action: 'PING',
      status: 'SUCCESS',
      responseTime: responseTimeMs,
      source: 'NETLIFY_SCHEDULED_CRON',
      createdAt: new Date(),
    });

    // Notify approved subscribers
    notifyPingSuccess({
      latencyMs: responseTimeMs,
      dbName,
      source: 'NETLIFY_SCHEDULED_CRON',
    }).catch((e) => console.error('Scheduled cron telegram notification error:', e.message));

    console.log(`✅ Scheduled Ping Success: ${responseTimeMs}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        database: dbName,
        responseTime: `${responseTimeMs}ms`,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error('❌ Scheduled Ping Failed:', error.message);

    try {
      const { db } = await connectToDatabase();
      const logsCol = db.collection('logs');
      await logsCol.insertOne({
        action: 'PING',
        status: 'FAILED',
        responseTime: responseTimeMs,
        source: 'NETLIFY_SCHEDULED_CRON',
        error: error.message,
        createdAt: new Date(),
      });
    } catch (e) {
      console.error('Failed to log scheduled ping failure:', e);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'error',
        error: error.message,
      }),
    };
  }
};

// Schedule every 5 minutes (standard Netlify cron expression)
exports.handler = schedule('*/5 * * * *', scheduledPingHandler);
