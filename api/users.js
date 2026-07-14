const { google } = require('googleapis');
const crypto = require('crypto');

// ── Configuration ────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';
const USERS_SHEET = 'USERS';
const AUDIT_SHEET = 'AUDIT_LOG';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawCreds = process.env.GOOGLE_CREDENTIALS;
    if (!rawCreds) return res.status(500).json({ success: false, error: 'GOOGLE_CREDENTIALS not set.' });

    const credentials = JSON.parse(rawCreds);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    // ── Audit Log Helper ──────────────────────────────────────────────────────
    async function writeAuditLog(action, user, details, target) {
      try {
        const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: `${AUDIT_SHEET}!A1:A1`,
        });
        if (!existing.data.values || existing.data.values.length === 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: `${AUDIT_SHEET}!A1`, valueInputOption: 'RAW',
            requestBody: { values: [['TIMESTAMP', 'ACTION', 'USER', 'DETAILS', 'TARGET']] },
          });
        }
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID, range: `${AUDIT_SHEET}!A1`, valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[now, action, user, details || '', target || '']] },
        });
      } catch (e) { console.error('[audit] Write failed:', e.message); }
    }

    // ── GET: List all users ──────────────────────────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A1:F`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) {
        return res.status(200).json({ success: true, users: [] });
      }

      const headers = rows[0];
      const users = rows.slice(1).map((row, idx) => {
        const user = { _row: idx + 2 }; // 1-indexed + header
        headers.forEach((h, i) => { user[h] = row[i] || ''; });
        return user;
      });

      // Mask passwords
      const safeUsers = users.map(u => ({
        row: u._row,
        username: u['USERNAME'] || '',
        displayName: u['DISPLAY_NAME'] || '',
        role: u['ROLE'] || 'user',
        active: u['ACTIVE'] || 'YES',
        created: u['CREATED'] || '',
      }));

      return res.status(200).json({ success: true, users: safeUsers });
    }

    // ── POST: Add new user ───────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { username, password, displayName, role } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required.' });
      }

      if (password.length < 4) {
        return res.status(400).json({ success: false, error: 'Password must be at least 4 characters.' });
      }

      // Check if username already exists
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A1:A`,
      });

      const existingUsernames = (existing.data.values || []).slice(1).map(r => (r[0] || '').toLowerCase());
      if (existingUsernames.includes(username.toLowerCase())) {
        return res.status(409).json({ success: false, error: 'Username already exists.' });
      }

      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const row = [
        username.toUpperCase(),
        hashPassword(password),
        (role || 'user').toLowerCase(),
        displayName || username.toUpperCase(),
        'YES',
        now,
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });

      await writeAuditLog('USER_CREATED', 'admin', `Created user ${username.toUpperCase()} (${role || 'user'})`, username.toUpperCase());

      return res.status(200).json({ success: true, message: 'User added successfully.' });
    }

    // ── PUT: Update user (activate/deactivate, change role, reset password) ──
    if (req.method === 'PUT') {
      const { row, active, role, password, displayName } = req.body || {};

      if (!row) {
        return res.status(400).json({ success: false, error: 'Row number required.' });
      }

      // Read current row data
      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A${row}:F${row}`,
      });

      if (!current.data.values || current.data.values.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const existing = current.data.values[0];
      const updatedRow = [
        existing[0], // USERNAME (don't change)
        password ? hashPassword(password) : existing[1], // PASSWORD
        role || existing[2], // ROLE
        displayName || existing[3], // DISPLAY_NAME
        active !== undefined ? active.toUpperCase() : existing[4], // ACTIVE
        existing[5], // CREATED
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A${row}:F${row}`,
        valueInputOption: 'RAW',
        requestBody: { values: [updatedRow] },
      });

      // Log the change
      const changes = [];
      if (password) changes.push('password reset');
      if (displayName) changes.push(`name → "${displayName}"`);
      if (role) changes.push(`role → ${role}`);
      if (active !== undefined) changes.push(`status → ${active.toUpperCase()}`);
      await writeAuditLog('USER_UPDATED', 'admin', changes.join(', ') || 'updated', existing[0]);

      return res.status(200).json({ success: true, message: 'User updated.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[users.js] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
