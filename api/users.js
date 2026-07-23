const { getSheetsClient, ensureHeaders } = require('./_lib/sheets');
const { cors }                           = require('./_lib/cors');
const { hashPassword }                   = require('./_lib/hash');
const { writeAuditLog }                  = require('./_lib/audit');
const { SPREADSHEET_ID, SHEET }          = require('./_lib/constants');

const USER_HEADERS = ['USERNAME', 'PASSWORD', 'ROLE', 'DISPLAY_NAME', 'ACTIVE', 'CREATED'];

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = getSheetsClient();

    // ── GET: List all users ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A1:F`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return res.status(200).json({ success: true, users: [] });

      const headers = rows[0];
      const users = rows.slice(1).map((row, idx) => {
        const u = { _row: idx + 2 };
        headers.forEach((h, i) => { u[h] = row[i] || ''; });
        return u;
      });

      // Mask passwords before sending
      const safeUsers = users.map(u => ({
        row:         u._row,
        username:    u['USERNAME']     || '',
        displayName: u['DISPLAY_NAME'] || '',
        role:        u['ROLE']         || 'user',
        active:      u['ACTIVE']       || 'YES',
        created:     u['CREATED']      || '',
      }));

      return res.status(200).json({ success: true, users: safeUsers });
    }

    // ── POST: Add new user ───────────────────────────────────────────────
    if (req.method === 'POST') {
      const { username, password, displayName, role } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required.' });
      }
      if (password.length < 4) {
        return res.status(400).json({ success: false, error: 'Password must be at least 4 characters.' });
      }

      // Check for duplicate username
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A1:A`,
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

      await ensureHeaders(sheets, SPREADSHEET_ID, SHEET.USERS, USER_HEADERS);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });

      await writeAuditLog(sheets, 'USER_CREATED', 'admin',
        `Created user ${username.toUpperCase()} (${role || 'user'})`,
        username.toUpperCase()
      );

      return res.status(200).json({ success: true, message: 'User added successfully.' });
    }

    // ── PUT: Update user (activate/deactivate, change role, reset password) ──
    if (req.method === 'PUT') {
      const { row, active, role, password, displayName } = req.body || {};
      if (!row) return res.status(400).json({ success: false, error: 'Row number required.' });

      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A${row}:F${row}`,
      });
      if (!current.data.values || current.data.values.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const prev = current.data.values[0];
      const updatedRow = [
        prev[0],                                                   // USERNAME (immutable)
        password ? hashPassword(password) : prev[1],               // PASSWORD
        role        || prev[2],                                    // ROLE
        displayName || prev[3],                                    // DISPLAY_NAME
        active !== undefined ? active.toUpperCase() : prev[4],    // ACTIVE
        prev[5],                                                   // CREATED
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A${row}:F${row}`,
        valueInputOption: 'RAW',
        requestBody: { values: [updatedRow] },
      });

      const changes = [
        password    && 'password reset',
        displayName && `name → "${displayName}"`,
        role        && `role → ${role}`,
        active !== undefined && `status → ${active.toUpperCase()}`,
      ].filter(Boolean);

      await writeAuditLog(sheets, 'USER_UPDATED', 'admin', changes.join(', ') || 'updated', prev[0]);

      return res.status(200).json({ success: true, message: 'User updated.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[users.js]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
