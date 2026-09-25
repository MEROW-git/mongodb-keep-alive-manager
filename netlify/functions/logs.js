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

  // Verify JWT token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const decoded = verifyToken(authHeader);
  if (!decoded) {
    return jsonResponse(401, {
      status: 'error',
      message: 'Unauthorized: Valid JWT required',
    });
  }

  try {
    const { db } = await connectToDatabase();
    const logsCol = db.collection('logs');

    // Handle DELETE: Clear logs (admin feature)
    if (event.httpMethod === 'DELETE') {
      const result = await logsCol.deleteMany({});
      return jsonResponse(200, {
        status: 'success',
        message: `Cleared ${result.deletedCount} log entries`,
      });
    }

    // Handle GET: Retrieve paginated logs
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const page = Math.max(1, parseInt(params.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 20));
      const statusFilter = params.status; // 'SUCCESS' | 'FAILED' | undefined

      const query = {};
      if (statusFilter && (statusFilter === 'SUCCESS' || statusFilter === 'FAILED')) {
        query.status = statusFilter;
      }

      const total = await logsCol.countDocuments(query);
      const totalPages = Math.ceil(total / limit) || 1;

      const rawLogs = await logsCol
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const formattedLogs = rawLogs.map((log) => ({
        id: log._id.toString(),
        action: log.action || 'PING',
        status: log.status,
        responseTime: log.responseTime !== undefined ? `${log.responseTime} ms` : '-',
        rawResponseTime: log.responseTime || 0,
        error: log.error || null,
        timestamp: new Date(log.createdAt).toISOString(),
        formattedTime: new Date(log.createdAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'medium',
          hour12: true,
        }),
      }));

      return jsonResponse(200, {
        status: 'success',
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    }

    return jsonResponse(405, { status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Logs function error:', error);
    return jsonResponse(500, {
      status: 'error',
      message: 'Failed to retrieve logs',
      details: error.message,
    });
  }
};
