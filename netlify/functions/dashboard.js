const { connectToDatabase, getMongoConfigs } = require('./lib/mongodb');
const { getPostgresConfigs } = require('./lib/postgres');
const { getMysqlConfigs } = require('./lib/mysql');
const { jsonResponse, verifyToken, CORS_HEADERS } = require('./lib/auth');

/**
 * Convert an internal database configuration into browser-safe metadata.
 * Keep this as an explicit allowlist so connection strings and future secret
 * fields cannot cross the API response boundary by accident.
 */
function toPublicDatabaseConfig(config) {
  return {
    index: config.index,
    id: config.id,
    label: config.label,
    dbName: config.dbName,
    ...(typeof config.isPrimary === 'boolean' ? { isPrimary: config.isPrimary } : {}),
  };
}

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

  const dbName = process.env.MONGO_DB_NAME || 'system_reset';
  const mainCollection = process.env.WEBADMIN_COLLECTION || 'sysreset';

  const mongoConfigs = getMongoConfigs();
  const postgresConfigs = getPostgresConfigs();
  const mysqlConfigs = getMysqlConfigs();

  const allDatabases = [
    ...mongoConfigs.map((c) => ({
      type: 'MongoDB',
      badge: 'Atlas',
      index: c.index,
      label: c.label,
      name: c.dbName,
      status: 'ONLINE',
      connection: 'Connected',
      isPrimary: c.isPrimary,
    })),
    ...postgresConfigs.map((c) => ({
      type: 'PostgreSQL',
      badge: 'Aiven',
      index: c.index,
      label: c.label,
      name: c.dbName,
      status: 'ONLINE',
      connection: 'Connected',
    })),
    ...mysqlConfigs.map((c) => ({
      type: 'MySQL',
      badge: 'Aiven',
      index: c.index,
      label: c.label,
      name: c.dbName,
      status: 'ONLINE',
      connection: 'Connected',
    })),
  ];

  try {
    const { db } = await connectToDatabase();

    // 1. Get settings
    const settingsCol = db.collection('settings');
    let settings = await settingsCol.findOne({});
    if (!settings) {
      settings = { enabled: true, interval: 5 };
      await settingsCol.insertOne({ ...settings, updatedAt: new Date() });
    }

    // 2. Fetch statistics from logs collection
    const logsCol = db.collection('logs');
    const [
      totalSuccessful,
      totalFailed,
      latestLog,
      recentLogs,
      recentPingsForChart,
      latestLogsPerTarget,
    ] = await Promise.all([
      logsCol.countDocuments({ status: 'SUCCESS' }),
      logsCol.countDocuments({ status: 'FAILED' }),
      logsCol.findOne({}, { sort: { createdAt: -1 } }),
      logsCol.find({}, { sort: { createdAt: -1 } }).limit(10).toArray(),
      logsCol.find({ status: 'SUCCESS' }, { sort: { createdAt: -1 } }).limit(20).toArray(),
      logsCol.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$target',
            latestLog: { $first: '$$ROOT' },
          },
        },
      ]).toArray(),
    ]);

    const targetLogMap = {};
    for (const item of (latestLogsPerTarget || [])) {
      if (item._id) targetLogMap[item._id] = item.latestLog;
    }

    const enrichedAllDatabases = allDatabases.map((d) => {
      const log = targetLogMap[d.label] || targetLogMap[d.type];
      return {
        ...d,
        responseTime: log ? `${log.responseTime || 0} ms` : null,
        responseTimeNum: log ? log.responseTime : 0,
        lastPing: log ? log.createdAt : null,
        status: log ? (log.status === 'SUCCESS' ? 'ONLINE' : 'FAILED') : 'ONLINE',
      };
    });

    // Format last ping time
    let lastPingFormatted = 'Never';
    let lastPingDate = null;
    let nextScheduledPingFormatted = '--:--';

    if (latestLog && latestLog.createdAt) {
      lastPingDate = new Date(latestLog.createdAt);
      lastPingFormatted = lastPingDate.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (settings.enabled) {
        const intervalMs = (settings.interval || 5) * 60 * 1000;
        const nextPingDate = new Date(lastPingDate.getTime() + intervalMs);
        nextScheduledPingFormatted = nextPingDate.toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: '2-digit',
        });
      }
    }

    // Chart 1: Latency history (in chronological order)
    const latencyHistory = recentPingsForChart
      .reverse()
      .map((item) => ({
        createdAt: item.createdAt,
        time: new Date(item.createdAt).toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: '2-digit',
        }),
        fullTime: new Date(item.createdAt).toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        }),
        latency: item.responseTime || 0,
        target: item.target || 'MongoDB',
      }));

    // Chart 2: Success vs Failed distribution
    const statusDistribution = [
      { name: 'Successful', value: totalSuccessful, color: '#00ED64' },
      { name: 'Failed', value: totalFailed, color: '#EF4444' },
    ];

    // Chart 3: Daily activity for the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyAggregation = await logsCol.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          successful: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    // Fill in any missing days among the 7 days
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const found = dailyAggregation.find((item) => item._id === dateKey);
      dailyActivity.push({
        date: dayLabel,
        successful: found ? found.successful : 0,
        failed: found ? found.failed : 0,
      });
    }

    // Format recent activity list with target database badge
    const formattedRecentActivity = recentLogs.map((log) => {
      const date = new Date(log.createdAt);
      const targetLabel = log.target || 'MongoDB';
      const defaultMsg = log.status === 'SUCCESS' ? `${targetLabel} ping completed` : `${targetLabel} ping failed`;

      return {
        id: log._id.toString(),
        target: targetLabel,
        database: log.database || dbName,
        time: date.toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: '2-digit',
        }),
        fullTimestamp: date.toISOString(),
        status: log.status,
        responseTime: `${log.responseTime || 0} ms`,
        message: log.status === 'SUCCESS' ? defaultMsg : `${targetLabel} ping check failed`,
      };
    });

    const latestResponseTime = latestLog ? `${latestLog.responseTime || 0} ms` : '0 ms';

    return jsonResponse(200, {
      status: 'success',
      databaseStatus: 'ONLINE',
      cluster: 'Production Database',
      database: {
        name: dbName,
        collection: mainCollection,
        connection: 'Connected',
        allDatabases: enrichedAllDatabases,
        mongoList: mongoConfigs.map(toPublicDatabaseConfig),
        postgresList: postgresConfigs.map(toPublicDatabaseConfig),
        mysqlList: mysqlConfigs.map(toPublicDatabaseConfig),
        postgres: postgresConfigs.length > 0
          ? {
              configured: true,
              name: postgresConfigs[0].dbName,
              status: 'ONLINE',
              connection: 'Connected',
            }
          : { configured: false },
        mysql: mysqlConfigs.length > 0
          ? {
              configured: true,
              name: mysqlConfigs[0].dbName,
              status: 'ONLINE',
              connection: 'Connected',
            }
          : { configured: false },
      },
      stats: {
        databaseStatus: 'ONLINE',
        lastPing: lastPingFormatted,
        lastPingFull: lastPingDate ? lastPingDate.toISOString() : null,
        responseTime: latestResponseTime,
        totalSuccessfulPing: totalSuccessful,
        totalFailedPing: totalFailed,
      },
      automation: {
        enabled: Boolean(settings.enabled),
        interval: settings.interval || 5,
        nextScheduledPing: nextScheduledPingFormatted,
      },
      recentActivity: formattedRecentActivity,
      charts: {
        latencyHistory,
        statusDistribution,
        dailyActivity,
      },
    });
  } catch (error) {
    console.error('Dashboard statistics error:', error.message);
    return jsonResponse(500, {
      status: 'error',
      message: 'Failed to retrieve dashboard statistics',
    });
  }
};

exports.toPublicDatabaseConfig = toPublicDatabaseConfig;
