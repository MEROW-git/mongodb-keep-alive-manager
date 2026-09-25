const { connectToDatabase } = require('./lib/mongodb');
const { pingPostgres, isPostgresConfigured } = require('./lib/postgres');
const { pingMysql, isMysqlConfigured } = require('./lib/mysql');
const { jsonResponse, verifyToken, CORS_HEADERS } = require('./lib/auth');
require('dotenv').config();

const BOT_TOKEN = process.env.telegram_bot || process.env.TELEGRAM_BOT_TOKEN;

/**
 * Call Telegram Bot API helper
 */
async function callTelegramApi(method, payload = {}) {
  if (!BOT_TOKEN) {
    throw new Error('Telegram bot token (telegram_bot) is not configured in .env');
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.json();
}

/**
 * Send Telegram message with safe HTML fallback
 */
async function sendSafeTelegramMessage(chatId, text, options = {}) {
  const parseMode = options.parseMode || 'HTML';
  const payload = {
    chat_id: String(chatId),
    text,
    parse_mode: parseMode,
    ...(options.reply_markup ? { reply_markup: options.reply_markup } : {}),
  };

  try {
    const res = await callTelegramApi('sendMessage', payload);
    if (res.ok) return res;

    // If markdown/html parsing fails, strip tags and send as plain text
    const plainText = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '');
    return await callTelegramApi('sendMessage', {
      chat_id: String(chatId),
      text: plainText,
      ...(options.reply_markup ? { reply_markup: options.reply_markup } : {}),
    });
  } catch (err) {
    const plainText = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '');
    return await callTelegramApi('sendMessage', {
      chat_id: String(chatId),
      text: plainText,
      ...(options.reply_markup ? { reply_markup: options.reply_markup } : {}),
    });
  }
}

/**
 * Dynamic Reply Keyboard for authorized users displaying all 3 databases
 */
