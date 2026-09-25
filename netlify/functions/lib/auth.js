const jwt = require('jsonwebtoken');
require('dotenv').config();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_mongodb_keep_alive_2026';

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role || 'admin',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(authHeader) {
  if (!authHeader) {
    return null;
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  const token = parts[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  CORS_HEADERS,
  jsonResponse,
  generateToken,
  verifyToken,
};
