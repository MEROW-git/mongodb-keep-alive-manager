const { connectToDatabase } = require('./lib/mongodb');
const { jsonResponse, verifyToken, CORS_HEADERS } = require('./lib/auth');

function maskMongoUri(uri) {
  if (!uri) return 'Not configured';
  try {
    // Mask password inside mongodb+srv://username:password@cluster...
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/, '$1••••••••$3');
  } catch (e) {
    return 'mongodb+srv://••••••••@cluster';
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

  const rawUri = process.env.MONGO_URI || '';
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

      return jsonResponse(200, {
        status: 'success',
        settings: {
          enabled: !!settings.enabled,
          interval: settings.interval || 5,
          updatedAt: settings.updatedAt || new Date().toISOString(),
        },
        database: {
          name: dbName,
          collection: collectionName,
          maskedUri: maskMongoUri(rawUri),
          connectionStatus: 'Connected',
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
      if (typeof body.interval === 'number' || !isNaN(parseInt(body.interval, 10))) {
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
          enabled: !!updatedSettings.enabled,
          interval: updatedSettings.interval,
          updatedAt: updatedSettings.updatedAt,
        },
      });
    }

    return jsonResponse(405, { status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Settings function error:', error);
    return jsonResponse(500, {
      status: 'error',
      message: 'Failed to manage settings',
      details: error.message,
    });
  }
};
