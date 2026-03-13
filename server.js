const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-on-your-vps';
const DATA_PATH = path.join(__dirname, 'data.json');

const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_REQUESTS = 10;
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_AFTER_ATTEMPTS = 5;

const loginRateLimitByIp = new Map();
const loginFailedAttemptsByUserAndIp = new Map();

const adminUser = {
  username: 'admin',
  passwordHash: bcrypt.hashSync('strongpassword', 10),
};

app.use(express.json());
app.use(express.static('public'));

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor && typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const existing = loginRateLimitByIp.get(ip);

  if (!existing || existing.resetAt <= now) {
    loginRateLimitByIp.set(ip, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  existing.count += 1;

  if (existing.count > LOGIN_RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  return false;
}

function getLoginAttemptKey(username, ip) {
  return `${String(username).toLowerCase()}::${ip}`;
}

function isTemporarilyLocked(username, ip) {
  const now = Date.now();
  const key = getLoginAttemptKey(username, ip);
  const attempts = loginFailedAttemptsByUserAndIp.get(key);

  if (!attempts) {
    return false;
  }

  if (attempts.lockUntil && attempts.lockUntil > now) {
    return true;
  }

  if (attempts.lastAttemptAt + LOGIN_LOCK_WINDOW_MS <= now) {
    loginFailedAttemptsByUserAndIp.delete(key);
  }

  return false;
}

function recordFailedLogin(username, ip) {
  const now = Date.now();
  const key = getLoginAttemptKey(username, ip);
  const existing = loginFailedAttemptsByUserAndIp.get(key);

  if (!existing || existing.lastAttemptAt + LOGIN_LOCK_WINDOW_MS <= now) {
    loginFailedAttemptsByUserAndIp.set(key, {
      count: 1,
      lastAttemptAt: now,
      lockUntil: null,
    });
    return;
  }

  existing.count += 1;
  existing.lastAttemptAt = now;

  if (existing.count >= LOGIN_LOCK_AFTER_ATTEMPTS) {
    existing.lockUntil = now + LOGIN_LOCK_WINDOW_MS;
  }
}

function clearFailedLoginHistory(username, ip) {
  const key = getLoginAttemptKey(username, ip);
  loginFailedAttemptsByUserAndIp.delete(key);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const clientIp = getClientIp(req);

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ message: 'Too many login attempts. Please try again shortly.' });
  }

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  if (isTemporarilyLocked(username, clientIp)) {
    return res.status(429).json({ message: 'Too many failed login attempts. Please try again later.' });
  }

  if (username !== adminUser.username) {
    recordFailedLogin(username, clientIp);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);

  if (!isValidPassword) {
    recordFailedLogin(username, clientIp);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  clearFailedLoginHistory(username, clientIp);

  const payload = {
    username: adminUser.username,
    role: 'admin',
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  return res.json({ token });
});

app.get('/api/data', (req, res) => {
  fs.readFile(DATA_PATH, 'utf8', (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        return res.json({});
      }

      return res.status(500).json({ message: 'Failed to read data file' });
    }

    try {
      const parsed = data.trim() ? JSON.parse(data) : {};
      return res.json(parsed);
    } catch (parseError) {
      return res.status(500).json({ message: 'data.json contains invalid JSON' });
    }
  });
});

app.post('/api/data', authMiddleware, (req, res) => {
  const content = JSON.stringify(req.body, null, 2);

  fs.writeFile(DATA_PATH, content, 'utf8', (error) => {
    if (error) {
      return res.status(500).json({ message: 'Failed to save data file' });
    }

    return res.json({ message: 'Data saved successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
