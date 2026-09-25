const { connectToDatabase } = require('./lib/mongodb');
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

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Handle Telegram Incoming Webhook (no admin JWT required, verified by Telegram payload)
  const isWebhook = event.queryStringParameters?.action === 'webhook' || event.path?.includes('webhook');
  if (isWebhook && event.httpMethod === 'POST') {
    let update = {};
    try {
      update = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(200, { ok: true });
    }

    const message = update.message;
    if (!message || !message.text) {
      return jsonResponse(200, { ok: true });
    }

    const chatId = message.chat?.id;
    const userId = String(message.from?.id);
    const text = message.text.trim();

    try {
      const { db } = await connectToDatabase();
      const bansCol = db.collection('telegram_bans');

      // Check if user is banned
      const ban = await bansCol.findOne({ userId });
      if (ban) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `🚫 *Access Denied*\nYou have been banned from using this bot.\n*Reason:* ${ban.reason || 'Restricted by administrator'}`,
          parse_mode: 'Markdown',
        });
        return jsonResponse(200, { ok: true, status: 'banned' });
      }

      // Handle Telegram Commands
      if (text.startsWith('/start') || text.startsWith('/help')) {
        const welcomeText = `👋 *Welcome to MongoDB Keep Alive Bot*\n\n` +
          `• *Your Chat ID:* \`${chatId}\`\n` +
          `• *Your User ID:* \`${userId}\`\n\n` +
          `*Available Commands:*\n` +
          `• \`/status\` - View current MongoDB cluster health\n` +
          `• \`/ping\` - Execute instant keep-alive ping\n` +
          `• \`/id\` - Show your Telegram Chat ID`;

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: welcomeText,
          parse_mode: 'Markdown',
        });
        return jsonResponse(200, { ok: true });
      }

      if (text.startsWith('/id')) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `🆔 *Your Telegram Chat ID:* \`${chatId}\`\nUse this Chat ID in the admin dashboard to receive keep-alive alerts.`,
          parse_mode: 'Markdown',
        });
        return jsonResponse(200, { ok: true });
      }

      if (text.startsWith('/ping') || text.startsWith('/status')) {
        const pingStart = Date.now();
        await db.command({ ping: 1 });
        const latency = Date.now() - pingStart;

        const dbName = process.env.MONGO_DB_NAME || 'system_reset';
        const statusText = `🟢 *MongoDB Atlas Status: ONLINE*\n\n` +
          `• *Database:* \`${dbName}\`\n` +
          `• *Cluster:* Production Database\n` +
          `• *Latency:* \`${latency} ms\`\n` +
          `• *Timestamp:* ${new Date().toISOString()}\n\n` +
          `Keep-Alive bot is actively monitoring your cluster.`;

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: statusText,
          parse_mode: 'Markdown',
        });
        return jsonResponse(200, { ok: true });
      }

      // Default reply
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🤖 MongoDB Keep Alive Bot is active.\nType /status to inspect database health or /id to view your Chat ID.`,
      });

      return jsonResponse(200, { ok: true });
    } catch (err) {
      console.error('Telegram webhook error:', err);
      return jsonResponse(200, { ok: true, error: err.message });
    }
  }

  // Admin Dashboard Actions (Requires valid JWT authorization)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const decoded = verifyToken(authHeader);
  if (!decoded) {
    return jsonResponse(401, {
      status: 'error',
      message: 'Unauthorized: Valid JWT required to manage Telegram bot',
    });
  }

  try {
    const { db } = await connectToDatabase();
    const bansCol = db.collection('telegram_bans');
    const settingsCol = db.collection('settings');

    // GET: Retrieve bot status, settings, and banned users list
    if (event.httpMethod === 'GET') {
      let botInfo = null;
      let botError = null;

      try {
        const res = await callTelegramApi('getMe');
        if (res.ok) {
          botInfo = res.result;
        } else {
          botError = res.description;
        }
      } catch (e) {
        botError = e.message;
      }

      const [bannedUsers, appSettings] = await Promise.all([
        bansCol.find({}).sort({ bannedAt: -1 }).toArray(),
        settingsCol.findOne({}),
      ]);

      const formattedBans = bannedUsers.map((b) => ({
        id: b._id.toString(),
        userId: b.userId,
        username: b.username || 'Unknown',
        reason: b.reason || 'No reason specified',
        bannedAt: b.bannedAt ? new Date(b.bannedAt).toLocaleString('en-US') : 'N/A',
        bannedBy: b.bannedBy || 'admin',
      }));

      return jsonResponse(200, {
        status: 'success',
        bot: {
          configured: !!BOT_TOKEN,
          connected: !!botInfo,
          info: botInfo,
          error: botError,
        },
        settings: {
          defaultChatId: appSettings?.telegramDefaultChatId || '',
          notifyOnPing: !!appSettings?.telegramNotifyOnPing,
          notifyOnFailure: appSettings?.telegramNotifyOnFailure !== false, // default true
        },
        bannedUsers: formattedBans,
      });
    }

    // POST: Manage bot actions (send notification, ban user, unban user, update preferences)
    if (event.httpMethod === 'POST') {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, { status: 'error', message: 'Malformed JSON payload' });
      }

      const { action } = body;

      // 1. Send Notification
      if (action === 'send_notification') {
        const { chatId, message, parseMode = 'Markdown' } = body;
        if (!chatId || !message) {
          return jsonResponse(400, {
            status: 'error',
            message: 'Target Chat ID and message are required',
          });
        }

        const cleanChatId = String(chatId).trim();

        // Check if destination user is banned
        const isBanned = await bansCol.findOne({ userId: cleanChatId });
        if (isBanned) {
          return jsonResponse(400, {
            status: 'error',
            message: `Cannot send message: User ID ${cleanChatId} is banned.`,
          });
        }

        const telegramRes = await callTelegramApi('sendMessage', {
          chat_id: cleanChatId,
          text: message,
          parse_mode: parseMode,
        });

        if (!telegramRes.ok) {
          return jsonResponse(400, {
            status: 'error',
            message: telegramRes.description || 'Telegram API failed to dispatch message',
          });
        }

        // Store default chat ID for convenience
        await settingsCol.updateOne(
          {},
          { $set: { telegramDefaultChatId: cleanChatId, updatedAt: new Date() } },
          { upsert: true }
        );

        return jsonResponse(200, {
          status: 'success',
          message: 'Telegram notification delivered successfully!',
          result: telegramRes.result,
        });
      }

      // 2. Ban Telegram User
      if (action === 'ban_user') {
        const { userId, username, reason } = body;
        if (!userId) {
          return jsonResponse(400, {
            status: 'error',
            message: 'Telegram User ID is required to ban a user',
          });
        }

        const cleanUserId = String(userId).trim();
        const existing = await bansCol.findOne({ userId: cleanUserId });

        if (existing) {
          return jsonResponse(400, {
            status: 'error',
            message: `User ${cleanUserId} is already banned`,
          });
        }

        await bansCol.insertOne({
          userId: cleanUserId,
          username: (username || '').trim().replace(/^@/, ''),
          reason: (reason || 'Banned by admin').trim(),
          bannedAt: new Date(),
          bannedBy: decoded.username || 'admin',
        });

        // Optionally send ban alert to that chat if possible
        try {
          await callTelegramApi('sendMessage', {
            chat_id: cleanUserId,
            text: `🚫 *You have been banned from using this bot.*\n*Reason:* ${reason || 'Administrative restriction.'}`,
            parse_mode: 'Markdown',
          });
        } catch (e) {
          // Ignore if user blocked bot or invalid chat
        }

        return jsonResponse(200, {
          status: 'success',
          message: `Telegram user ${cleanUserId} banned successfully`,
        });
      }

      // 3. Unban Telegram User
      if (action === 'unban_user') {
        const { userId } = body;
        if (!userId) {
          return jsonResponse(400, { status: 'error', message: 'User ID is required' });
        }

        const cleanUserId = String(userId).trim();
        const deleteResult = await bansCol.deleteOne({ userId: cleanUserId });

        if (deleteResult.deletedCount === 0) {
          return jsonResponse(404, { status: 'error', message: 'User was not in banned list' });
        }

        try {
          await callTelegramApi('sendMessage', {
            chat_id: cleanUserId,
            text: `✅ *Your ban has been lifted.* You can now interact with the MongoDB Keep Alive Bot again.`,
            parse_mode: 'Markdown',
          });
        } catch (e) {
          // Ignore if failed
        }

        return jsonResponse(200, {
          status: 'success',
          message: `User ${cleanUserId} unbanned successfully`,
        });
      }

      // 4. Update Telegram Notification Preferences
      if (action === 'update_settings') {
        const { defaultChatId, notifyOnPing, notifyOnFailure } = body;
        const updates = { updatedAt: new Date() };

        if (typeof defaultChatId === 'string') updates.telegramDefaultChatId = defaultChatId.trim();
        if (typeof notifyOnPing === 'boolean') updates.telegramNotifyOnPing = notifyOnPing;
        if (typeof notifyOnFailure === 'boolean') updates.telegramNotifyOnFailure = notifyOnFailure;

        await settingsCol.updateOne({}, { $set: updates }, { upsert: true });

        return jsonResponse(200, {
          status: 'success',
          message: 'Telegram settings saved successfully',
        });
      }

      return jsonResponse(400, { status: 'error', message: `Unknown action: ${action}` });
    }

    return jsonResponse(405, { status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Telegram function error:', error);
    return jsonResponse(500, {
      status: 'error',
      message: 'Failed to process Telegram request',
      details: error.message,
    });
  }
};
