const { schedule } = require('@netlify/functions');
const { connectToDatabase, pingAllMongo } = require('./lib/mongodb');
const { pingAllPostgres } = require('./lib/postgres');
const { pingAllMysql } = require('./lib/mysql');
const { notifyPingSuccess } = require('./lib/telegramNotifier');

/**
 * Netlify Scheduled Function / Local Cron Handler:
 * pings all configured databases (up to 5 of each: MongoDB, PostgreSQL, MySQL) to keep them active.
 */
const scheduledPingHandler = async (event = {}, context = {}) => {
  console.log('⚡ Keep-Alive scheduled ping handler triggered...');

  const isNetlifyScheduled = event.type === 'schedule' || Boolean(context?.clientContext?.custom?.scheduled);
  if (!isNetlifyScheduled && event.httpMethod) {
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret =
      event.headers?.['x-cron-secret'] ||
      event.headers?.['X-Cron-Secret'] ||
      event.queryStringParameters?.key;

    if (!cronSecret || providedSecret !== cronSecret) {
      console.warn('[SECURITY] Rejected unauthenticated HTTP call to scheduled-ping');
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'error',
          message: 'Unauthorized: scheduled-ping cannot be invoked publicly without valid cron secret',
        }),
      };
    }
  }

  const pingResults = [];

  try {
    const { db } = await connectToDatabase();
    const logsCol = db.collection('logs');

    // 1. Check if keep-alive automation is enabled in settings
    const settingsCol = db.collection('settings');
    const settings = await settingsCol.findOne({});
    if (settings && settings.enabled === false) {
      console.log('⏸️ Database Keep Alive is currently disabled in settings. Skipping ping.');
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'skipped', reason: 'Automation disabled in settings' }),
      };
    }

    // 2. Ping all configured databases
    const [mongoResults, pgResults, mysqlResults] = await Promise.all([
      pingAllMongo(),
      pingAllPostgres(),
      pingAllMysql(),
    ]);

    const allPingRuns = [...mongoResults, ...pgResults, ...mysqlResults];

    for (const res of allPingRuns) {
      await logsCol.insertOne({
        action: 'PING',
        target: res.target,
        status: res.status,
        database: res.database,
        responseTime: res.responseTime,
        error: res.error || null,
        source: 'SCHEDULED_CRON',
        createdAt: new Date(),
      });

      pingResults.push(res);
      console.log(`${res.status === 'SUCCESS' ? '✅' : '❌'} ${res.target} (${res.database}) Ping: ${res.responseTime}ms [${res.status}]`);
    }

    // 3. Send Telegram notification to subscribers
    notifyPingSuccess({
      results: pingResults,
      source: 'SCHEDULED_CRON',
    }).catch((e) => console.error('Telegram notification error:', e.message));

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        results: pingResults,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('❌ Keep-Alive Ping Handler Critical Error:', error.message);
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
exports.scheduledPingHandler = scheduledPingHandler;
