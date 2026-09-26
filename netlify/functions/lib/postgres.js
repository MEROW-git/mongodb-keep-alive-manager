const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Pool cache per instance index (1..5)
const cachedPools = new Map();

function resolveCaCertificate(index = 1) {
  const rootDir = path.resolve(__dirname, '../../../');
  const caPath = index === 1
    ? (process.env.PG_SSL_CA_PATH || process.env.DB_SSL_CA_PATH)
    : (process.env['PG_SSL_CA_PATH' + index] || process.env['DB_SSL_CA_PATH' + index]);
  const caCert = index === 1
    ? (process.env.PG_SSL_CA_CERT || process.env.DB_SSL_CA_CERT)
    : (process.env['PG_SSL_CA_CERT' + index] || process.env['DB_SSL_CA_CERT' + index]);

  if (caCert && caCert.trim()) {
    return caCert.trim();
  }

  const defaultCaFiles = index === 1
    ? [path.resolve(rootDir, 'ca.pem'), path.resolve(process.cwd(), 'ca.pem')]
    : [path.resolve(rootDir, `ca${index}.pem`), path.resolve(process.cwd(), `ca${index}.pem`)];

  const candidates = [
    caPath ? (path.isAbsolute(caPath) ? caPath : path.resolve(rootDir, caPath)) : null,
    caPath ? path.resolve(process.cwd(), caPath) : null,
    ...defaultCaFiles,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return fs.readFileSync(candidate, 'utf8');
      } catch (e) {
        console.error('Failed to read PostgreSQL CA certificate from ' + candidate + ':', e.message);
      }
    }
  }

  return undefined;
}

function getSslConfig(isLocal, index = 1) {
  if (isLocal) return false;

  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });

  const ca = resolveCaCertificate(index);
  const rejectUnauthorizedEnv = index === 1
    ? (process.env.PG_SSL_REJECT_UNAUTHORIZED || process.env.DB_SSL_REJECT_UNAUTHORIZED)
    : (process.env['PG_SSL_REJECT_UNAUTHORIZED' + index] || process.env['DB_SSL_REJECT_UNAUTHORIZED' + index]);

  const rejectUnauthorized = ca ? true : (rejectUnauthorizedEnv === 'true' && index === 1);

  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized };
}

function cleanUrl(rawUrl) {
  try {
    const u = new URL(rawUrl.trim());
    const toDelete = [];
    for (const key of u.searchParams.keys()) {
      if (/^ssl[-_]?mode$/i.test(key)) toDelete.push(key);
    }
    toDelete.forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Returns configuration objects for all configured PostgreSQL instances (up to 5).
 * Instance 1 defaults to postgresql_url / POSTGRESQL_URL / postgresql_url1 / POSTGRESQL_URL1.
 * Instances 2..5 use postgresql_url2..5 / POSTGRESQL_URL2..5.
 */
function getPostgresConfigs() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
  const configs = [];

  for (let i = 1; i <= 5; i++) {
    const url = i === 1
      ? (process.env.postgresql_url || process.env.POSTGRESQL_URL || process.env.postgresql_url1 || process.env.POSTGRESQL_URL1)
      : (process.env['postgresql_url' + i] || process.env['POSTGRESQL_URL' + i]);

    if (url && url.trim()) {
      const defaultDb = process.env.postgresql_db || process.env.POSTGRESQL_DB || 'postgresql';
      const dbName = i === 1
        ? (process.env.postgresql_db || process.env.POSTGRESQL_DB || process.env.postgresql_db1 || process.env.POSTGRESQL_DB1 || defaultDb)
        : (process.env['postgresql_db' + i] || process.env['POSTGRESQL_DB' + i] || defaultDb);

      configs.push({
        index: i,
        id: 'postgres_' + i,
        url: url.trim(),
        dbName: (dbName || 'postgresql').trim(),
      });
    }
  }

  const hasMultiple = configs.length > 1;
  return configs.map((c) => ({
    ...c,
    label: hasMultiple ? 'PostgreSQL ' + c.index : 'PostgreSQL',
  }));
}

function isPostgresConfigured(index) {
  const configs = getPostgresConfigs();
  if (index === undefined || index === null || index === 'any') {
    return configs.length > 0;
  }
  return configs.some((c) => c.index === index);
}

function getPostgresPool(index = 1) {
  if (cachedPools.has(index)) {
    return cachedPools.get(index);
  }

  const configs = getPostgresConfigs();
  const config = configs.find((c) => c.index === index);
  if (!config) {
    throw new Error('PostgreSQL instance ' + index + ' is not configured in environment variables');
  }

  const connectionString = config.url.trim();
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: isLocal ? connectionString : cleanUrl(connectionString),
    ssl: getSslConfig(isLocal, index),
    max: 4,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  pool.on('error', (err) => {
    console.warn('Unexpected idle PostgreSQL [' + config.label + '] error:', err.message);
    if (err.message && err.message.includes('certificate')) {
      cachedPools.delete(index);
    }
  });

  cachedPools.set(index, pool);
  return pool;
}

/**
 * Executes a lightweight ping query against a PostgreSQL instance (default index 1).
 */
async function pingPostgres(index = 1) {
  const configs = getPostgresConfigs();
  const config = configs.find((c) => c.index === index);

  if (!config) {
    return {
      index,
      target: 'PostgreSQL ' + index,
      configured: false,
      status: 'SKIPPED',
      message: 'PostgreSQL ' + index + ' is not configured',
    };
  }

  let pool;
  try {
    pool = getPostgresPool(index);
  } catch (err) {
    cachedPools.delete(index);
    throw err;
  }

  let client;
  try {
    client = await pool.connect();
    const pingStart = Date.now();
    const result = await client.query('/* keepalive */ SELECT 1 as alive, current_database() as current_db;');
    const responseTimeMs = Date.now() - pingStart;

    const row = result.rows && result.rows[0] ? result.rows[0] : {};
    return {
      index: config.index,
      target: config.label,
      configured: true,
      status: 'SUCCESS',
      database: row.current_db || config.dbName,
      responseTime: responseTimeMs,
      timestamp: new Date().toISOString(),
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
      error: err.message || 'PostgreSQL ping error',
      timestamp: new Date().toISOString(),
    };
  } finally {
    if (client) client.release();
  }
}

/**
 * Pings all configured PostgreSQL instances in parallel.
 */
async function pingAllPostgres() {
  const configs = getPostgresConfigs();
  if (configs.length === 0) return [];
  return Promise.all(configs.map((c) => pingPostgres(c.index)));
}

module.exports = {
  getPostgresConfigs,
  isPostgresConfigured,
  getPostgresPool,
  pingPostgres,
  pingAllPostgres,
  getSslConfig,
  resolveCaCertificate,
};
