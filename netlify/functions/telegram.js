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

/**
 * Send Telegram message with safe HTML fallback
 */
async function sendSafeTelegramMessage(chatId, text, parseMode = 'HTML') {
  try {
    const res = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    });
    if (res.ok) return res;
    // If markdown/html parsing fails, strip tags and send as plain text
    const plainText = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '');
    return await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: plainText,
    });
  } catch (err) {
    const plainText = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '');
    return await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: plainText,
    });
  }
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

  const bansCol = db.collection('telegram_bans');
  const usersCol = db.collection('telegram_users');

  // Record or update user in detected list
  await usersCol.updateOne(
    { userId },
    {
      $set: {
        userId,
        chatId: String(chatId),
        username: username.replace(/^@/, ''),
        firstName,
        lastName,
        displayName: [firstName, lastName].filter(Boolean).join(' ') || username || `User ${userId}`,
        lastMessage: text,
        lastActive: new Date(),
      },
      $setOnInsert: {
        firstSeen: new Date(),
      },
    },
    { upsert: true }
  );

  // Check if user is banned
  const ban = await bansCol.findOne({ userId });
  if (ban) {
    await sendSafeTelegramMessage(
      chatId,
      `🚫 <b>Access Denied</b>\nYou have been banned from using this bot.\n<b>Reason:</b> ${ban.reason || 'Restricted by administrator'}`
    );
    return { status: 'banned', userId };
  }

  // Handle Telegram Commands
  if (text.startsWith('/start') || text.startsWith('/help')) {
    const dbName = process.env.MONGO_DB_NAME || 'system_reset';
    const welcomeText =
      `👋 <b>Welcome to MongoDB Keep Alive Bot!</b>\n\n` +
      `• <b>Your Chat ID:</b> <code>${chatId}</code>\n` +
      `• <b>Your User ID:</b> <code>${userId}</code>\n` +
      `• <b>Database Target:</b> <code>${dbName}</code>\n` +
      `• <b>Status:</b> 🟢 <b>Connected &amp; Active</b>\n\n` +
      `<b>Available Commands:</b>\n` +
      `• <code>/status</code> - View current MongoDB cluster health &amp; latency\n` +
      `• <code>/ping</code> - Execute instant keep-alive ping\n` +
      `• <code>/id</code> - Show your Telegram Chat ID\n\n` +
      `<i>Your user account is now detected in the Keep-Alive Dashboard.</i>`;

    await sendSafeTelegramMessage(chatId, welcomeText);
    return { status: 'welcomed', userId };
  }

  if (text.startsWith('/id')) {
    await sendSafeTelegramMessage(
      chatId,
      `🆔 <b>Your Telegram Chat ID:</b> <code>${chatId}</code>\n\nUse this Chat ID in the admin dashboard to receive keep-alive alerts.`
    );
    return { status: 'id_sent', userId };
  }

  if (text.startsWith('/ping') || text.startsWith('/status')) {
    const pingStart = Date.now();
    await db.command({ ping: 1 });
    const latency = Date.now() - pingStart;

    const dbName = process.env.MONGO_DB_NAME || 'system_reset';
    const statusText =
      `🟢 <b>MongoDB Atlas Status: ONLINE</b>\n\n` +
      `• <b>Database:</b> <code>${dbName}</code>\n` +
      `• <b>Cluster:</b> Production Atlas\n` +
      `• <b>Latency:</b> <code>${latency} ms</code>\n` +
      `• <b>Timestamp:</b> <code>${new Date().toISOString()}</code>\n\n` +
      `Keep-Alive bot is actively monitoring your cluster.`;

    await sendSafeTelegramMessage(chatId, statusText);
    return { status: 'status_sent', userId, latency };
  }

  // Generic conversational response
  if (text) {
    await sendSafeTelegramMessage(
      chatId,
      `🤖 <b>MongoDB Keep Alive Bot</b>\n\nType <code>/status</code> to check cluster health or <code>/id</code> to get your Chat ID.`
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
exports.processTelegramMessage = processTelegramMessage;
exports.syncTelegramUpdates = syncTelegramUpdates;

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Handle Telegram Incoming Webhook (called by Telegram server if webhook is registered)
  const isWebhook = event.queryStringParameters?.action === 'webhook' || event.path?.includes('webhook');
  if (isWebhook && event.httpMethod === 'POST') {
    let update = {};
    try {
      update = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(200, { ok: true });
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
    const usersCol = db.collection('telegram_users');
    const settingsCol = db.collection('settings');

    // Automatically drain pending updates on GET or sync request
    await syncTelegramUpdates(db);

    // GET: Retrieve bot status, settings, detected users, and banned users list
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

      const [bannedUsers, detectedUsers, appSettings] = await Promise.all([
        bansCol.find({}).sort({ bannedAt: -1 }).toArray(),
        usersCol.find({}).sort({ lastActive: -1 }).limit(50).toArray(),
        settingsCol.findOne({}),
      ]);

      const bannedMap = new Set(bannedUsers.map((b) => b.userId));

      const formattedBans = bannedUsers.map((b) => ({
        id: b._id.toString(),
        userId: b.userId,
        username: b.username || 'Unknown',
        reason: b.reason || 'No reason specified',
        bannedAt: b.bannedAt ? new Date(b.bannedAt).toLocaleString('en-US') : 'N/A',
        bannedBy: b.bannedBy || 'admin',
      }));

      const formattedDetected = detectedUsers.map((u) => ({
        id: u._id.toString(),
        userId: u.userId,
        chatId: u.chatId || u.userId,
        username: u.username || '',
        displayName: u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || `User ${u.userId}`,
        lastMessage: u.lastMessage || '',
        lastActive: u.lastActive ? new Date(u.lastActive).toLocaleString('en-US') : 'N/A',
        firstSeen: u.firstSeen ? new Date(u.firstSeen).toLocaleString('en-US') : 'N/A',
        isBanned: bannedMap.has(u.userId),
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
        detectedUsers: formattedDetected,
        bannedUsers: formattedBans,
      });
    }

    // POST: Manage bot actions (send notification, ban user, unban user, update preferences, sync)
    if (event.httpMethod === 'POST') {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, { status: 'error', message: 'Malformed JSON payload' });
      }

      const { action } = body;

      // 1. Manual Sync Updates
      if (action === 'sync_updates') {
        const syncResult = await syncTelegramUpdates(db);
        return jsonResponse(200, {
          status: 'success',
          message: `Synced ${syncResult.processed || 0} Telegram updates`,
          result: syncResult,
        });
      }

      // 2. Send Notification
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

      // 3. Ban Telegram User
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

      // 4. Unban Telegram User
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

      // 5. Update Telegram Notification Preferences
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
