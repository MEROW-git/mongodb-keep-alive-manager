import React, { useState, useEffect } from 'react';
import {
  Send,
  ShieldAlert,
  Bot,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Bell,
  BellOff,
  RefreshCw,
  Trash2,
  Save,
  HelpCircle,
  Users,
  Copy,
  Check,
  Clock,
  Zap,
  Lock,
  Unlock,
} from 'lucide-react';
import api from '../services/api';

export default function TelegramBot() {
  const [botData, setBotData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [chatId, setChatId] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);
  const [notifyOnPing, setNotifyOnPing] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Ban User form state
  const [banUserId, setBanUserId] = useState('');
  const [banUsername, setBanUsername] = useState('');
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  // Action loading state for user approvals
  const [processingUserId, setProcessingUserId] = useState(null);

  const [copiedId, setCopiedId] = useState(null);
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  const showFeedback = (text, type = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback({ text: '', type: '' }), 5000);
  };

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.getTelegramData();
      setBotData(data);
      if (data.settings?.defaultChatId && !chatId) {
        setChatId(data.settings.defaultChatId);
      }
      setNotifyOnFailure(data.settings?.notifyOnFailure !== false);
      setNotifyOnPing(data.settings?.notifyOnPing !== false); // Default to true so auto-ping alerts are received
    } catch (err) {
      showFeedback('Failed to load Telegram bot data: ' + err.message, 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Sync Telegram updates manually
  const handleSyncUpdates = async () => {
    setIsSyncing(true);
    try {
      await api.syncTelegramUpdates();
      await loadData(true);
      showFeedback('Telegram updates synchronized! Detected users refreshed.', 'success');
    } catch (err) {
      showFeedback('Failed to sync updates: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh updates every 3 seconds so incoming chat messages stream in live
    const interval = setInterval(() => {
      loadData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Allow or Revoke User Access
  const handleToggleAllowUser = async (user, allow) => {
    setProcessingUserId(user.userId);
    try {
      const res = await api.allowTelegramUser({
        userId: user.userId,
        allow,
        receiveNotifications: true,
      });
      showFeedback(
        allow
          ? `🎉 Authorized user ${user.displayName || user.userId}! Control buttons & welcome sent to Telegram.`
          : `Access revoked for user ${user.displayName || user.userId}.`,
        'success'
      );
      await loadData(true);
    } catch (err) {
      showFeedback(err.message || 'Failed to update user authorization', 'error');
    } finally {
      setProcessingUserId(null);
    }
  };

  // Toggle Auto-Ping Notifications for a user
  const handleToggleNotifications = async (user) => {
    setProcessingUserId(user.userId);
    const nextState = !user.receiveNotifications;
    try {
      await api.toggleTelegramNotifications({
        userId: user.userId,
        receiveNotifications: nextState,
      });
      showFeedback(
        nextState
          ? `Auto-ping alerts enabled for ${user.displayName || user.userId} 🔔`
          : `Auto-ping alerts muted for ${user.displayName || user.userId} 🔕`,
        'success'
      );
      await loadData(true);
    } catch (err) {
      showFeedback(err.message || 'Failed to toggle notifications', 'error');
    } finally {
      setProcessingUserId(null);
    }
  };

  // Send Notification
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatId.trim() || !message.trim()) {
      showFeedback('Please provide both Chat ID and Message.', 'error');
      return;
    }

    setIsSending(true);
    try {
      await api.sendTelegramNotification({
        chatId: chatId.trim(),
        message: message.trim(),
        parseMode: 'HTML',
      });
      showFeedback('Telegram notification sent successfully!', 'success');
      setMessage('');
    } catch (err) {
      showFeedback(err.message || 'Failed to dispatch Telegram message.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Save Preferences
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await api.updateTelegramSettings({
        defaultChatId: chatId.trim(),
        notifyOnFailure,
        notifyOnPing,
      });
      showFeedback('Telegram preferences saved successfully!', 'success');
    } catch (err) {
      showFeedback('Failed to update settings: ' + err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Ban User
  const handleBanUser = async (e) => {
    e?.preventDefault();
    if (!banUserId.trim()) {
      showFeedback('Please provide a Telegram User ID to ban.', 'error');
      return;
    }

    setIsBanning(true);
    try {
      await api.banTelegramUser({
        userId: banUserId.trim(),
        username: banUsername.trim(),
        reason: banReason.trim() || 'Restricted by administrator',
      });
      showFeedback(`User ${banUserId.trim()} has been banned from the bot.`, 'success');
      setBanUserId('');
      setBanUsername('');
      setBanReason('');
      await loadData(true);
    } catch (err) {
      showFeedback(err.message || 'Failed to ban user.', 'error');
    } finally {
      setIsBanning(false);
    }
  };

  // Unban User
  const handleUnbanUser = async (userId) => {
    try {
      await api.unbanTelegramUser(userId);
      showFeedback(`User ${userId} unbanned successfully!`, 'success');
      await loadData(true);
    } catch (err) {
      showFeedback(err.message || 'Failed to unban user.', 'error');
    }
  };

  // Copy ID to clipboard
  const handleCopy = (idText) => {
    navigator.clipboard?.writeText(idText);
    setCopiedId(idText);
    setTimeout(() => setCopiedId(null), 2000);
    showFeedback(`Copied ID ${idText} to clipboard!`);
  };

  // Pre-fill ban form
  const handlePreFillBan = (user) => {
    setBanUserId(user.userId);
    setBanUsername(user.username || '');
    setBanReason('Restricted by administrator');
    const el = document.getElementById('ban-user-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    showFeedback(`Pre-filled ban form for ${user.displayName || user.userId}`);
  };

  // Preset Message Helper
  const applyPreset = (presetText) => {
    setMessage(presetText);
  };

  const botInfo = botData?.bot?.info;
  const isConnected = botData?.bot?.connected;
  const detectedUsers = botData?.detectedUsers || [];
  const recentMessages = botData?.recentMessages || [];
  const bannedUsers = botData?.bannedUsers || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Banner / Bot Status Header */}
      <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-white">Telegram Bot Control</h1>
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isConnected
                    ? 'bg-mongo/10 text-mongo border border-mongo/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-mongo animate-ping' : 'bg-red-500'}`} />
                <span>{isConnected ? 'BOT CONNECTED' : 'BOT DISCONNECTED'}</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              User authorization gate, live incoming chat detection, interactive buttons, and automated ping notifications.
            </p>
          </div>
        </div>

        {/* Bot Identity Details Pill & Sync Controls */}
        <div className="flex items-center space-x-2">
          {botInfo && (
            <div className="flex items-center space-x-3 bg-gray-900/90 border border-gray-800/90 px-3.5 py-2 rounded-xl text-xs font-mono">
              <div>
                <div className="text-white font-bold">{botInfo.first_name}</div>
                <a
                  href={`https://t.me/${botInfo.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center space-x-1 text-[11px]"
                >
                  <span>@{botInfo.username}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          <button
            onClick={handleSyncUpdates}
            disabled={isSyncing}
            title="Sync Telegram updates from server"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium border border-gray-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isLoading ? 'animate-spin text-mongo' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Updates'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-mongo/10 border-mongo/30 text-mongo'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* DETECTED TELEGRAM USERS / SUBSCRIBERS TABLE WITH ACCESS APPROVAL */}
      <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-mongo/10 border border-mongo/30 text-mongo">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Detected Telegram Users & Access Approvals
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-mongo/20 text-mongo border border-mongo/30">
                  {detectedUsers.length} detected
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Authorize users to unlock bot commands (<code>/ping</code>, <code>/status</code>, interactive buttons) and dispatch auto-ping notifications.
              </p>
            </div>
          </div>

          <button
            onClick={handleSyncUpdates}
            disabled={isSyncing}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-medium text-gray-300 hover:text-white transition flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-mongo' : ''}`} />
            <span>Refresh Users</span>
          </button>
        </div>

        <div className="rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-[#0B1120] text-gray-400 font-mono text-[10px] uppercase border-b border-gray-800">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap min-w-[150px]">User</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[110px]">User ID</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Latest Message</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[150px]">Access Status</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Auto-Ping Alerts</th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[210px] text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono text-[11px]">
              {detectedUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500 font-sans text-xs">
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="text-gray-400 font-medium">No Telegram users detected yet.</p>
                      <p className="text-[11px] text-gray-500">
                        Open Telegram, search for{' '}
                        <a
                          href={`https://t.me/${botInfo?.username || 'meow_db_notification_bot'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 underline font-mono"
                        >
                          @{botInfo?.username || 'meow_db_notification_bot'}
                        </a>{' '}
                        and send <code className="text-mongo bg-gray-900 px-1 py-0.5 rounded">/start</code>.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                detectedUsers.map((user) => {
                  const isProcessing = processingUserId === user.userId;

                  return (
                    <tr key={user.id} className="hover:bg-gray-800/30 transition">
                      {/* User display name + username */}
                      <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-mongo/20 to-blue-500/20 border border-mongo/30 flex items-center justify-center text-mongo font-bold text-xs shrink-0">
                            {(user.displayName || user.username || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center space-x-1.5">
                              <span>{user.displayName}</span>
                              {user.isAllowed && (
                                <span title="Authorized user" className="text-mongo text-xs">✓</span>
                              )}
                            </div>
                            {user.username && (
                              <div className="text-[10px] text-blue-400 font-mono">@{user.username}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* User ID */}
                      <td className="py-3.5 px-4 text-gray-300 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-white font-semibold">{user.userId}</span>
                          <button
                            onClick={() => handleCopy(user.userId)}
                            title="Copy User ID"
                            className="p-1 text-gray-500 hover:text-mongo transition"
                          >
                            {copiedId === user.userId ? (
                              <Check className="w-3 h-3 text-mongo" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Latest Message & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-300 text-[10px] font-mono inline-block max-w-[150px] truncate" title={user.lastMessage}>
                            {user.lastMessage || 'None'}
                          </span>
                          <div className="text-[10px] text-gray-500 font-sans">{user.lastActive}</div>
                        </div>
                      </td>

                      {/* Access Status Badge (whitespace-nowrap prevents line breaks) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {user.isBanned ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                            <span>Banned</span>
                          </span>
                        ) : user.isAllowed ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-mongo/10 text-mongo border border-mongo/30 whitespace-nowrap shadow-[0_0_10px_rgba(0,237,100,0.15)]">
                            <span className="w-2 h-2 rounded-full bg-mongo shrink-0" />
                            <span>Authorized 🟢</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            <span>Pending Approval ⏳</span>
                          </span>
                        )}
                      </td>

                      {/* Auto-Ping Alerts Toggle */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {!user.isAllowed ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-mono text-gray-500 bg-gray-900 border border-gray-800 whitespace-nowrap">
                            <Lock className="w-3 h-3 text-gray-500 shrink-0" />
                            <span>Requires Approval</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleNotifications(user)}
                            disabled={isProcessing}
                            title="Toggle Keep-Alive Ping notifications for this user"
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center space-x-1.5 whitespace-nowrap transition ${
                              user.receiveNotifications
                                ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700'
                            }`}
                          >
                            {user.receiveNotifications ? (
                              <>
                                <Bell className="w-3 h-3 text-blue-400 shrink-0" />
                                <span>Subscribed</span>
                              </>
                            ) : (
                              <>
                                <BellOff className="w-3 h-3 text-gray-400 shrink-0" />
                                <span>Muted</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Action buttons (Allow / Revoke / Set Target / Ban) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5 whitespace-nowrap">
                          {/* ALLOW / REVOKE BUTTON */}
                          {!user.isAllowed ? (
                            <button
                              onClick={() => handleToggleAllowUser(user, true)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 bg-mongo hover:bg-mongo-400 text-black font-bold rounded-lg text-xs transition shadow-[0_0_12px_rgba(0,237,100,0.3)] flex items-center space-x-1 whitespace-nowrap disabled:opacity-50"
                            >
                              <Unlock className="w-3.5 h-3.5 shrink-0" />
                              <span>{isProcessing ? 'Allowing...' : 'Allow Access'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleAllowUser(user, false)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold transition flex items-center space-x-1 whitespace-nowrap disabled:opacity-50"
                            >
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>Revoke</span>
                            </button>
                          )}

                          {/* Set Target Recipient */}
                          <button
                            onClick={() => {
                              setChatId(user.chatId || user.userId);
                              showFeedback(`Target Chat ID set to ${user.displayName} (${user.userId})`);
                            }}
                            title="Set as notification target recipient"
                            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-xs transition flex items-center space-x-1 whitespace-nowrap"
                          >
                            <Zap className="w-3 h-3 text-mongo shrink-0" />
                            <span>Target</span>
                          </button>

                          {/* Ban Toggle */}
                          {user.isBanned ? (
                            <button
                              onClick={() => handleUnbanUser(user.userId)}
                              className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs transition whitespace-nowrap"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePreFillBan(user)}
                              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs transition whitespace-nowrap"
                            >
                              Ban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LIVE INCOMING TELEGRAM CHAT MESSAGES DETECTED FEED */}
      <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Live Detected Chat Messages
                </h3>
                <span className="w-2 h-2 rounded-full bg-mongo animate-ping" />
              </div>
              <p className="text-xs text-gray-400">
                Incoming commands, greetings, and queries received from Telegram in real time.
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-gray-500 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Auto-refreshing (3s)</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 overflow-hidden max-h-60 overflow-y-auto divide-y divide-gray-800/50">
          {recentMessages.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-xs">
              No chat messages received yet. Send a message to <code>@{botInfo?.username || 'bot'}</code> on Telegram.
            </div>
          ) : (
            recentMessages.map((msg) => (
              <div key={msg.id} className="p-3 bg-[#0B1120]/60 hover:bg-gray-800/30 transition flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0 mt-0.5">
                    {(msg.displayName || msg.username || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white text-xs">{msg.displayName}</span>
                      {msg.username && (
                        <span className="text-[10px] text-blue-400 font-mono">@{msg.username}</span>
                      )}
                      {msg.isCommand && (
                        <span className="px-1.5 py-0.2 rounded bg-mongo/20 text-mongo text-[9px] font-mono uppercase font-bold border border-mongo/30">
                          CMD
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-200 mt-1 font-mono bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-800 inline-block">
                      {msg.text}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] text-gray-500 font-mono">{msg.time}</span>
                  <button
                    onClick={() => {
                      setChatId(msg.chatId || msg.userId);
                      setMessage(`Hello @${msg.username || msg.displayName}, `);
                      showFeedback(`Reply target set to ${msg.displayName}`);
                    }}
                    title="Reply to this message"
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition text-[10px] flex items-center space-x-1"
                  >
                    <Send className="w-3 h-3 text-mongo" />
                    <span>Reply</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Grid: 2 Columns (Notification Dispatcher & User Ban Manager) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Column 1: Notification Dispatcher & Preferences */}
        <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between space-y-6">
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Send className="w-4 h-4 text-mongo" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Send Telegram Notification
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                HTML
              </span>
            </div>

            {/* Target Chat ID */}
            <div>
              <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                Target Chat ID / Channel ID
              </label>
              <input
                type="text"
                required
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 123456789 or @your_channel"
                className="w-full px-3.5 py-2.5 bg-gray-900/90 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-xs font-mono focus:outline-none focus:border-mongo focus:ring-1 focus:ring-mongo"
              />

              {/* Detected Users Quick Chips */}
              {detectedUsers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-gray-500 font-medium">Quick Pick:</span>
                  {detectedUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setChatId(u.chatId || u.userId);
                        showFeedback(`Target set to ${u.displayName} (${u.userId})`);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 border transition ${
                        chatId === (u.chatId || u.userId)
                          ? 'bg-mongo/20 border-mongo/50 text-mongo font-bold'
                          : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-400'
                      }`}
                    >
                      <span>👤 {u.displayName}</span>
                      <span className="text-gray-500">({u.userId})</span>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-gray-500 mt-1 flex items-center space-x-1">
                <HelpCircle className="w-3 h-3 text-gray-500" />
                <span>Message <code>@{botInfo?.username || 'bot'}</code> and type <code>/id</code> to find your Chat ID.</span>
              </p>
            </div>

            {/* Quick Presets */}
            <div>
              <div className="text-[11px] text-gray-400 mb-1.5 font-medium">Quick Presets:</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('🟢 <b>MongoDB Atlas Keep-Alive</b>\n\nDatabase: <code>system_reset</code>\nStatus: ONLINE\nLatency: 38 ms\nCluster is active and healthy.')}
                  className="px-2.5 py-1 rounded-lg bg-gray-800/90 hover:bg-gray-700 text-gray-300 text-[11px] transition"
                >
                  🟢 Status Ping
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('🚨 <b>MongoDB Atlas Alert</b>\n\nDatabase ping reported higher latency or connection drop.\nPlease inspect dashboard immediately.')}
                  className="px-2.5 py-1 rounded-lg bg-gray-800/90 hover:bg-gray-700 text-red-300 text-[11px] transition"
                >
                  🚨 High Alert
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('📢 <b>Keep-Alive Maintenance Announcement</b>\n\nScheduled bot health verification in progress.')}
                  className="px-2.5 py-1 rounded-lg bg-gray-800/90 hover:bg-gray-700 text-blue-300 text-[11px] transition"
                >
                  📢 Announcement
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                Notification Message (HTML Support)
              </label>
              <textarea
                rows={5}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type notification message here (supports <b>bold</b>, <i>italic</i>, <code>code</code>)..."
                className="w-full p-3 bg-gray-900/90 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-xs font-mono focus:outline-none focus:border-mongo focus:ring-1 focus:ring-mongo resize-none"
              />
            </div>

            {/* Submit Send Button */}
            <button
              type="submit"
              disabled={isSending || !isConnected}
              className="w-full py-2.5 px-4 bg-mongo hover:bg-mongo-400 text-black font-semibold rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(0,237,100,0.2)] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Dispatching Message...' : 'Send Telegram Notification'}</span>
            </button>
          </form>

          {/* Automated Notification Preferences */}
          <div className="pt-4 border-t border-gray-800/80 space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Automated Alert Preferences
            </h4>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-xs cursor-pointer">
                <div>
                  <div className="text-gray-200 font-medium">Alert on Ping Failures</div>
                  <div className="text-[11px] text-gray-500">Sends emergency alert to authorized subscribers if MongoDB ping fails.</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnFailure}
                  onChange={(e) => setNotifyOnFailure(e.target.checked)}
                  className="w-4 h-4 rounded text-mongo accent-mongo focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-xs cursor-pointer">
                <div>
                  <div className="text-gray-200 font-medium">Alert on Every Ping Cycle (Auto-Ping)</div>
                  <div className="text-[11px] text-gray-500">Sends success report to all authorized subscribers when database ping succeeds.</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnPing}
                  onChange={(e) => setNotifyOnPing(e.target.checked)}
                  className="w-4 h-4 rounded text-mongo accent-mongo focus:ring-0"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-medium transition flex items-center justify-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5 text-mongo" />
              <span>{isSavingSettings ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>

        {/* Column 2: Telegram User Ban Management */}
        <div id="ban-user-section" className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Telegram User Ban & Access Control
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Block unauthorized or abusive Telegram users from interacting with the bot. Banned users cannot execute <code>/ping</code>, <code>/status</code>, or receive broadcast notifications.
            </p>

            {/* Ban New User Form */}
            <form onSubmit={handleBanUser} className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-3 mb-6">
              <div className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center space-x-1.5">
                <UserX className="w-3.5 h-3.5" />
                <span>Ban Telegram User</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Telegram User ID *</label>
                  <input
                    type="text"
                    required
                    value={banUserId}
                    onChange={(e) => setBanUserId(e.target.value)}
                    placeholder="e.g. 987654321"
                    className="w-full px-3 py-1.5 bg-[#0B1120] border border-gray-800 rounded-lg text-white text-xs font-mono focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Username (Optional)</label>
                  <input
                    type="text"
                    value={banUsername}
                    onChange={(e) => setBanUsername(e.target.value)}
                    placeholder="@username"
                    className="w-full px-3 py-1.5 bg-[#0B1120] border border-gray-800 rounded-lg text-white text-xs font-mono focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Reason for Ban</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="e.g. Spamming commands or unauthorized access"
                  className="w-full px-3 py-1.5 bg-[#0B1120] border border-gray-800 rounded-lg text-white text-xs font-sans focus:border-red-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isBanning}
                className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-[0_0_15px_rgba(239,68,68,0.2)] disabled:opacity-50"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>{isBanning ? 'Banning User...' : 'Ban Telegram User'}</span>
              </button>
            </form>

            {/* Banned Users Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Banned Users List ({bannedUsers.length})
                </h4>
              </div>

              <div className="rounded-xl border border-gray-800 overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B1120] text-gray-400 font-mono text-[10px] uppercase border-b border-gray-800">
                    <tr>
                      <th className="py-2.5 px-3">User ID</th>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-mono text-[11px]">
                    {bannedUsers.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-gray-500 font-sans text-xs">
                          No users are currently banned.
                        </td>
                      </tr>
                    ) : (
                      bannedUsers.map((banned) => (
                        <tr key={banned.id} className="hover:bg-gray-800/30 transition">
                          <td className="py-2.5 px-3 text-red-400 font-semibold">{banned.userId}</td>
                          <td className="py-2.5 px-3 text-gray-300">
                            {banned.username ? `@${banned.username}` : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 font-sans max-w-[120px] truncate" title={banned.reason}>
                            {banned.reason}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleUnbanUser(banned.userId)}
                              title="Unban user"
                              className="px-2 py-1 bg-gray-800 hover:bg-mongo/20 hover:text-mongo hover:border-mongo/30 border border-gray-700 rounded text-[10px] text-gray-300 transition"
                            >
                              Unban
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Webhook Configuration Note */}
          <div className="pt-3 border-t border-gray-800/80 text-[11px] text-gray-500 leading-relaxed font-mono">
            <span>Webhook URL: </span>
            <code className="text-mongo text-[10px]">/.netlify/functions/telegram?action=webhook</code>
          </div>
        </div>

      </div>

    </div>
  );
}
