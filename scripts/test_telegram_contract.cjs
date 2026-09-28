const assert = require('node:assert/strict');

const { formatTelegramAdminState } = require('../netlify/functions/telegram');

const response = formatTelegramAdminState({
  settings: {
    telegramDefaultChatId: '12345',
    telegramNotifyOnPing: true,
    telegramNotifyOnFailure: false,
  },
  users: [{
    _id: { toString: () => 'user-document-id' },
    userId: '42',
    chatId: '12345',
    username: 'tester',
    displayName: 'Test User',
    lastMessage: '/start',
    lastActive: new Date(0),
    firstSeen: new Date(0),
    isAllowed: true,
    receiveNotifications: true,
    internalSecret: 'must-not-leak',
  }],
  bans: [],
  recentMessages: [{
    _id: { toString: () => 'message-document-id' },
    userId: '42',
    chatId: '12345',
    username: 'tester',
    displayName: 'Test User',
    text: '/start',
    isCommand: true,
    createdAt: new Date(0),
    internalSecret: 'must-not-leak',
  }],
  bot: {
    configured: true,
    connected: true,
    info: { id: 1, first_name: 'Keep Alive', username: 'keep_alive_bot' },
    error: null,
  },
});

assert.equal(response.status, 'success');
assert.equal(response.bot.connected, true);
assert.equal(response.bot.info.username, 'keep_alive_bot');
assert.equal(response.settings.defaultChatId, '12345');
assert.equal(response.settings.notifyOnFailure, false);
assert.equal(response.detectedUsers.length, 1);
assert.equal(response.detectedUsers[0].isAllowed, true);
assert.equal(response.recentMessages.length, 1);
assert.equal(response.recentMessages[0].isCommand, true);

// Backward-compatible aliases remain available without returning raw documents.
assert.equal(response.configured, true);
assert.equal(response.users.length, 1);
assert.equal(response.bans.length, 0);
assert.equal(JSON.stringify(response).includes('must-not-leak'), false);

console.log('Telegram API contract checks passed: live bot status and dashboard collections use the expected safe response shape.');