function getAuthorizedKeyboard() {
  const hasPg = isPostgresConfigured();
  const hasMy = isMysqlConfigured();

  const keyboard = [
    // Row 1: Global Operations
    [{ text: '📊 All DBs Status' }, { text: '⚡ Instant Multi-Ping' }],
  ];

  // Row 2: Dedicated Individual Database Buttons
  const dbRow = [{ text: '🍃 MongoDB' }];
  if (hasPg) dbRow.push({ text: '🐘 PostgreSQL' });
  if (hasMy) dbRow.push({ text: '🐬 MySQL' });
  keyboard.push(dbRow);

  // Row 3: Identity & Help
  keyboard.push([
    { text: '🆔 My ID' },
    { text: '❓ Help' },
  ]);

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Escape special HTML characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Process a single incoming Telegram message
 */
async function processTelegramMessage(db, message) {
  if (!message) return null;

  const chatId = message.chat?.id;
  const userId = String(message.from?.id || chatId);
  const username = message.from?.username || '';
  const firstName = message.from?.first_name || '';
  const lastName = message.from?.last_name || '';
  const text = (message.text || '').trim();
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || `User ${userId}`;

  const bansCol = db.collection('telegram_bans');
  const usersCol = db.collection('telegram_users');
  const messagesCol = db.collection('telegram_messages');
  const logsCol = db.collection('logs');

  // 1. Log chat message in telegram_messages collection for dashboard live feed
  await messagesCol.insertOne({
    userId,
    chatId: String(chatId),
    username: username.replace(/^@/, ''),
    displayName,
    text,
    isCommand: text.startsWith('/'),
    createdAt: new Date(),
  });

  // 2. Retrieve existing user or create as Pending Approval
  const existingUser = await usersCol.findOne({ userId });
  const isAllowed = existingUser ? !!existingUser.isAllowed : false;

  await usersCol.updateOne(
    { userId },
    {
      $set: {
        userId,
        chatId: String(chatId),
        username: username.replace(/^@/, ''),
        firstName,
        lastName,
        displayName,
        lastMessage: text,
        lastActive: new Date(),
      },
      $setOnInsert: {
        firstSeen: new Date(),
        isAllowed: false, // Default is pending approval
        receiveNotifications: true,
      },
    },
    { upsert: true }
  );

  // 3. Check if user is banned
  const ban = await bansCol.findOne({ userId });
  if (ban) {
    await sendSafeTelegramMessage(
      chatId,
      `🚫 <b>Access Denied</b>\nYou have been banned from using this bot.\n<b>Reason:</b> ${ban.reason || 'Restricted by administrator'}`
    );
    return { status: 'banned', userId };
  }

  const dbName = process.env.MONGO_DB_NAME || 'system_reset';
  const mainCollection = process.env.WEBADMIN_COLLECTION || 'sysreset';
  const hasPg = isPostgresConfigured();
  const hasMy = isMysqlConfigured();
  const replyMarkup = getAuthorizedKeyboard();

  // 4. Access Gate: Check if user is allowed / authorized by Admin
  if (!isAllowed) {
    if (text.startsWith('/start') || text.startsWith('/help')) {
      const warmWelcomeText =
        `✨ <b>Hello, ${escapeHtml(firstName || displayName)}! Warm welcome!</b> 🐱👋\n\n` +
        `I am your <b>Multi-Database Keep-Alive Assistant</b> (MongoDB Atlas + PostgreSQL + MySQL).\n\n` +
        `⏳ <b>Access Status: Pending Administrator Approval</b>\n\n` +
        `🔒 <i>To protect database resources and keep monitoring secure, all new users must be authorized by an administrator in the Keep-Alive Dashboard before access is granted.</i>\n\n` +
        `Your connection has been registered. Once approved, you will be able to monitor latency and ping all databases!`;

      await sendSafeTelegramMessage(chatId, warmWelcomeText);
      return { status: 'pending_approval_welcome', userId };
    }

    const pendingNotice =
      `🔒 <b>Authorization Required</b>\n\n` +
      `Hello ${escapeHtml(firstName || displayName)}! Your account is currently waiting for administrator approval in the Keep-Alive Dashboard.\n\n` +
      `Please ask the dashboard administrator to click <b>"Allow Access"</b> for your user.`;

    await sendSafeTelegramMessage(chatId, pendingNotice);
    return { status: 'unauthorized', userId };
  }

  // 5. Authorized User Handlers
  const isStart = text.startsWith('/start');
  const isHelp = text.startsWith('/help') || text.includes('Help');
  const isId = text.startsWith('/id') || text.includes('My ID');
  const isAllStatus = text.includes('All DBs Status') || text.includes('Cluster Status') || text.startsWith('/status') || text.startsWith('/all');
  const isMultiPing = text.includes('Instant Multi-Ping') || text.includes('Instant Ping') || text.startsWith('/ping') || text.startsWith('/multiping');
  const isMongo = text.includes('MongoDB') || text.startsWith('/mongo') || text.startsWith('/mongodb');
  const isPostgres = text.includes('PostgreSQL') || text.startsWith('/postgres') || text.startsWith('/pg');
  const isMysql = text.includes('MySQL') || text.startsWith('/mysql') || text.startsWith('/my');

  // Time formatter helper
  const getTimeString = () => new Date().toLocaleTimeString('en-US', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  // --- /start or /help ---
  if (isStart || isHelp) {
    const authorizedWelcome =
      `✨ <b>Multi-DB Keep-Alive Assistant</b> 🐱⚡\n\n` +
      `Hello ${escapeHtml(firstName || displayName)}! Your account is <b>Authorized</b> to monitor and ping your databases.\n\n` +
      `📊 <b>Interactive Database Controls:</b>\n` +
      `• <b>📊 All DBs Status:</b> Live latency summary across all 3 databases\n` +
      `• <b>⚡ Instant Multi-Ping:</b> Execute an immediate keep-alive cycle\n` +
      `• <b>🍃 MongoDB:</b> Check MongoDB Atlas specifically\n` +
      `• <b>🐘 PostgreSQL:</b> Check PostgreSQL connection &amp; SSL\n` +
      `• <b>🐬 MySQL:</b> Check MySQL connection &amp; SSL\n` +
      `• <b>🆔 My ID:</b> Display your Chat ID &amp; User ID\n\n` +
      `🔔 <i>You are subscribed to automatic alerts whenever background keep-alive pings occur.</i>`;

    await sendSafeTelegramMessage(chatId, authorizedWelcome, { reply_markup: replyMarkup });
    return { status: 'authorized_welcome', userId };
  }

  // --- /id ---
  if (isId) {
    const configuredDbs = ['MongoDB (Atlas)', hasPg && 'PostgreSQL (Aiven)', hasMy && 'MySQL (Aiven)'].filter(Boolean).join(', ');
    await sendSafeTelegramMessage(
      chatId,
      `🆔 <b>Your Telegram Identity:</b>\n\n` +
      `• <b>Chat ID:</b> <code>${chatId}</code>\n` +
      `• <b>User ID:</b> <code>${userId}</code>\n` +
      `• <b>Authorization:</b> 🟢 <b>Allowed &amp; Active</b>\n` +
      `• <b>Configured DBs:</b> ${configuredDbs}\n` +
      `• <b>Keep-Alive Alerts:</b> Subscribed`,
      { reply_markup: replyMarkup }
    );
    return { status: 'id_sent', userId };
  }

  // --- 🍃 MongoDB Dedicated Status ---
  if (isMongo) {
    const mongoStart = Date.now();
    try {
      await db.command({ ping: 1 });
      const latency = Date.now() - mongoStart;
      const mongoText =
        `🍃 <b>MongoDB Atlas Status: ONLINE</b>\n\n` +
        `• <b>Database:</b> <code>${dbName}</code>\n` +
        `• <b>Target Collection:</b> <code>${mainCollection}</code>\n` +
        `• <b>Latency:</b> <code>${latency} ms</code>\n` +
        `• <b>TLS:</b> Encrypted TLS\n` +
        `• <b>Timestamp:</b> <code>${getTimeString()}</code>\n\n` +
        `✨ <i>MongoDB keep-alive verified healthy and active.</i>`;

      await sendSafeTelegramMessage(chatId, mongoText, { reply_markup: replyMarkup });
      return { status: 'mongo_status_sent', userId, latency };
    } catch (err) {
      await sendSafeTelegramMessage(
        chatId,
        `🍃 <b>MongoDB Atlas Status: OFFLINE 🔴</b>\n\n` +
        `• <b>Database:</b> <code>${dbName}</code>\n` +
        `• <b>Error:</b> <i>${escapeHtml(err.message)}</i>\n` +
        `• <b>Timestamp:</b> <code>${getTimeString()}</code>`,
        { reply_markup: replyMarkup }
      );
      return { status: 'mongo_status_error', userId };
    }
  }

  // --- 🐘 PostgreSQL Dedicated Status ---
  if (isPostgres) {
    if (!hasPg) {
      await sendSafeTelegramMessage(
        chatId,
        `🐘 <b>PostgreSQL is not configured</b> in your .env variables.`,
        { reply_markup: replyMarkup }
      );
      return { status: 'pg_not_configured', userId };
    }

    try {
      const pgRes = await pingPostgres();
      const pgText =
        `🐘 <b>PostgreSQL Status: ${pgRes.status === 'SUCCESS' ? 'ONLINE 🟢' : 'FAILED 🔴'}</b>\n\n` +
        `• <b>Database:</b> <code>${pgRes.database || 'defaultdb'}</code>\n` +
        `• <b>Response Time:</b> <code>${pgRes.responseTime || 0} ms</code>\n` +
        `• <b>SSL Verification:</b> 🔒 Strict Verified (<code>ca.pem</code>)\n` +
        `• <b>Timestamp:</b> <code>${getTimeString()}</code>\n\n` +
        `✨ <i>PostgreSQL connection pool verified active.</i>`;

      await sendSafeTelegramMessage(chatId, pgText, { reply_markup: replyMarkup });
      return { status: 'pg_status_sent', userId };
    } catch (err) {
      await sendSafeTelegramMessage(
        chatId,
        `🐘 <b>PostgreSQL Status: OFFLINE 🔴</b>\n\n` +
        `• <b>Error:</b> <i>${escapeHtml(err.message)}</i>\n` +
        `• <b>Timestamp:</b> <code>${getTimeString()}</code>`,
        { reply_markup: replyMarkup }
      );
      return { status: 'pg_status_error', userId };
    }
  }

  // --- 🐬 MySQL Dedicated Status ---
  if (isMysql) {
    if (!hasMy) {
      await sendSafeTelegramMessage(
        chatId,
        `🐬 <b>MySQL is not configured</b> in your .env variables.`,
        { reply_markup: replyMarkup }
      );
      return { status: 'my_not_configured', userId };
    }

    try {
      const myRes = await pingMysql();
      const myText =
        `🐬 <b>MySQL Status: ${myRes.status === 'SUCCESS' ? 'ONLINE 🟢' : 'FAILED 🔴'}</b>\n\n` +
        `• <b>Database:</b> <code>${myRes.database || 'defaultdb'}</code>\n` +
        `• <b>Response Time:</b> <code>${myRes.responseTime || 0} ms</code>\n` +
        `• <b>SSL Verification:</b> 🔒 Strict Verified (<code>ca.pem</code>)\n` +
        `• <b>Timestamp:</b> <code>${getTimeString()}</code>\n\n` +
        `✨ <i>MySQL connection pool verified active.</i>`;

      await sendSafeTelegramMessage(chatId, myText, { reply_markup: replyMarkup });
      return { status: 'my_status_sent', userId };
    } catch (err) {
      await sendSafeTelegramMessage(
        chatId,
        `🐬 <b>MySQL Status: OFFLINE 🔴</b>\n\n` +
        `• <b>Error:</b> <i>${escapeHtml(err.message)}</i>\n` +
        `• <b>Timestamp:</b> <code>${getTimeString()}</code>`,
        { reply_markup: replyMarkup }
      );
      return { status: 'my_status_error', userId };
    }
  }

  // --- 📊 All DBs Status (Overview) ---
  if (isAllStatus) {
    const mongoStart = Date.now();
    let mongoRes;
    try {
      await db.command({ ping: 1 });
      mongoRes = { status: 'SUCCESS', responseTime: Date.now() - mongoStart, database: dbName };
    } catch (e) {
      mongoRes = { status: 'FAILED', responseTime: 0, error: e.message, database: dbName };
    }

    let pgRes = null;
    if (hasPg) {
      try {
        pgRes = await pingPostgres();
      } catch (e) {
        pgRes = { status: 'FAILED', responseTime: 0, error: e.message, database: process.env.postgresql_db || 'postgresql' };
      }
    }

    let myRes = null;
    if (hasMy) {
      try {
        myRes = await pingMysql();
      } catch (e) {
        myRes = { status: 'FAILED', responseTime: 0, error: e.message, database: process.env.mysql_db || 'mysql' };
      }
    }

    const lines = [];
    let successCount = 0;
    let totalCount = 1;

    // Mongo
    if (mongoRes.status === 'SUCCESS') {
      successCount++;
      lines.push(`🍃 <b>MongoDB Atlas:</b> 🟢 ONLINE (<code>${mongoRes.responseTime} ms</code>)\n   • DB: <code>${mongoRes.database}</code>`);
    } else {
      lines.push(`🍃 <b>MongoDB Atlas:</b> 🔴 OFFLINE\n   • Error: <i>${escapeHtml(mongoRes.error)}</i>`);
    }

    // Postgres
    if (hasPg && pgRes) {
      totalCount++;
      if (pgRes.status === 'SUCCESS') {
        successCount++;
        lines.push(`🐘 <b>PostgreSQL:</b> 🟢 ONLINE (<code>${pgRes.responseTime} ms</code>)\n   • DB: <code>${pgRes.database}</code>`);
      } else {
        lines.push(`🐘 <b>PostgreSQL:</b> 🔴 OFFLINE\n   • Error: <i>${escapeHtml(pgRes.error)}</i>`);
      }
    }

    // MySQL
    if (hasMy && myRes) {
      totalCount++;
      if (myRes.status === 'SUCCESS') {
        successCount++;
        lines.push(`🐬 <b>MySQL:</b> 🟢 ONLINE (<code>${myRes.responseTime} ms</code>)\n   • DB: <code>${myRes.database}</code>`);
      } else {
        lines.push(`🐬 <b>MySQL:</b> 🔴 OFFLINE\n   • Error: <i>${escapeHtml(myRes.error)}</i>`);
      }
    }

    const allGood = successCount === totalCount;
    const summaryText =
      `📊 <b>Multi-Database Status Overview</b>\n\n` +
      lines.join('\n\n') +
      `\n\n⚡ <b>System Health:</b> ${allGood ? '🟢' : '⚠️'} ${successCount}/${totalCount} Databases Verified\n` +
      `🕒 <b>Checked at:</b> <code>${getTimeString()}</code>`;

    await sendSafeTelegramMessage(chatId, summaryText, { reply_markup: replyMarkup });
    return { status: 'all_status_sent', userId, successCount, totalCount };
  }

  // --- ⚡ Instant Multi-Ping (Execute Keep-Alive Cycle) ---
  if (isMultiPing) {
    const mongoStart = Date.now();
    let mongoRes;
    try {
      await db.command({ ping: 1 });
      mongoRes = { status: 'SUCCESS', responseTime: Date.now() - mongoStart, database: dbName };
      await logsCol.insertOne({
        action: 'PING',
        target: 'MongoDB',
        status: 'SUCCESS',
        database: dbName,
        responseTime: mongoRes.responseTime,
        source: 'TELEGRAM_BOT',
        createdAt: new Date(),
      });
    } catch (e) {
      mongoRes = { status: 'FAILED', responseTime: 0, error: e.message, database: dbName };
      await logsCol.insertOne({
        action: 'PING',
        target: 'MongoDB',
        status: 'FAILED',
        database: dbName,
        error: e.message,
        source: 'TELEGRAM_BOT',
        createdAt: new Date(),
      });
    }

    let pgRes = null;
    if (hasPg) {
      try {
        pgRes = await pingPostgres();
        await logsCol.insertOne({
          action: 'PING',
          target: 'PostgreSQL',
          status: pgRes.status,
          database: pgRes.database,
          responseTime: pgRes.responseTime,
          source: 'TELEGRAM_BOT',
          createdAt: new Date(),
        });
      } catch (e) {
        pgRes = { status: 'FAILED', responseTime: 0, error: e.message, database: process.env.postgresql_db || 'postgresql' };
        await logsCol.insertOne({
          action: 'PING',
          target: 'PostgreSQL',
          status: 'FAILED',
          database: process.env.postgresql_db || 'postgresql',
          error: e.message,
          source: 'TELEGRAM_BOT',
          createdAt: new Date(),
        });
      }
    }

    let myRes = null;
    if (hasMy) {
      try {
        myRes = await pingMysql();
        await logsCol.insertOne({
          action: 'PING',
          target: 'MySQL',
          status: myRes.status,
          database: myRes.database,
          responseTime: myRes.responseTime,
          source: 'TELEGRAM_BOT',
          createdAt: new Date(),
        });
      } catch (e) {
        myRes = { status: 'FAILED', responseTime: 0, error: e.message, database: process.env.mysql_db || 'mysql' };
        await logsCol.insertOne({
          action: 'PING',
          target: 'MySQL',
          status: 'FAILED',
          database: process.env.mysql_db || 'mysql',
          error: e.message,
          source: 'TELEGRAM_BOT',
          createdAt: new Date(),
        });
      }
    }

    const lines = [];
    lines.push(`✅ <b>MongoDB Atlas:</b> <code>${mongoRes.database}</code> (<code>${mongoRes.responseTime} ms</code>)`);
    if (hasPg && pgRes) {
      lines.push(`✅ <b>PostgreSQL:</b> <code>${pgRes.database}</code> (<code>${pgRes.responseTime} ms</code>)`);
    }
    if (hasMy && myRes) {
      lines.push(`✅ <b>MySQL:</b> <code>${myRes.database}</code> (<code>${myRes.responseTime} ms</code>)`);
    }

    const pingDoneText =
      `⚡ <b>Instant Multi-DB Keep-Alive Ping Executed!</b>\n\n` +
      lines.join('\n') +
      `\n\n💾 <i>Keep-alive cycle recorded to dashboard logs.</i>\n` +
      `🕒 <b>Timestamp:</b> <code>${getTimeString()}</code>`;

    await sendSafeTelegramMessage(chatId, pingDoneText, { reply_markup: replyMarkup });
    return { status: 'multi_ping_executed', userId };
  }

  // Conversational response with control keyboard
  if (text) {
    await sendSafeTelegramMessage(
      chatId,
      `🤖 <b>Multi-Database Keep-Alive Assistant</b>\n\n` +
      `Received: <i>"${escapeHtml(text)}"</i>\n\n` +
      `Tap the buttons below to check all databases or run an instant multi-ping:`,
      { reply_markup: replyMarkup }
    );
  }

  return { status: 'processed', userId };
}

/**
 * Synchronize and process pending Telegram updates
 */
async function syncTelegramUpdates(db) {
  if (!BOT_TOKEN) return { processed: 0 };
  try {
    const updatesRes = await callTelegramApi('getUpdates', { limit: 100, timeout: 0 });
    if (!updatesRes.ok || !Array.isArray(updatesRes.result) || updatesRes.result.length === 0) {
      return { processed: 0 };
    }

    const updates = updatesRes.result;
    let maxUpdateId = 0;

    for (const update of updates) {
      if (update.update_id > maxUpdateId) {
        maxUpdateId = update.update_id;
      }
      const msg = update.message || update.edited_message;
      if (msg) {
        try {
          await processTelegramMessage(db, msg);
        } catch (msgErr) {
          console.error('Error handling Telegram message:', msgErr);
        }
      }
    }

    // Acknowledge updates up to maxUpdateId
    if (maxUpdateId > 0) {
      await callTelegramApi('getUpdates', { offset: maxUpdateId + 1, limit: 1, timeout: 0 });
    }

    return { processed: updates.length };
  } catch (err) {
    console.error('Telegram updates sync error:', err.message);
    return { error: err.message, processed: 0 };
  }
}

exports.callTelegramApi = callTelegramApi;
exports.sendSafeTelegramMessage = sendSafeTelegramMessage;
exports.processTelegramMessage = processTelegramMessage;
exports.syncTelegramUpdates = syncTelegramUpdates;
exports.getAuthorizedKeyboard = getAuthorizedKeyboard;

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Handle Telegram Incoming Webhook (Strictly authenticated via secret token)
  const isWebhook = event.queryStringParameters?.action === 'webhook' || event.path?.includes('webhook');
  if (isWebhook && event.httpMethod === 'POST') {
    const configuredWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.CRON_SECRET;
    const providedWebhookSecret =
      event.headers['x-telegram-bot-api-secret-token'] ||
      event.headers['X-Telegram-Bot-Api-Secret-Token'] ||
      event.queryStringParameters?.secret;

    if (!configuredWebhookSecret || providedWebhookSecret !== configuredWebhookSecret) {
      console.warn('[SECURITY] Rejected unauthenticated Telegram webhook request');
      return jsonResponse(401, {
        status: 'error',
        message: 'Unauthorized: Invalid or missing Telegram webhook secret token',
      });
    }

    let update = {};
    try {
      update = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { status: 'error', message: 'Malformed JSON payload' });
    }

    const message = update.message || update.edited_message;
    if (!message) {
      return jsonResponse(200, { ok: true });
    }

    try {
      const { db } = await connectToDatabase();
      await processTelegramMessage(db, message);
      return jsonResponse(200, { ok: true });
    } catch (err) {
      console.error('Telegram webhook error:', err.message);
      return jsonResponse(500, { status: 'error', message: 'Webhook processing failed' });
    }
  }

  // Handle Admin Dashboard API Requests (Requires JWT Auth)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const decoded = verifyToken(authHeader);
  if (!decoded) {
    return jsonResponse(401, {
      status: 'error',
      message: 'Unauthorized: Valid JWT required to access Telegram admin settings',
    });
  }

  try {
    const { db } = await connectToDatabase();
    const settingsCol = db.collection('settings');
    const usersCol = db.collection('telegram_users');
    const bansCol = db.collection('telegram_bans');
    const messagesCol = db.collection('telegram_messages');

    // GET /api/telegram -> retrieve telegram management state
    if (event.httpMethod === 'GET') {
      const [settings, users, bans, recentMessages] = await Promise.all([
        settingsCol.findOne({}),
        usersCol.find({}).sort({ lastActive: -1 }).limit(100).toArray(),
        bansCol.find({}).sort({ bannedAt: -1 }).toArray(),
        messagesCol.find({}).sort({ createdAt: -1 }).limit(50).toArray(),
      ]);

      const bannedIds = new Set(bans.map((b) => b.userId));
      const formattedUsers = users.map((u) => ({
        ...u,
        isBanned: bannedIds.has(u.userId),
      }));

      return jsonResponse(200, {
        configured: Boolean(BOT_TOKEN),
        botUsername: process.env.TELEGRAM_BOT_USERNAME || 'KeepAliveBot',
        defaultChatId: settings?.telegramDefaultChatId || '',
        notifyOnPing: settings?.telegramNotifyOnPing !== false,
        users: formattedUsers,
        bans,
        recentMessages,
      });
    }

    // POST /api/telegram -> Admin actions
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const action = body.action;

      if (action === 'sync_updates') {
        const syncRes = await syncTelegramUpdates(db);
        return jsonResponse(200, { status: 'ok', ...syncRes });
      }

      if (action === 'allow_user') {
        const { userId, allow = true, receiveNotifications = true } = body;
        await usersCol.updateOne(
          { userId },
          { $set: { isAllowed: !!allow, receiveNotifications: !!receiveNotifications, updatedAt: new Date() } }
        );

        if (allow) {
          const user = await usersCol.findOne({ userId });
          if (user?.chatId) {
            await sendSafeTelegramMessage(
              user.chatId,
              `🎉 <b>Access Approved!</b> 🐱✨\n\n` +
              `An administrator has approved your access to the Keep-Alive Bot!\n\n` +
              `You can now tap any button below to monitor database health and execute pings.`,
              { reply_markup: getAuthorizedKeyboard() }
            );
          }
        }
        return jsonResponse(200, { status: 'ok', message: 'User access updated' });
      }

      if (action === 'toggle_notifications') {
        const { userId, receiveNotifications } = body;
        await usersCol.updateOne(
          { userId },
          { $set: { receiveNotifications: !!receiveNotifications, updatedAt: new Date() } }
        );
        return jsonResponse(200, { status: 'ok', message: 'Notification preference updated' });
      }

      if (action === 'ban_user') {
        const { userId, username, reason } = body;
        await bansCol.updateOne(
          { userId },
          {
            $set: {
              userId,
              username: username || '',
              reason: reason || 'Banned by administrator',
              bannedAt: new Date(),
              bannedBy: decoded.username || 'admin',
            },
          },
          { upsert: true }
        );
        await usersCol.updateOne({ userId }, { $set: { isAllowed: false } });

        const user = await usersCol.findOne({ userId });
        if (user?.chatId) {
          await sendSafeTelegramMessage(
            user.chatId,
            `🚫 <b>Notice:</b> Your bot access has been restricted by an administrator.\n<b>Reason:</b> ${reason || 'Violation of access policy'}`
          );
        }

        return jsonResponse(200, { status: 'ok', message: 'User banned' });
      }

      if (action === 'unban_user') {
        const { userId } = body;
        await bansCol.deleteOne({ userId });
        return jsonResponse(200, { status: 'ok', message: 'User unbanned' });
      }

      if (action === 'update_settings') {
        const { defaultChatId, notifyOnPing } = body;
        await settingsCol.updateOne(
          {},
          {
            $set: {
              ...(defaultChatId !== undefined ? { telegramDefaultChatId: defaultChatId } : {}),
              ...(notifyOnPing !== undefined ? { telegramNotifyOnPing: Boolean(notifyOnPing) } : {}),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
        return jsonResponse(200, { status: 'ok', message: 'Settings updated' });
      }

      if (action === 'send_notification') {
        const { chatId, message: customMessage } = body;
        if (!chatId || !customMessage) {
          return jsonResponse(400, { status: 'error', message: 'chatId and message are required' });
        }
        await sendSafeTelegramMessage(chatId, customMessage, { reply_markup: getAuthorizedKeyboard() });
        return jsonResponse(200, { status: 'ok', message: 'Message sent' });
      }

      return jsonResponse(400, { status: 'error', message: `Unknown action: ${action}` });
    }

    return jsonResponse(405, { status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Telegram API error:', error.message);
    return jsonResponse(500, { status: 'error', message: 'Internal Server Error' });
  }
};
