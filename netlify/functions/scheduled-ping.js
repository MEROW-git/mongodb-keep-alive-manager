const { schedule } = require('@netlify/functions');
const { connectToDatabase, pingAllMongo } = require('./lib/mongodb');
const { pingAllPostgres } = require('./lib/postgres');
const { pingAllMysql } = require('./lib/mysql');
const { notifyPingSuccess } = require('./lib/telegramNotifier');

function getScheduleDecision(settings, latestLog, nowMs = Date.now()) {
  const parsedInterval = Number(settings?.interval);
  const intervalMinutes = Number.isFinite(parsedInterval) && parsedInterval > 0
    ? Math.min(1440, Math.max(1, Math.floor(parsedInterval)))
    : 5;
  const intervalMs = intervalMinutes * 60 * 1000;
  const lastRunMs = latestLog?.createdAt ? new Date(latestLog.createdAt).getTime() : 0;
  const elapsedMs = lastRunMs > 0 ? nowMs - lastRunMs : Number.POSITIVE_INFINITY;

  return {
    due: elapsedMs >= intervalMs,
    intervalMinutes,
    nextRunAt: lastRunMs > 0 ? new Date(lastRunMs + intervalMs).toISOString() : null,
  };
}

/**
 * Netlify Scheduled Function / Local Cron Handler:
 * writes to all configured databases (up to 5 of each: MongoDB, PostgreSQL, MySQL) to keep them active.
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

    // Netlify wakes this function every minute. The saved setting controls
    // whether this invocation is due, so intervals can change without a deploy.
    const latestLog = await logsCol.findOne({}, { sort: { createdAt: -1 } });
    const scheduleDecision = getScheduleDecision(settings, latestLog);
    if (!scheduleDecision.due) {
      console.log(`⏭️ Next heartbeat is not due yet (interval: ${scheduleDecision.intervalMinutes}m).`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'skipped',
          reason: 'Configured interval has not elapsed',
          intervalMinutes: scheduleDecision.intervalMinutes,
          nextRunAt: scheduleDecision.nextRunAt,
        }),
      };
    }

    // 2. Write a heartbeat to every configured database
    const [mongoResults, pgResults, mysqlResults] = await Promise.all([
      pingAllMongo(),
      pingAllPostgres(),
      pingAllMysql(),
    ]);

    const allPingRuns = [...mongoResults, ...pgResults, ...mysqlResults];

    for (const res of allPingRuns) {
      await logsCol.insertOne({
        action: 'HEARTBEAT',
        target: res.target,
        status: res.status,
        database: res.database,
        responseTime: res.responseTime,
        error: res.error || null,
        source: 'SCHEDULED_CRON',
        createdAt: new Date(),
      });

      pingResults.push(res);
      console.log(`${res.status === 'SUCCESS' ? '✅' : '❌'} ${res.target} (${res.database}) Heartbeat: ${res.responseTime}ms [${res.status}]`);
    }

    // 3. Send Telegram notification to subscribers
    await notifyPingSuccess({
      results: pingResults,
      source: 'SCHEDULED_CRON',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        results: pingResults,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('❌ Keep-Alive Heartbeat Handler Critical Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'error',
        error: error.message,
      }),
    };
  }
};

// Wake every minute; getScheduleDecision enforces the administrator's interval.
exports.handler = schedule('* * * * *', scheduledPingHandler);
exports.scheduledPingHandler = scheduledPingHandler;
exports.getScheduleDecision = getScheduleDecision;
