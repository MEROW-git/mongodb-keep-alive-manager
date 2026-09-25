const { connectToDatabase } = require('./lib/mongodb');
const { jsonResponse, verifyToken, CORS_HEADERS } = require('./lib/auth');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Security check: Allow execution if:
  // 1. Invoked by Netlify scheduled event or background runner
  // 2. Valid JWT user token provided
  // 3. Valid CRON_SECRET provided in query param (?key=...) or header (x-cron-secret)
  // 4. If CRON_SECRET is not configured or in dev, allow GET/POST ping
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const decoded = verifyToken(authHeader);

  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    event.queryStringParameters?.key ||
    event.headers['x-cron-secret'] ||
    event.headers['X-Cron-Secret'];

  const isNetlifyScheduled = event.type === 'schedule' || context?.clientContext?.custom?.scheduled;
  const isAuthorizedCron = cronSecret ? providedSecret === cronSecret : true;
  const isAuthorizedUser = !!decoded;

  if (!isNetlifyScheduled && !isAuthorizedUser && !isAuthorizedCron) {
    return jsonResponse(401, {
      status: 'error',
      message: 'Unauthorized: Valid JWT token or cron secret required to trigger ping',
    });
  }

  const dbName = process.env.MONGO_DB_NAME || 'system_reset';
  const startTime = Date.now();

  try {
    const { db } = await connectToDatabase();

    const pingStart = Date.now();
    const pingResult = await db.command({ ping: 1 });
    const responseTimeMs = Date.now() - pingStart;

    const logEntry = {
      action: 'PING',
      status: 'SUCCESS',
      responseTime: responseTimeMs,
      createdAt: new Date(),
    };

    // Save log entry to MongoDB logs collection
    const logsCol = db.collection('logs');
    await logsCol.insertOne(logEntry);

    const nowIso = new Date().toISOString();

    return jsonResponse(200, {
      status: 'success',
      database: dbName,
      responseTime: `${responseTimeMs}ms`,
      timestamp: nowIso.split('T')[0],
      fullTimestamp: nowIso,
      pingResult,
    });
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error('Ping operation failed:', error);

    try {
      const { db } = await connectToDatabase();
      const logsCol = db.collection('logs');
      await logsCol.insertOne({
        action: 'PING',
        status: 'FAILED',
        responseTime: responseTimeMs,
        error: error.message || 'Database ping error',
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.error('Failed to log ping error:', logErr);
    }

    return jsonResponse(500, {
      status: 'error',
      database: dbName,
      responseTime: `${responseTimeMs}ms`,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
