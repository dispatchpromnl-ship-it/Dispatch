const { google } = require('googleapis');
const crypto = require('crypto');

// ── Configuration ────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';
const USERS_SHEET = 'USERS';

// ── Password Hashing ─────────────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Main Handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const rawCreds = process.env.GOOGLE_CREDENTIALS;
    if (!rawCreds) {
      return res.status(500).json({ success: false, error: 'GOOGLE_CREDENTIALS not set.' });
    }

    const credentials = JSON.parse(rawCreds);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required.' });
    }

    // ── Read USERS sheet ─────────────────────────────────────────────────────
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A1:F`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.status(401).json({ success: false, error: 'No users found. Contact admin.' });
    }

    // Headers: USERNAME | PASSWORD | ROLE | DISPLAY_NAME | ACTIVE | CREATED
    const headers = rows[0];
    const users = rows.slice(1).map(row => {
      const user = {};
      headers.forEach((h, i) => { user[h] = row[i] || ''; });
      return user;
    });

    // ── Find user ────────────────────────────────────────────────────────────
    const user = users.find(u =>
      u['USERNAME'] && u['USERNAME'].toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // Check if active
    if (user['ACTIVE'] && user['ACTIVE'].toUpperCase() !== 'YES') {
      return res.status(401).json({ success: false, error: 'Account is deactivated. Contact admin.' });
    }

    // Check password
    const inputHash = hashPassword(password);
    const storedHash = user['PASSWORD'];

    if (inputHash !== storedHash) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // ── Success ──────────────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      username: user['USERNAME'],
      displayName: user['DISPLAY_NAME'] || user['USERNAME'],
      role: (user['ROLE'] || 'user').toLowerCase(),
    });

  } catch (err) {
    console.error('[login.js] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error: ' + err.message });
  }
};
