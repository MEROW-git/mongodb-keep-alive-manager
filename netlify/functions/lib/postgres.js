const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

let cachedPool = null;

function isPostgresConfigured() {
  const url = process.env.postgresql_url || process.env.POSTGRESQL_URL;
  return Boolean(url && url.trim());
}

function getSslConfig(isLocal) {
  if (isLocal) return false;

  const caPath = process.env.PG_SSL_CA_PATH || process.env.DB_SSL_CA_PATH;
  const caCert = process.env.PG_SSL_CA_CERT || process.env.DB_SSL_CA_CERT;
  const rejectUnauthorizedEnv = process.env.PG_SSL_REJECT_UNAUTHORIZED || process.env.DB_SSL_REJECT_UNAUTHORIZED;

  let ca = undefined;
  if (caPath && fs.existsSync(caPath)) {
    try {
      ca = fs.readFileSync(caPath, 'utf8');
    } catch (e) {
      console.error(`Failed to read PostgreSQL CA certificate from ${caPath}:`, e.message);
    }
  } else if (caCert) {
    ca = caCert;
  }

  // If CA is provided, strictly enforce verification (true).
  // Otherwise, allow user to set DB_SSL_REJECT_UNAUTHORIZED=true or default with explicit notice.
  const rejectUnauthorized = ca ? true : (rejectUnauthorizedEnv === 'true');

  if (!rejectUnauthorized) {
    console.warn('[SECURITY NOTICE] PostgreSQL TLS is running with rejectUnauthorized: false. Provide a CA certificate via DB_SSL_CA_PATH or set DB_SSL_REJECT_UNAUTHORIZED=true for strict verification.');
  }

  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized };
}

function getPostgresPool() {
  if (cachedPool) {
    return cachedPool;
  }

  const rawUrl = process.env.postgresql_url || process.env.POSTGRESQL_URL;
  if (!rawUrl) {
    throw new Error('postgresql_url is missing in environment variables');
  }

  let connectionString = rawUrl.trim();
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  if (!isLocal) {
    try {
      const u = new URL(connectionString);
      u.searchParams.delete('sslmode');
      connectionString = u.toString();
    } catch {
      // fallback to raw
    }
  }

  cachedPool = new Pool({
    connectionString,
    ssl: getSslConfig(isLocal),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  cachedPool.on('error', (err) => {
    console.warn('Unexpected idle PostgreSQL client error:', err.message);
  });

  return cachedPool;
}

/**
 * Executes a lightweight ping query against PostgreSQL and measures latency.
 */
async function pingPostgres() {
  if (!isPostgresConfigured()) {
    return {
      configured: false,
      status: 'SKIPPED',
      message: 'PostgreSQL is not configured',
    };
  }

  const dbName = process.env.postgresql_db || process.env.POSTGRESQL_DB || 'postgresql';
  const pool = getPostgresPool();

  const client = await pool.connect();
  try {
    const pingStart = Date.now();
    const result = await client.query('SELECT NOW() as current_time, current_database() as current_db, 1 as alive;');
    const responseTimeMs = Date.now() - pingStart;

    const row = result.rows && result.rows[0] ? result.rows[0] : {};
    return {
      configured: true,
      status: 'SUCCESS',
      database: row.current_db || dbName,
      responseTime: responseTimeMs,
      timestamp: row.current_time || new Date().toISOString(),
    };
  } finally {
    client.release();
  }
}

module.exports = {
  isPostgresConfigured,
  getPostgresPool,
  pingPostgres,
  getSslConfig,
};
