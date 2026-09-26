const { connectToDatabase, getMongoConfigs } = require('./lib/mongodb');
const { getPostgresConfigs } = require('./lib/postgres');
const { getMysqlConfigs } = require('./lib/mysql');
const { jsonResponse, verifyToken, CORS_HEADERS } = require('./lib/auth');

function maskUri(uri) {
  if (!uri) return 'Not configured';
  try {
    const hasSrv = uri.startsWith('mongodb+srv://');
    let parseable = uri;
    if (hasSrv) {
      parseable = uri.replace(/^mongodb+srv:\/\//, 'http://');
    } else if (uri.startsWith('mongodb://')) {
      parseable = uri.replace(/^mongodb:\/\//, 'http://');
    } else if (uri.startsWith('postgres://') || uri.startsWith('postgresql://')) {
      parseable = uri.replace(/^postgres(ql)?:\/\//, 'http://');
    } else if (uri.startsWith('mysql://')) {
      parseable = uri.replace(/^mysql:\/\//, 'http://');
    }
    const parsed = new URL(parseable);
    const host = parsed.host || 'cluster.database.net';
    const proto = hasSrv ? 'mongodb+srv' : uri.split('://')[0];
    return `${proto}://••••••••:••••••••@${host}`;
  } catch (e) {
    return '••••••••:••••••••@cluster';
  }
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

  const rawUri = process.env.MONGO_URI || process.env.MONGO_URI1 || '';
  const dbName = process.env.MONGO_DB_NAME || 'system_reset';
  const collectionName = process.env.WEBADMIN_COLLECTION || 'sysreset';

  try {
    const { db } = await connectToDatabase();
    const settingsCol = db.collection('settings');

    // GET: Retrieve current settings and database metadata
    if (event.httpMethod === 'GET') {
      let settings = await settingsCol.findOne({});
      if (!settings) {
        settings = { enabled: true, interval: 5 };
        await settingsCol.insertOne({ ...settings, updatedAt: new Date() });
      }

      const mongoConfigs = getMongoConfigs();
      const postgresConfigs = getPostgresConfigs();
      const mysqlConfigs = getMysqlConfigs();

      const allDatabases = [
        ...mongoConfigs.map((c) => ({
          type: 'MongoDB',
          badge: 'Atlas',
          index: c.index,
          label: c.label,
          dbName: c.dbName,
          maskedUri: maskUri(c.uri),
          isPrimary: c.isPrimary,
        })),
        ...postgresConfigs.map((c) => ({
          type: 'PostgreSQL',
          badge: 'Aiven',
          index: c.index,
          label: c.label,
          dbName: c.dbName,
          maskedUri: maskUri(c.url),
        })),
        ...mysqlConfigs.map((c) => ({
          type: 'MySQL',
          badge: 'Aiven',
          index: c.index,
          label: c.label,
          dbName: c.dbName,
          maskedUri: maskUri(c.url),
        })),
      ];

      return jsonResponse(200, {
        status: 'success',
        settings: {
          enabled: Boolean(settings.enabled),
          interval: settings.interval || 5,
          updatedAt: settings.updatedAt || new Date().toISOString(),
        },
        database: {
          name: dbName,
          collection: collectionName,
          maskedUri: maskUri(rawUri),
          connectionStatus: 'Connected',
          allDatabases,
          mongoList: mongoConfigs.map((c) => ({ index: c.index, label: c.label, dbName: c.dbName, maskedUri: maskUri(c.uri) })),
          postgresList: postgresConfigs.map((c) => ({ index: c.index, label: c.label, dbName: c.dbName, maskedUri: maskUri(c.url) })),
          mysqlList: mysqlConfigs.map((c) => ({ index: c.index, label: c.label, dbName: c.dbName, maskedUri: maskUri(c.url) })),
        },
      });
    }

    // POST / PUT: Update settings
    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, { status: 'error', message: 'Malformed JSON payload' });
      }

      const updates = {};
      if (typeof body.enabled === 'boolean') {
        updates.enabled = body.enabled;
      }
      if (typeof body.interval === 'number' || (typeof body.interval === 'string' && !isNaN(parseInt(body.interval, 10)))) {
        const intervalNum = Math.max(1, Math.min(1440, parseInt(body.interval, 10)));
        updates.interval = intervalNum;
      }
      updates.updatedAt = new Date();

      await settingsCol.updateOne(
        {},
        { $set: updates },
        { upsert: true }
      );

      const updatedSettings = await settingsCol.findOne({});

      return jsonResponse(200, {
        status: 'success',
        message: 'Settings updated successfully',
        settings: {
          enabled: Boolean(updatedSettings.enabled),
          interval: updatedSettings.interval,
          updatedAt: updatedSettings.updatedAt,
        },
      });
    }

    return jsonResponse(405, { status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Settings function error:', error.message);
    return jsonResponse(500, {
      status: 'error',
      message: 'Failed to manage settings',
    });
  }
};
