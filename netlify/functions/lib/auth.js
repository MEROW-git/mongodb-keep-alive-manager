const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing, empty, or too short (minimum 16 characters required). Refusing to use insecure hardcoded fallback.'
    );
  }
  return secret.trim();
}

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

function generateToken(user) {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role || 'admin',
    },
    secret,
    { expiresIn: '7d' }
  );
}

function verifyToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  const token = parts[1];
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

module.exports = {
  CORS_HEADERS,
  jsonResponse,
  generateToken,
  verifyToken,
  getJwtSecret,
};
