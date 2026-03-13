const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const DATA_PATH = path.join(__dirname, 'data.json');
const ADMINS_PATH = path.join(__dirname, 'admins.json');
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJsonFile(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      return fallbackValue;
    }

    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}`);
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureBootstrapAdmin() {
  const defaultAdmins = { admins: [] };
  const adminStore = readJsonFile(ADMINS_PATH, defaultAdmins);

  if (!Array.isArray(adminStore.admins)) {
    throw new Error('admins.json must contain an admins array');
  }

  const hasAdmin = adminStore.admins.some((admin) => admin.username === 'admin');
  if (!hasAdmin) {
    const passwordHash = bcrypt.hashSync('ChangeMeNow123!', SALT_ROUNDS);
    adminStore.admins.push({
      username: 'admin',
      passwordHash,
      mustChangePassword: true,
    });
    writeJsonFile(ADMINS_PATH, adminStore);
  }
}

function getAdminStore() {
  const adminStore = readJsonFile(ADMINS_PATH, { admins: [] });

  if (!Array.isArray(adminStore.admins)) {
    throw new Error('admins.json must contain an admins array');
  }

  return adminStore;
}

function saveAdminStore(adminStore) {
  writeJsonFile(ADMINS_PATH, adminStore);
}

function findAdminByUsername(adminStore, username) {
  return adminStore.admins.find((admin) => admin.username === username);
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    const normalizedUsername = username.trim();
    const adminStore = getAdminStore();
    const admin = findAdminByUsername(adminStore, normalizedUsername);

    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const matches = await bcrypt.compare(password, admin.passwordHash);
    if (!matches) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });

    return res.json({
      token,
      mustChangePassword: Boolean(admin.mustChangePassword),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/change-password', auth, async (req, res) => {
  try {
    const { newPassword } = req.body || {};

    if (!isNonEmptyString(newPassword) || newPassword.trim().length < 10) {
      return res.status(400).json({ message: 'newPassword is required and must be at least 10 characters' });
    }

    const adminStore = getAdminStore();
    const admin = findAdminByUsername(adminStore, req.user.username);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    admin.mustChangePassword = false;
    saveAdminStore(adminStore);

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not change password' });
  }
});

app.get('/api/data', (req, res) => {
  try {
    const data = readJsonFile(DATA_PATH, { cells: [] });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: 'Could not read data.json' });
  }
});

app.post('/api/data', auth, (req, res) => {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ message: 'Body must be a JSON object' });
    }

    writeJsonFile(DATA_PATH, payload);
    return res.json({ message: 'Data saved successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not save data.json' });
  }
});

app.get('/api/admin/list', auth, (req, res) => {
  try {
    const adminStore = getAdminStore();
    const admins = adminStore.admins.map((admin) => ({ username: admin.username }));
    return res.json({ admins });
  } catch (error) {
    return res.status(500).json({ message: 'Could not list admins' });
  }
});

app.post('/api/admin/create', auth, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    if (password.length < 10) {
      return res.status(400).json({ message: 'password must be at least 10 characters' });
    }

    const newUsername = username.trim();
    const adminStore = getAdminStore();

    if (findAdminByUsername(adminStore, newUsername)) {
      return res.status(409).json({ message: 'Admin already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    adminStore.admins.push({
      username: newUsername,
      passwordHash,
      mustChangePassword: true,
    });

    saveAdminStore(adminStore);
    return res.status(201).json({ message: 'Admin created' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not create admin' });
  }
});

app.delete('/api/admin/:username', auth, (req, res) => {
  try {
    const username = req.params.username;

    if (!isNonEmptyString(username)) {
      return res.status(400).json({ message: 'username is required' });
    }

    const adminStore = getAdminStore();

    if (adminStore.admins.length <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last admin' });
    }

    const index = adminStore.admins.findIndex((admin) => admin.username === username);
    if (index === -1) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    adminStore.admins.splice(index, 1);

    if (adminStore.admins.length === 0) {
      return res.status(400).json({ message: 'Cannot delete the last admin' });
    }

    saveAdminStore(adminStore);
    return res.json({ message: 'Admin deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not delete admin' });
  }
});

ensureBootstrapAdmin();

app.listen(PORT, () => {
  console.log('Server running on port 3000');
});
