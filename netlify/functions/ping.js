const { connectToDatabase } = require('./lib/mongodb');
const { isPostgresConfigured, pingPostgres } = require('./lib/postgres');
const { isMysqlConfigured, pingMysql } = require('./lib/mysql');
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

  // Security check: Allow execution only if:
  // 1. Invoked by Netlify scheduled event or background runner
  // 2. Valid JWT user token provided (logged-in admin)
  // 3. Valid CRON_SECRET provided via query param (?key=...) or header (x-cron-secret)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const decoded = verifyToken(authHeader);

  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    event.queryStringParameters?.key ||
    event.headers['x-cron-secret'] ||
    event.headers['X-Cron-Secret'];

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

    // 1. Ping MongoDB
    const mongoStart = Date.now();
    try {
      const pingResult = await db.command({ ping: 1 });
      const mongoLatency = Date.now() - mongoStart;

      await logsCol.insertOne({
        action: 'PING',
        target: 'MongoDB',
        status: 'SUCCESS',
        database: mongoDbName,
        responseTime: mongoLatency,
        source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
        createdAt: new Date(),
      });

      pingResults.push({
        target: 'MongoDB',
        status: 'SUCCESS',
        database: mongoDbName,
        responseTime: mongoLatency,
        pingResult,
      });
    } catch (mongoErr) {
      const mongoLatency = Date.now() - mongoStart;
      console.error('MongoDB Ping operation failed:', mongoErr.message);

      await logsCol.insertOne({
        action: 'PING',
        target: 'MongoDB',
        status: 'FAILED',
        database: mongoDbName,
        responseTime: mongoLatency,
        error: mongoErr.message || 'Database ping error',
        source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
        createdAt: new Date(),
      });

      pingResults.push({
        target: 'MongoDB',
        status: 'FAILED',
        database: mongoDbName,
        responseTime: mongoLatency,
        error: 'Ping operation failed',
      });
    }

    // 2. Ping PostgreSQL (if configured)
    if (isPostgresConfigured()) {
      const pgStart = Date.now();
      try {
        const pgRes = await pingPostgres();
        await logsCol.insertOne({
          action: 'PING',
          target: 'PostgreSQL',
          status: 'SUCCESS',
          database: pgRes.database,
          responseTime: pgRes.responseTime,
          source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'PostgreSQL',
          status: 'SUCCESS',
          database: pgRes.database,
          responseTime: pgRes.responseTime,
        });
      } catch (pgErr) {
        const pgLatency = Date.now() - pgStart;
        console.error('PostgreSQL Ping operation failed:', pgErr.message);

        await logsCol.insertOne({
          action: 'PING',
          target: 'PostgreSQL',
          status: 'FAILED',
          database: process.env.postgresql_db || 'postgresql',
          responseTime: pgLatency,
          error: pgErr.message || 'PostgreSQL ping error',
          source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'PostgreSQL',
          status: 'FAILED',
          database: process.env.postgresql_db || 'postgresql',
          responseTime: pgLatency,
          error: 'PostgreSQL ping error',
        });
      }
    }

    // 3. Ping MySQL (if configured)
    if (isMysqlConfigured()) {
      const mysqlStart = Date.now();
      try {
        const mysqlRes = await pingMysql();
        await logsCol.insertOne({
          action: 'PING',
          target: 'MySQL',
          status: 'SUCCESS',
          database: mysqlRes.database,
          responseTime: mysqlRes.responseTime,
          source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'MySQL',
          status: 'SUCCESS',
          database: mysqlRes.database,
          responseTime: mysqlRes.responseTime,
        });
      } catch (mysqlErr) {
        const mysqlLatency = Date.now() - mysqlStart;
        console.error('MySQL Ping operation failed:', mysqlErr.message);

        await logsCol.insertOne({
          action: 'PING',
          target: 'MySQL',
          status: 'FAILED',
          database: process.env.mysql_db || process.env.MYSQL_DB || 'mysql',
          responseTime: mysqlLatency,
          error: mysqlErr.message || 'MySQL ping error',
          source: isNetlifyScheduled ? 'SCHEDULED_CRON' : 'DASHBOARD_PULSE',
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'MySQL',
          status: 'FAILED',
          database: process.env.mysql_db || process.env.MYSQL_DB || 'mysql',
          responseTime: mysqlLatency,
          error: 'MySQL ping error',
        });
      }
    }

    // 4. Broadcast keep-alive notification to approved Telegram subscribers
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
      message: 'Keep-alive ping execution failed',
      timestamp: new Date().toISOString(),
    });
  }
};
