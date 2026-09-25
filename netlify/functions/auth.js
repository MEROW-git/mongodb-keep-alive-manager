const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('./lib/mongodb');
const { jsonResponse, generateToken, verifyToken, CORS_HEADERS } = require('./lib/auth');

// In-memory brute force throttling store
// Map key: IP or username -> { count: number, lockedUntil: number, firstAttempt: number }
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000;  // 15 minutes

// Periodic cleanup of stale tracking entries
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.lockedUntil && now - data.firstAttempt > WINDOW_DURATION_MS) {
      loginAttempts.delete(key);
    }
  }
}, 60000);

function getClientIdentifier(event, username) {
  const forwarded = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const clientIp = forwarded.split(',')[0].trim();
  return `${clientIp}:${username.toLowerCase()}`;
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

  try {
    // GET: Token verification / session check
    if (event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const decoded = verifyToken(authHeader);
      if (!decoded) {
        return jsonResponse(401, {
          status: 'error',
          message: 'Invalid or expired session token',
        });
      }
      return jsonResponse(200, {
        status: 'success',
        user: {
          username: decoded.username,
          role: decoded.role,
        },
      });
    }

    // POST: Login authentication
    if (event.httpMethod === 'POST') {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, { status: 'error', message: 'Malformed JSON payload' });
      }

      const { username, password } = body;
      if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        !username.trim() ||
        !password
      ) {
        return jsonResponse(400, {
          status: 'error',
          message: 'Valid username and password strings are required',
        });
      }

      const cleanUser = String(username).trim().slice(0, 100);
      const cleanPass = String(password).slice(0, 256);
      const throttleKey = getClientIdentifier(event, cleanUser);

      // Check brute-force lockout status
      const attemptData = loginAttempts.get(throttleKey);
      const now = Date.now();
      if (attemptData && attemptData.lockedUntil > now) {
        const remainingMinutes = Math.ceil((attemptData.lockedUntil - now) / 60000);
        return jsonResponse(429, {
          status: 'error',
          message: `Too many failed login attempts. Account temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
        });
      }

      const { db } = await connectToDatabase();
      const usersCol = db.collection('users');

      // Check if user exists (strictly query by string)
      let user = await usersCol.findOne({ username: cleanUser });

      // Auto-seed initial admin ONLY if database has 0 users AND explicit strong env credentials are provided
      if (!user) {
        const totalUsers = await usersCol.countDocuments();
        const envUser = process.env.ADMIN_USERNAME;
        const envPass = process.env.ADMIN_PASSWORD;

        // Disallow insecure defaults during auto-seeding
        const isDefaultPassword = !envPass || envPass === 'admin123456' || envPass === 'password' || envPass.length < 8;

        if (totalUsers === 0 && envUser && envPass && !isDefaultPassword && cleanUser === envUser && cleanPass === envPass) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(envPass, salt);
          const newUser = {
            username: envUser,
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date(),
          };
          const insertResult = await usersCol.insertOne(newUser);
          user = { ...newUser, _id: insertResult.insertedId };
        }
      }

      const recordFailedAttempt = () => {
        const current = loginAttempts.get(throttleKey) || { count: 0, lockedUntil: 0, firstAttempt: now };
        current.count += 1;
        if (current.count >= MAX_FAILED_ATTEMPTS) {
          current.lockedUntil = now + LOCKOUT_DURATION_MS;
          console.warn(`[SECURITY] Excessive failed login attempts for ${cleanUser}. IP locked for 15 minutes.`);
        }
        loginAttempts.set(throttleKey, current);
      };

      if (!user) {
        recordFailedAttempt();
        return jsonResponse(401, {
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      const isMatch = await bcrypt.compare(cleanPass, user.password);
      if (!isMatch) {
        recordFailedAttempt();
        return jsonResponse(401, {
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      // Successful login: reset throttling tracking
      loginAttempts.delete(throttleKey);

      const token = generateToken(user);

      return jsonResponse(200, {
        status: 'success',
        message: 'Authentication successful',
        token,
        user: {
          username: user.username,
          role: user.role || 'admin',
        },
      });
    }

    return jsonResponse(405, { status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Auth error:', error.message);
    return jsonResponse(500, {
      status: 'error',
      message: 'Internal server error during authentication',
    });
  }
};
