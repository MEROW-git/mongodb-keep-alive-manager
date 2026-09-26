const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Pool cache per instance index (1..5)
const cachedPools = new Map();

function resolveCaCertificate() {
  const rootDir = path.resolve(__dirname, '../../../');
  const caPath = process.env.MYSQL_SSL_CA_PATH || process.env.DB_SSL_CA_PATH;
  const caCert = process.env.MYSQL_SSL_CA_CERT || process.env.DB_SSL_CA_CERT;

  if (caCert && caCert.trim()) {
    return caCert.trim();
  }

  const candidates = [
    caPath ? (path.isAbsolute(caPath) ? caPath : path.resolve(rootDir, caPath)) : null,
    caPath ? path.resolve(process.cwd(), caPath) : null,
    path.resolve(rootDir, 'ca.pem'),
    path.resolve(process.cwd(), 'ca.pem'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return fs.readFileSync(candidate, 'utf8');
      } catch (e) {
        console.error('Failed to read MySQL CA certificate from ' + candidate + ':', e.message);
      }
    }
  }

  return undefined;
}

function getSslConfig(isLocal) {
  if (isLocal) return undefined;

  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });

  const ca = resolveCaCertificate();
  const rejectUnauthorizedEnv = process.env.MYSQL_SSL_REJECT_UNAUTHORIZED || process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const rejectUnauthorized = ca ? true : (rejectUnauthorizedEnv === 'true');

  if (!rejectUnauthorized) {
    console.warn('[SECURITY NOTICE] MySQL TLS is running with rejectUnauthorized: false. Provide a CA certificate (ca.pem) or set DB_SSL_REJECT_UNAUTHORIZED=true for strict verification.');
  }

  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized };
}

/**
 * Returns configuration objects for all configured MySQL instances (up to 5).
 * Instance 1 defaults to mysql_url / MYSQL_URL / MYSQL_URI / mysql_url1.
 * Instances 2..5 use mysql_url2..5 / MYSQL_URL2..5 / MYSQL_URI2..5.
 */
function getMysqlConfigs() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
  const configs = [];

  for (let i = 1; i <= 5; i++) {
    const url = i === 1
      ? (process.env.mysql_url || process.env.MYSQL_URL || process.env.MYSQL_URI || process.env.mysql_url1 || process.env.MYSQL_URL1 || process.env.MYSQL_URI1)
      : (process.env['mysql_url' + i] || process.env['MYSQL_URL' + i] || process.env['MYSQL_URI' + i]);

    if (url && url.trim()) {
      const defaultDb = process.env.mysql_db || process.env.MYSQL_DB || 'mysql';
      const dbName = i === 1
        ? (process.env.mysql_db || process.env.MYSQL_DB || process.env.mysql_db1 || process.env.MYSQL_DB1 || defaultDb)
        : (process.env['mysql_db' + i] || process.env['MYSQL_DB' + i] || defaultDb);

      configs.push({
        index: i,
        id: 'mysql_' + i,
        url: url.trim(),
        dbName: (dbName || 'mysql').trim(),
      });
    }
  }

  const hasMultiple = configs.length > 1;
  return configs.map((c) => ({
    ...c,
    label: hasMultiple ? 'MySQL ' + c.index : 'MySQL',
  }));
}

function isMysqlConfigured(index) {
  const configs = getMysqlConfigs();
  if (index === undefined || index === null || index === 'any') {
    return configs.length > 0;
  }
  return configs.some((c) => c.index === index);
}

function getMysqlPool(index = 1) {
  if (cachedPools.has(index)) {
    return cachedPools.get(index);
  }

  const configs = getMysqlConfigs();
  const config = configs.find((c) => c.index === index);
  if (!config) {
    throw new Error('MySQL instance ' + index + ' is not configured in environment variables');
  }

  let connectionString = config.url.trim();
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  if (!isLocal) {
    try {
      const u = new URL(connectionString);
      u.searchParams.delete('sslmode');
      u.searchParams.delete('ssl-mode');
      connectionString = u.toString();
    } catch {
      // fallback
    }
  }

  const pool = mysql.createPool({
    uri: connectionString,
    ssl: getSslConfig(isLocal),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 5000,
  });

  cachedPools.set(index, pool);
  return pool;
}

/**
 * Executes a lightweight ping query against a MySQL instance (default index 1).
 */
async function pingMysql(index = 1) {
  const configs = getMysqlConfigs();
  const config = configs.find((c) => c.index === index);

  if (!config) {
    return {
      index,
      target: 'MySQL ' + index,
      configured: false,
      status: 'SKIPPED',
      message: 'MySQL ' + index + ' is not configured',
    };
  }

  let pool;
  try {
    pool = getMysqlPool(index);
  } catch (err) {
    cachedPools.delete(index);
    throw err;
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const pingStart = Date.now();
    const [rows] = await conn.query('SELECT NOW() AS ping_time, DATABASE() AS ping_db, 1 AS alive;');
    const responseTimeMs = Date.now() - pingStart;

    const row = rows && rows[0] ? rows[0] : {};
    return {
      index: config.index,
      target: config.label,
      configured: true,
      status: 'SUCCESS',
      database: row.ping_db || config.dbName,
      responseTime: responseTimeMs,
      timestamp: row.ping_time || new Date().toISOString(),
    };
  } catch (err) {
    if (err.message && err.message.includes('certificate')) {
      cachedPools.delete(index);
    }
    return {
      index: config.index,
      target: config.label,
      configured: true,
      status: 'FAILED',
      database: config.dbName,
      responseTime: 0,
      error: err.message || 'MySQL ping error',
      timestamp: new Date().toISOString(),
    };
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Pings all configured MySQL instances in parallel.
 */
async function pingAllMysql() {
  const configs = getMysqlConfigs();
  if (configs.length === 0) return [];
  return Promise.all(configs.map((c) => pingMysql(c.index)));
}

module.exports = {
  getMysqlConfigs,
  isMysqlConfigured,
  getMysqlPool,
  pingMysql,
  pingAllMysql,
  getSslConfig,
  resolveCaCertificate,
};
