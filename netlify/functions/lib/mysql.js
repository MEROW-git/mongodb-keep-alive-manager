const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let cachedPool = null;

function isMysqlConfigured() {
  const url = process.env.mysql_url || process.env.MYSQL_URL || process.env.MYSQL_URI;
  return Boolean(url && url.trim());
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

  let ssl = isLocal ? undefined : { rejectUnauthorized: false };
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
    ssl,
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
  const pool = getMysqlPool();
  const pingStart = Date.now();

  // Use backticks or non-reserved aliases (current_time is a reserved keyword in MySQL)
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
}

module.exports = {
  isMysqlConfigured,
  getMysqlPool,
  pingMysql,
};
