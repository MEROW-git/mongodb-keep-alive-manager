const API_BASE = '/api';

/**
 * Retrieve current JWT token from storage
 */
export function getToken() {
  return localStorage.getItem('token');
}

/**
 * Save auth session
 */
export function setAuthSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Clear auth session
 */
export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Get cached user object
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Universal fetch wrapper with authorization header & error handling
 */
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    // Attempt fallback to /.netlify/functions if /api rewrite is not available
    const fallbackUrl = `/.netlify/functions${endpoint}`;
    try {
      response = await fetch(fallbackUrl, { ...options, headers });
    } catch (e) {
      throw new Error(`Network connection error: Unable to reach serverless API.`);
    }
  }

  // Handle unauthorized session
  if (response.status === 401 && !endpoint.startsWith('/auth')) {
    clearAuthSession();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  async login(username, password) {
    const data = await request('/auth', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      setAuthSession(data.token, data.user);
    }
    return data;
  },

  async verifySession() {
    return request('/auth', { method: 'GET' });
  },

  logout() {
    clearAuthSession();
  },

  // Dashboard
  async getDashboard() {
    return request('/dashboard', { method: 'GET' });
  },

  // Ping Keep-Alive
  async triggerPing() {
    return request('/ping', { method: 'POST' });
  },

  // Logs
  async getLogs({ page = 1, limit = 20, status = '' } = {}) {
    const query = new URLSearchParams();
    if (page) query.set('page', page);
    if (limit) query.set('limit', limit);
    if (status && status !== 'ALL') query.set('status', status);

    return request(`/logs?${query.toString()}`, { method: 'GET' });
  },

  async clearLogs() {
    return request('/logs', { method: 'DELETE' });
  },

  // Settings
  async getSettings() {
    return request('/settings', { method: 'GET' });
  },

  async updateSettings(settingsData) {
    return request('/settings', {
      method: 'POST',
      body: JSON.stringify(settingsData),
    });
  },

  // Telegram Bot
  async getTelegramData() {
    return request('/telegram', { method: 'GET' });
  },

  async sendTelegramNotification({ chatId, message, parseMode = 'Markdown' }) {
    return request('/telegram', {
      method: 'POST',
      body: JSON.stringify({
        action: 'send_notification',
        chatId,
        message,
        parseMode,
      }),
    });
  },

  async banTelegramUser({ userId, username, reason }) {
    return request('/telegram', {
      method: 'POST',
      body: JSON.stringify({
        action: 'ban_user',
        userId,
        username,
        reason,
      }),
    });
  },

  async unbanTelegramUser(userId) {
    return request('/telegram', {
      method: 'POST',
      body: JSON.stringify({
        action: 'unban_user',
        userId,
      }),
    });
  },

  async updateTelegramSettings(settings) {
    return request('/telegram', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update_settings',
        ...settings,
      }),
    });
  },
};

export default api;
