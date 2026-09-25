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
 * Common Reply Keyboard for authorized users
 */
const AUTHORIZED_KEYBOARD = {
  keyboard: [
    [{ text: '🟢 Cluster Status' }, { text: '⚡ Instant Ping' }],
    [{ text: '🆔 My ID' }, { text: '❓ Help' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

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
        isAllowed: false, // Default is pending approval!
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

  // 4. Access Gate: Check if user is allowed / authorized by Admin
  if (!isAllowed) {
    if (text.startsWith('/start') || text.startsWith('/help')) {
      const warmWelcomeText =
        `✨ <b>Hello, ${escapeHtml(firstName || displayName)}! Warm welcome!</b> 🐱👋\n\n` +
        `I am your <b>MongoDB Keep-Alive Assistant</b>.\n\n` +
        `⏳ <b>Access Status: Pending Administrator Approval</b>\n\n` +
        `🔒 <i>To protect database resources and keep monitoring secure, all new users must be authorized by an administrator in the Keep-Alive Dashboard before access is granted.</i>\n\n` +
        `Your connection has been detected. Once the administrator approves your access, you will receive full cluster details, your account identity, and your interactive control buttons!`;

      await sendSafeTelegramMessage(chatId, warmWelcomeText);
      return { status: 'pending_approval_welcome', userId };
    }

    // Any other text or command while unauthorized
    const pendingNotice =
      `🔒 <b>Authorization Required</b>\n\n` +
      `Hello ${escapeHtml(firstName || displayName)}! Your account is currently waiting for administrator approval in the Keep-Alive Dashboard.\n\n` +
      `Please ask the dashboard administrator to click <b>"Allow Access"</b> for your user.`;

    await sendSafeTelegramMessage(chatId, pendingNotice);
    return { status: 'unauthorized', userId };
  }

  // 5. Authorized User Handlers
  const isStatus = text.startsWith('/status') || text.includes('Cluster Status');
  const isPing = text.startsWith('/ping') || text.includes('Instant Ping');
  const isId = text.startsWith('/id') || text.includes('My ID');
  const isHelp = text.startsWith('/help') || text.includes('Help');

  if (text.startsWith('/start') || isHelp) {
    const authorizedWelcome =
      `✨ <b>Welcome back, ${escapeHtml(firstName || displayName)}!</b> 🐱🟢\n\n` +
      `Your account is <b>Authorized</b> to interact with MongoDB cluster <code>${dbName}</code>.\n\n` +
      `⚡ <b>Quick Actions:</b>\n` +
      `• Tap <b>🟢 Cluster Status</b> to inspect database latency\n` +
      `• Tap <b>⚡ Instant Ping</b> to verify connection &amp; keep alive\n` +
      `• Tap <b>🆔 My ID</b> to view your Telegram Chat ID\n\n` +
      `🔔 <i>You are also subscribed to automated notifications whenever the database is pinged successfully!</i>`;

    await sendSafeTelegramMessage(chatId, authorizedWelcome, {
      reply_markup: AUTHORIZED_KEYBOARD,
    });
    return { status: 'authorized_welcome', userId };
  }

  if (isId) {
    await sendSafeTelegramMessage(
      chatId,
      `🆔 <b>Your Telegram Identity:</b>\n\n` +
      `• <b>Chat ID:</b> <code>${chatId}</code>\n` +
      `• <b>User ID:</b> <code>${userId}</code>\n` +
      `• <b>Authorization:</b> 🟢 <b>Allowed &amp; Active</b>\n` +
      `• <b>Keep-Alive Alerts:</b> Subscribed`,
      { reply_markup: AUTHORIZED_KEYBOARD }
    );
    return { status: 'id_sent', userId };
  }

  if (isPing || isStatus) {
    const pingStart = Date.now();
    await db.command({ ping: 1 });
    const latency = Date.now() - pingStart;

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const statusText =
      `🟢 <b>MongoDB Atlas Status: ONLINE</b>\n\n` +
      `• <b>Database:</b> <code>${dbName}</code>\n` +
      `• <b>Cluster Status:</b> <b>HEALTHY &amp; OPERATIONAL</b>\n` +
      `• <b>Response Latency:</b> <code>${latency} ms</code>\n` +
      `• <b>Executed by:</b> ${escapeHtml(displayName)}\n` +
      `• <b>Timestamp:</b> <code>${timeStr}</code>\n\n` +
      `✨ <i>Keep-alive connection verified active.</i>`;

    await sendSafeTelegramMessage(chatId, statusText, {
      reply_markup: AUTHORIZED_KEYBOARD,
    });
    return { status: 'status_sent', userId, latency };
  }

  // Conversational response with control keyboard
  if (text) {
    await sendSafeTelegramMessage(
      chatId,
      `🤖 <b>MongoDB Keep-Alive Assistant</b>\n\n` +
      `Received: <i>"${escapeHtml(text)}"</i>\n\n` +
      `Tap the buttons below to check cluster latency or run an instant keep-alive ping!`,
      { reply_markup: AUTHORIZED_KEYBOARD }
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

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Handle Telegram Incoming Webhook
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
    const messagesCol = db.collection('telegram_messages');
    const settingsCol = db.collection('settings');

    // Automatically drain pending updates on GET or sync request
    await syncTelegramUpdates(db);

    // GET: Retrieve bot status, settings, detected users, chat messages, and banned users list
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

      const [bannedUsers, detectedUsers, recentMessages, appSettings] = await Promise.all([
        bansCol.find({}).sort({ bannedAt: -1 }).toArray(),
        usersCol.find({}).sort({ lastActive: -1 }).limit(50).toArray(),
        messagesCol.find({}).sort({ createdAt: -1 }).limit(30).toArray(),
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
        isAllowed: !!u.isAllowed,
        receiveNotifications: u.receiveNotifications !== false,
        isBanned: bannedMap.has(u.userId),
      }));

      const formattedMessages = recentMessages.map((m) => ({
        id: m._id.toString(),
        userId: m.userId,
        chatId: m.chatId,
        username: m.username,
        displayName: m.displayName,
        text: m.text,
        isCommand: !!m.isCommand,
        time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-US') : 'N/A',
        date: m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-US') : 'N/A',
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
        recentMessages: formattedMessages,
        bannedUsers: formattedBans,
      });
    }

    // POST: Manage bot actions (allow user, send notification, ban user, unban user, update preferences, sync)
    if (event.httpMethod === 'POST') {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, { status: 'error', message: 'Malformed JSON payload' });
      }

      const { action } = body;

      // 1. Allow / Approve or Revoke User Access
      if (action === 'allow_user') {
        const { userId, allow, receiveNotifications } = body;
        if (!userId) {
          return jsonResponse(400, { status: 'error', message: 'User ID is required' });
        }

        const cleanUserId = String(userId).trim();
        const isAllow = allow !== false;

        await usersCol.updateOne(
          { userId: cleanUserId },
          {
            $set: {
              isAllowed: isAllow,
              receiveNotifications: receiveNotifications !== undefined ? !!receiveNotifications : true,
              approvedAt: isAllow ? new Date() : null,
              approvedBy: isAllow ? (decoded.username || 'admin') : null,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        const targetUser = await usersCol.findOne({ userId: cleanUserId });
        const targetChatId = targetUser?.chatId || cleanUserId;
        const targetName = targetUser?.firstName || targetUser?.displayName || cleanUserId;

        if (isAllow) {
          const dbName = process.env.MONGO_DB_NAME || 'system_reset';
          const approvalText =
            `🎉 <b>Authorization Approved! Full Access Granted!</b> 🐱🚀\n\n` +
            `Hello <b>${escapeHtml(targetName)}</b>! The administrator has <b>approved your account</b> for the MongoDB Keep-Alive Assistant!\n\n` +
            `📋 <b>Your Access Details:</b>\n` +
            `• <b>Target Database:</b> <code>${dbName}</code>\n` +
            `• <b>Your Telegram User ID:</b> <code>${cleanUserId}</code>\n` +
            `• <b>Your Chat ID:</b> <code>${targetChatId}</code>\n` +
            `• <b>Status:</b> 🟢 <b>Active &amp; Authorized</b>\n` +
            `• <b>Auto-Ping Alerts:</b> Subscribed 🔔\n\n` +
            `⚡ <b>Commands &amp; Interactive Buttons:</b>\n` +
            `• Tap <b>🟢 Cluster Status</b> to inspect database latency\n` +
            `• Tap <b>⚡ Instant Ping</b> to verify connection &amp; keep alive\n` +
            `• Tap <b>🆔 My ID</b> to view your Chat ID\n\n` +
            `✨ <i>You will now receive automatic notifications whenever the database is pinged successfully!</i>`;

          await sendSafeTelegramMessage(targetChatId, approvalText, {
            reply_markup: AUTHORIZED_KEYBOARD,
          });
        } else {
          await sendSafeTelegramMessage(
            targetChatId,
            `🔒 <b>Access Updated:</b> Your access to commands and keep-alive alerts has been revoked or set to pending by the administrator.`,
            { reply_markup: { remove_keyboard: true } }
          );
        }

        return jsonResponse(200, {
          status: 'success',
          message: isAllow ? `User ${cleanUserId} authorized successfully!` : `User ${cleanUserId} access revoked.`,
          isAllowed: isAllow,
        });
      }

      // 2. Toggle Auto-Ping Notifications for a user
      if (action === 'toggle_notifications') {
        const { userId, receiveNotifications } = body;
        const cleanUserId = String(userId).trim();

        await usersCol.updateOne(
          { userId: cleanUserId },
          { $set: { receiveNotifications: !!receiveNotifications, updatedAt: new Date() } }
        );

        return jsonResponse(200, {
          status: 'success',
          message: `Notifications for ${cleanUserId} updated`,
          receiveNotifications: !!receiveNotifications,
        });
      }

      // 3. Manual Sync Updates
      if (action === 'sync_updates') {
        const syncResult = await syncTelegramUpdates(db);
        return jsonResponse(200, {
          status: 'success',
          message: `Synced ${syncResult.processed || 0} Telegram updates`,
          result: syncResult,
        });
      }

      // 4. Send Notification
      if (action === 'send_notification') {
        const { chatId, message, parseMode = 'HTML' } = body;
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

        const telegramRes = await sendSafeTelegramMessage(cleanChatId, message, { parseMode });

        // Store default chat ID for convenience
        await settingsCol.updateOne(
          {},
          { $set: { telegramDefaultChatId: cleanChatId, updatedAt: new Date() } },
          { upsert: true }
        );

        return jsonResponse(200, {
          status: 'success',
          message: 'Telegram notification delivered successfully!',
          result: telegramRes,
        });
      }

      // 5. Ban Telegram User
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

        // Revoke access as well
        await usersCol.updateOne(
          { userId: cleanUserId },
          { $set: { isAllowed: false } }
        );

        // Optionally send ban alert to that chat
        try {
          await sendSafeTelegramMessage(
            cleanUserId,
            `🚫 <b>You have been banned from using this bot.</b>\n<b>Reason:</b> ${escapeHtml(reason || 'Administrative restriction.')}`,
            { reply_markup: { remove_keyboard: true } }
          );
        } catch (e) {
          // Ignore if user blocked bot
        }

        return jsonResponse(200, {
          status: 'success',
          message: `Telegram user ${cleanUserId} banned successfully`,
        });
      }

      // 6. Unban Telegram User
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
          await sendSafeTelegramMessage(
            cleanUserId,
            `✅ <b>Your ban has been lifted.</b> You can now interact with the MongoDB Keep Alive Bot again.`
          );
        } catch (e) {
          // Ignore if failed
        }

        return jsonResponse(200, {
          status: 'success',
          message: `User ${cleanUserId} unbanned successfully`,
        });
      }

      // 7. Update Telegram Notification Preferences
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
