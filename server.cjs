const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const PORT = parseInt(process.env.PORT, 10) || 5173;
const DIST_DIR = path.resolve(__dirname, 'dist');

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

// Background Keep-Alive Scheduler (Automated every 5 minutes)
function startKeepAliveScheduler() {
  const { scheduledPingHandler } = require('./netlify/functions/scheduled-ping');
  const INTERVAL_MS = 5 * 60 * 1000;

  console.log('⏰ Keep-Alive Scheduler initialized (running every 5 minutes)');

  // Initial trigger after 10 seconds
  setTimeout(async () => {
    try {
      await scheduledPingHandler({}, { clientContext: { custom: { scheduled: true } } });
    } catch (e) {
      console.error('Scheduled keep-alive run error:', e.message);
    }
  }, 10000);

  setInterval(async () => {
    try {
      await scheduledPingHandler({}, { clientContext: { custom: { scheduled: true } } });
    } catch (e) {
      console.error('Scheduled keep-alive run error:', e.message);
    }
  }, INTERVAL_MS);
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

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. API Route Handling
  let functionName = null;
  if (pathname.startsWith('/.netlify/functions/')) {
    functionName = pathname.replace('/.netlify/functions/', '').split('/')[0];
  } else if (pathname.startsWith('/api/')) {
    functionName = pathname.replace('/api/', '').split('/')[0];
  }

  if (functionName) {
    const handler = getFunctionHandler(functionName);
    if (!handler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', message: `Function ${functionName} not found` }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
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

  // 2. Static File Serving (from dist/)
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, safePath);

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

    // Caching headers: 1 year for immutable hashed assets, no-cache for index.html
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
});

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

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('\n============================================================');
  console.log('🚀 Multi-DB Keep Alive Manager Server is Running!');
  console.log('============================================================');
  console.log(`🌐 Local:        http://localhost:${PORT}`);
  console.log(`📡 Wi-Fi / LAN:  http://${localIp}:${PORT}`);
  console.log(`⚙️  Databases:    MongoDB Atlas + PostgreSQL + MySQL`);
  console.log('============================================================\n');

  startKeepAliveScheduler();
  startTelegramPoller();
});
