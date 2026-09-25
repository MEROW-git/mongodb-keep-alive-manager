const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const PORT = parseInt(process.env.PORT, 10) || 5173;
const DIST_DIR = path.resolve(__dirname, 'dist');
const MAX_PAYLOAD_BYTES = 100 * 1024; // 100 KB max payload size to prevent DoS memory exhaustion

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

// Function cache for serverless handlers
const functionsCache = {};

function getFunctionHandler(functionName) {
  if (functionsCache[functionName]) {
    return functionsCache[functionName];
  }
  const fnPath = path.resolve(__dirname, `netlify/functions/${functionName}.js`);
  if (!fs.existsSync(fnPath)) {
    return null;
  }
  const mod = require(fnPath);
  functionsCache[functionName] = mod.handler;
  return mod.handler;
}

// Background Keep-Alive Scheduler (Autonomous, dynamically reading interval from settings)
const { startAutonomousScheduler } = require('./netlify/functions/lib/scheduler');
function startKeepAliveScheduler() {
  startAutonomousScheduler(15000);
}

// Background Telegram Poller
function startTelegramPoller() {
  const botToken = process.env.telegram_bot || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log('ℹ️  telegram_bot token not set in .env (Telegram polling disabled)');
    return;
  }

  const { connectToDatabase } = require('./netlify/functions/lib/mongodb');
  const { syncTelegramUpdates } = require('./netlify/functions/telegram');

  console.log('🤖 Telegram Bot background poller initialized (polling every 3 seconds)');

  setInterval(async () => {
    try {
      const { db } = await connectToDatabase();
      await syncTelegramUpdates(db);
    } catch (e) {
      // ignore transient network errors
    }
  }, 3000);
}

// Request Handler
async function handleRequest(req, res) {
  // Catch malformed URLs safely (prevents URIError crashes from malicious paths like /%%)
  let parsedUrl;
  try {
    parsedUrl = url.parse(req.url, true);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'error', message: 'Bad Request: Malformed URL' }));
    return;
  }

  const pathname = parsedUrl.pathname || '/';

  // 1. API Route Handling
  let functionName = null;
  if (pathname.startsWith('/.netlify/functions/')) {
    functionName = pathname.replace('/.netlify/functions/', '').split('/')[0];
  } else if (pathname.startsWith('/api/')) {
    functionName = pathname.replace('/api/', '').split('/')[0];
  }

  if (functionName) {
    // Security: Block public unauthenticated access to scheduled-ping on local server
    if (functionName === 'scheduled-ping') {
      const cronSecret = process.env.CRON_SECRET;
      const providedSecret = req.headers['x-cron-secret'] || parsedUrl.query?.key;
      if (!cronSecret || providedSecret !== cronSecret) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: 'Forbidden: scheduled-ping runs internally and cannot be called publicly' }));
        return;
      }
    }

    const handler = getFunctionHandler(functionName);
    if (!handler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: `Function ${functionName} not found` }));
      return;
    }

    let body = '';
    let isPayloadTooLarge = false;

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_PAYLOAD_BYTES) {
        isPayloadTooLarge = true;
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: 'Payload Too Large (Maximum 100KB)' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      if (isPayloadTooLarge) return;

      const event = {
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: parsedUrl.query,
        body: body || null,
        path: pathname,
      };

      const context = {
        clientContext: {},
      };

      try {
        const response = await handler(event, context);
        res.statusCode = response.statusCode || 200;
        if (response.headers) {
          for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
          }
        }
        res.end(response.body || '');
      } catch (err) {
        console.error(`API execution error on /api/${functionName}:`, err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: 'Internal Server Error' }));
      }
    });
    return;
  }

  // 2. Static File Serving (from dist/) with safe path decoding
  let safePath;
  try {
    safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'error', message: 'Bad Request: Malformed URI component' }));
    return;
  }

  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(DIST_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: return index.html for client-side routing
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, indexData) => {
        if (indexErr) {
          res.statusCode = 500;
          res.end('Error loading dashboard application. Run "npm run build" first.');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(indexData);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Caching headers
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Discover local network Wi-Fi IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Check for SSL certificates for local HTTPS
function createServerInstance() {
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH;

  if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    try {
      const options = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      };
      console.log('🔒 HTTPS SSL certificates loaded successfully.');
      return { server: https.createServer(options, handleRequest), isHttps: true };
    } catch (e) {
      console.error('Failed to initialize HTTPS with provided certificates:', e.message);
    }
  }

  return { server: http.createServer(handleRequest), isHttps: false };
}

const { server, isHttps } = createServerInstance();
const protocol = isHttps ? 'https' : 'http';

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('\n============================================================');
  console.log(`🚀 Multi-DB Keep Alive Manager Server is Running (${protocol.toUpperCase()})!`);
  console.log('============================================================');
  console.log(`🌐 Local:        ${protocol}://localhost:${PORT}`);
  console.log(`📡 Wi-Fi / LAN:  ${protocol}://${localIp}:${PORT}`);
  console.log(`⚙️  Databases:    MongoDB Atlas + PostgreSQL + MySQL`);
  if (!isHttps) {
    console.log('⚠️  SECURITY NOTE: Running unencrypted HTTP. On public or shared Wi-Fi,');
    console.log('   use HTTPS (set SSL_KEY_PATH & SSL_CERT_PATH) or a Caddy/Nginx reverse proxy.');
  }
  console.log('============================================================\n');

  startKeepAliveScheduler();
  startTelegramPoller();
});
