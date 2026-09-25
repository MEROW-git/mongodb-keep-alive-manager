const { connectToDatabase } = require('./mongodb');
require('dotenv').config();

const BOT_TOKEN = process.env.telegram_bot || process.env.TELEGRAM_BOT_TOKEN;

/**
 * Send a Telegram message safely with HTML formatting and plain text fallback
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN || !chatId) return null;

  const payload = {
    chat_id: String(chatId),
    text,
    parse_mode: options.parseMode || 'HTML',
    ...(options.reply_markup ? { reply_markup: options.reply_markup } : {}),
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      // Fallback without parse_mode if formatting has issues
      const plainText = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '');
      const retryRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(chatId),
          text: plainText,
          ...(options.reply_markup ? { reply_markup: options.reply_markup } : {}),
        }),
      });
      return await retryRes.json();
    }
    return data;
  } catch (err) {
    console.error('sendTelegramMessage error:', err.message);
    return null;
  }
}

/**
 * Dispatch automatic notification when keep-alive ping succeeds.
 * Supports single database or multi-database summary results.
 */
async function notifyPingSuccess({
  latencyMs,
  dbName = 'system_reset',
  target = 'MongoDB',
  source = 'KEEP_ALIVE_PULSE',
  results = null,
}) {
  if (!BOT_TOKEN) return;

  try {
    const { db } = await connectToDatabase();
    const settings = await db.collection('settings').findOne({});

    // If auto ping notifications are globally disabled in settings, skip
    if (settings && settings.telegramNotifyOnPing === false) {
      return;
    }

    const usersCol = db.collection('telegram_users');
    const bansCol = db.collection('telegram_bans');

    const [allowedUsers, bannedUsers] = await Promise.all([
      usersCol.find({ isAllowed: true, receiveNotifications: { $ne: false } }).toArray(),
      bansCol.find({}).toArray(),
    ]);

    const bannedSet = new Set(bannedUsers.map((b) => b.userId));

    // Compile unique recipients
    const recipientChatIds = new Set();

    for (const u of allowedUsers) {
      if (!bannedSet.has(u.userId)) {
        recipientChatIds.add(String(u.chatId || u.userId));
      }
    }

    // Include default chat ID from settings if configured and not banned
    if (settings?.telegramDefaultChatId && !bannedSet.has(settings.telegramDefaultChatId)) {
      recipientChatIds.add(String(settings.telegramDefaultChatId));
    }

    if (recipientChatIds.size === 0) {
      return;
    }

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });

    let notificationMessage = '';

    if (Array.isArray(results) && results.length > 0) {
      const anyFailed = results.some((r) => r.status === 'FAILED');
      const headerIcon = anyFailed ? '⚠️' : '🟢';
      const headerTitle = anyFailed ? 'Keep-Alive Warning' : 'Keep-Alive Pulse Confirmed';

      const lines = results.map((r) => {
        const icon = r.target === 'PostgreSQL' ? '🐘' : '🍃';
        if (r.status === 'SUCCESS') {
          return `${icon} <b>${r.target}:</b> <code>${r.database || r.dbName}</code> (<code>${r.responseTime}ms</code>) - <b>ONLINE</b>`;
        } else {
          return `${icon} <b>${r.target}:</b> <code>${r.database || r.dbName}</code> - <b>FAILED</b> (<i>${r.error || 'Timeout'}</i>)`;
        }
      });

      notificationMessage =
        `${headerIcon} <b>${headerTitle}</b>\n\n` +
        lines.join('\n') +
        `\n\n📡 <b>Source:</b> <code>${source}</code>\n` +
        `🕒 <b>Timestamp:</b> <code>${timeStr}</code>\n\n` +
        `🛡️ <i>All scheduled databases pinged and active.</i>`;
    } else {
      const dbIcon = target === 'PostgreSQL' ? '🐘' : '🍃';
      notificationMessage =
        `🟢 <b>${target} Keep-Alive Successful!</b>\n\n` +
        `${dbIcon} <b>Database:</b> <code>${dbName}</code>\n` +
        `⚡ <b>Status:</b> <b>ONLINE &amp; HEALTHY</b>\n` +
        `⏱ <b>Latency:</b> <code>${latencyMs} ms</code>\n` +
        `📡 <b>Source:</b> <code>${source}</code>\n` +
        `🕒 <b>Timestamp:</b> <code>${timeStr}</code>\n\n` +
        `🛡️ <i>Keep-alive pulse confirmed. Database active.</i>`;
    }

    for (const chatId of recipientChatIds) {
      try {
        await sendTelegramMessage(chatId, notificationMessage);
      } catch (err) {
        console.error(`Failed to send ping notification to ${chatId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('notifyPingSuccess error:', err.message);
  }
}

module.exports = {
  sendTelegramMessage,
  notifyPingSuccess,
};
