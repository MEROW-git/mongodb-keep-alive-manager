const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

let cachedPool = null;

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
        console.error(`Failed to read MySQL CA certificate from ${candidate}:`, e.message);
      }
    }
  }

  return undefined;
}

function isMysqlConfigured() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
  const url = process.env.mysql_url || process.env.MYSQL_URL || process.env.MYSQL_URI;
  return Boolean(url && url.trim());
}

function getSslConfig(isLocal) {
  if (isLocal) return undefined;

  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });

  const ca = resolveCaCertificate();
  const rejectUnauthorizedEnv = process.env.MYSQL_SSL_REJECT_UNAUTHORIZED || process.env.DB_SSL_REJECT_UNAUTHORIZED;

  // If CA is available or explicitly set to true, enable strict verification
  const rejectUnauthorized = ca ? true : (rejectUnauthorizedEnv === 'true');

  if (!rejectUnauthorized) {
    console.warn('[SECURITY NOTICE] MySQL TLS is running with rejectUnauthorized: false. Provide a CA certificate (ca.pem) or set DB_SSL_REJECT_UNAUTHORIZED=true for strict verification.');
  }

  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized };
}

function getMysqlPool() {
  if (cachedPool) {
    return cachedPool;
  }

  const rawUrl = process.env.mysql_url || process.env.MYSQL_URL || process.env.MYSQL_URI;
  if (!rawUrl) {
    throw new Error('mysql_url is missing in environment variables');
  }

  let connectionString = rawUrl.trim();
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

  cachedPool = mysql.createPool({
    uri: connectionString,
    ssl: getSslConfig(isLocal),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 5000,
  });

  return cachedPool;
}

/**
 * Executes a lightweight ping query against MySQL and measures latency.
 */
async function pingMysql() {
  if (!isMysqlConfigured()) {
    return {
      configured: false,
      status: 'SKIPPED',
      message: 'MySQL is not configured',
    };
  }

  const defaultDbName = process.env.mysql_db || process.env.MYSQL_DB || 'mysql';
  let pool;
  try {
    pool = getMysqlPool();
  } catch (err) {
    cachedPool = null;
    throw err;
  }

  const pingStart = Date.now();

  try {
    // Use non-reserved alias ping_time (current_time is a reserved keyword in MySQL)
    const [rows] = await pool.query('SELECT NOW() AS ping_time, DATABASE() AS ping_db, 1 AS alive;');
    const responseTimeMs = Date.now() - pingStart;

    const row = rows && rows[0] ? rows[0] : {};
    return {
      configured: true,
      status: 'SUCCESS',
      database: row.ping_db || defaultDbName,
      responseTime: responseTimeMs,
      timestamp: row.ping_time || new Date().toISOString(),
    };
  } catch (err) {
    if (err.message && err.message.includes('certificate')) {
      cachedPool = null;
    }
    throw err;
  }
}

module.exports = {
  isMysqlConfigured,
  getMysqlPool,
  pingMysql,
  getSslConfig,
  resolveCaCertificate,
};
