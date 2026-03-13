const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-on-your-vps';
const DATA_PATH = path.join(__dirname, 'data.json');

const adminUser = {
  username: 'admin',
  passwordHash: bcrypt.hashSync('strongpassword', 10),
};

app.use(express.json());
app.use(express.static('public'));

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

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  if (username !== adminUser.username) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);

  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

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
