const { connectToDatabase, pingAllMongo } = require('./lib/mongodb');
const { pingAllPostgres } = require('./lib/postgres');
const { pingAllMysql } = require('./lib/mysql');
const { jsonResponse, verifyToken, CORS_HEADERS } = require('./lib/auth');
const { notifyPingSuccess } = require('./lib/telegramNotifier');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const decoded = verifyToken(authHeader);

  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    event.headers['x-cron-secret'] ||
    event.headers['X-Cron-Secret'] ||
    (authHeader && cronSecret && authHeader === 'Bearer ' + cronSecret ? cronSecret : null) ||
    event.queryStringParameters?.key;

  const isNetlifyScheduled = event.type === 'schedule' || Boolean(context?.clientContext?.custom?.scheduled);
  const isAuthorizedCron = Boolean(cronSecret && providedSecret && providedSecret === cronSecret);
  const isAuthorizedUser = Boolean(decoded);

  if (!isNetlifyScheduled && !isAuthorizedUser && !isAuthorizedCron) {
    return jsonResponse(401, {
      status: 'error',
      message: 'Unauthorized: Valid JWT token or cron secret required to trigger keep-alive ping',
    });
  }

  const mongoDbName = process.env.MONGO_DB_NAME || 'system_reset';
  const pingResults = [];

  try {
    const { db } = await connectToDatabase();
    const logsCol = db.collection('logs');

    // Execute pings across all configured databases (up to 5 of each type)
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
        source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
        createdAt: new Date(),
      });

      pingResults.push(res);
    }

    // Broadcast keep-alive notification to approved Telegram subscribers
    notifyPingSuccess({
      results: pingResults,
      source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
    }).catch((e) => console.error('Auto notification error:', e.message));

    const nowIso = new Date().toISOString();
    const anyFailed = pingResults.some((r) => r.status === 'FAILED');

    // Construct primary response time summary string
    const responseTimeSummary = pingResults
      .map((r) => `${r.target}: ${r.responseTime}ms`)
      .join(' | ');

    return jsonResponse(anyFailed ? 207 : 200, {
      status: anyFailed ? 'partial' : 'success',
      database: mongoDbName,
      responseTime: responseTimeSummary,
      results: pingResults,
      timestamp: nowIso.split('T')[0],
      fullTimestamp: nowIso,
    });
  } catch (error) {
    console.error('Overall ping handler failed:', error.message);
    return jsonResponse(500, {
      status: 'error',
      message: 'Keep-alive ping execution failed: ' + error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
