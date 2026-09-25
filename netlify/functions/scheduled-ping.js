const { schedule } = require('@netlify/functions');
const { connectToDatabase } = require('./lib/mongodb');
const { isPostgresConfigured, pingPostgres } = require('./lib/postgres');
const { isMysqlConfigured, pingMysql } = require('./lib/mysql');
const { notifyPingSuccess } = require('./lib/telegramNotifier');

/**
 * Netlify Scheduled Function / Local Cron Handler:
 * pings MongoDB Atlas, PostgreSQL, and MySQL to keep all databases active.
 */
const scheduledPingHandler = async (event = {}, context = {}) => {
  console.log('⚡ Keep-Alive ping handler triggered...');
  const mongoDbName = process.env.MONGO_DB_NAME || 'system_reset';
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

    // 2. Ping MongoDB Atlas
    const mongoStart = Date.now();
    try {
      await db.command({ ping: 1 });
      const mongoLatency = Date.now() - mongoStart;

      await logsCol.insertOne({
        action: 'PING',
        target: 'MongoDB',
        status: 'SUCCESS',
        database: mongoDbName,
        responseTime: mongoLatency,
        source: 'SCHEDULED_CRON',
        createdAt: new Date(),
      });

      pingResults.push({
        target: 'MongoDB',
        status: 'SUCCESS',
        database: mongoDbName,
        responseTime: mongoLatency,
      });
      console.log(`✅ MongoDB Ping Success: ${mongoLatency}ms`);
    } catch (mongoErr) {
      const mongoLatency = Date.now() - mongoStart;
      console.error('❌ MongoDB Ping Failed:', mongoErr.message);

      await logsCol.insertOne({
        action: 'PING',
        target: 'MongoDB',
        status: 'FAILED',
        database: mongoDbName,
        responseTime: mongoLatency,
        source: 'SCHEDULED_CRON',
        error: mongoErr.message,
        createdAt: new Date(),
      });

      pingResults.push({
        target: 'MongoDB',
        status: 'FAILED',
        database: mongoDbName,
        responseTime: mongoLatency,
        error: mongoErr.message,
      });
    }

    // 3. Ping PostgreSQL (if configured in .env)
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
          source: 'SCHEDULED_CRON',
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'PostgreSQL',
          status: 'SUCCESS',
          database: pgRes.database,
          responseTime: pgRes.responseTime,
        });
        console.log(`✅ PostgreSQL Ping Success: ${pgRes.responseTime}ms`);
      } catch (pgErr) {
        const pgLatency = Date.now() - pgStart;
        console.error('❌ PostgreSQL Ping Failed:', pgErr.message);

        await logsCol.insertOne({
          action: 'PING',
          target: 'PostgreSQL',
          status: 'FAILED',
          database: process.env.postgresql_db || 'postgresql',
          responseTime: pgLatency,
          source: 'SCHEDULED_CRON',
          error: pgErr.message,
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'PostgreSQL',
          status: 'FAILED',
          database: process.env.postgresql_db || 'postgresql',
          responseTime: pgLatency,
          error: pgErr.message,
        });
      }
    }

    // 4. Ping MySQL (if configured in .env)
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
          source: 'SCHEDULED_CRON',
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'MySQL',
          status: 'SUCCESS',
          database: mysqlRes.database,
          responseTime: mysqlRes.responseTime,
        });
        console.log(`✅ MySQL Ping Success: ${mysqlRes.responseTime}ms`);
      } catch (mysqlErr) {
        const mysqlLatency = Date.now() - mysqlStart;
        console.error('❌ MySQL Ping Failed:', mysqlErr.message);

        await logsCol.insertOne({
          action: 'PING',
          target: 'MySQL',
          status: 'FAILED',
          database: process.env.mysql_db || process.env.MYSQL_DB || 'mysql',
          responseTime: mysqlLatency,
          source: 'SCHEDULED_CRON',
          error: mysqlErr.message,
          createdAt: new Date(),
        });

        pingResults.push({
          target: 'MySQL',
          status: 'FAILED',
          database: process.env.mysql_db || process.env.MYSQL_DB || 'mysql',
          responseTime: mysqlLatency,
          error: mysqlErr.message,
        });
      }
    }

    // 5. Send Telegram notification to subscribers
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
