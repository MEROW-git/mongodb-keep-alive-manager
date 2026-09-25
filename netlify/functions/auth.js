const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('./lib/mongodb');
const { jsonResponse, generateToken, verifyToken, CORS_HEADERS } = require('./lib/auth');

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
      if (!username || !password) {
        return jsonResponse(400, {
          status: 'error',
          message: 'Username and password are required',
        });
      }

      const { db } = await connectToDatabase();
      const usersCol = db.collection('users');

      // Check if user exists
      let user = await usersCol.findOne({ username: username.trim() });

      // If database has 0 users, auto-seed with configured ADMIN_USERNAME & ADMIN_PASSWORD
      if (!user) {
        const totalUsers = await usersCol.countDocuments();
        const envUser = process.env.ADMIN_USERNAME || 'admin';
        const envPass = process.env.ADMIN_PASSWORD || 'admin123456';

        if (totalUsers === 0 && username.trim() === envUser && password === envPass) {
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

      if (!user) {
        return jsonResponse(401, {
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return jsonResponse(401, {
          status: 'error',
          message: 'Invalid username or password',
        });
      }

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
    console.error('Auth error:', error);
    return jsonResponse(500, {
      status: 'error',
      message: 'Internal server error during authentication',
      details: error.message,
    });
  }
};
