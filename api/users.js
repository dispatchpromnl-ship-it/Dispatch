const { getSheetsClient, ensureHeaders } = require('./_lib/sheets');
const { cors }                           = require('./_lib/cors');
const { hashPassword }                   = require('./_lib/hash');
const { writeAuditLog }                  = require('./_lib/audit');
const { SPREADSHEET_ID, SHEET,
        USER_HEADERS }                   = require('./_lib/constants');
const { verifyAdmin }                    = require('./_lib/auth');

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets   = getSheetsClient();
    const username = req.headers['x-username'];

    // All user-management operations require admin
    const auth = await verifyAdmin(sheets, username);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }
    const actingUser = auth.user.username;

    // ── GET: List all users ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A1:F`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return res.status(200).json({ success: true, users: [] });

      const headers  = rows[0];
      const safeUsers = rows.slice(1).map((row, idx) => {
        const u = { _row: idx + 2 };
        headers.forEach((h, i) => { u[h] = row[i] || ''; });
        return {
          row:         u._row,
          username:    u['USERNAME']     || '',
          displayName: u['DISPLAY_NAME'] || '',
          role:        u['ROLE']         || 'user',
          active:      u['ACTIVE']       || 'YES',
          created:     u['CREATED']      || '',
        };
      });

      return res.status(200).json({ success: true, users: safeUsers });
    }

    // ── POST: Add new user ───────────────────────────────────────────────
    if (req.method === 'POST') {
      const { username: newUser, password, displayName, role } = req.body || {};

      if (!newUser || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required.' });
      }
      if (typeof newUser !== 'string' || newUser.length > 64) {
        return res.status(400).json({ success: false, error: 'Invalid username.' });
      }
      if (typeof password !== 'string' || password.length < 4 || password.length > 128) {
        return res.status(400).json({ success: false, error: 'Password must be 4–128 characters.' });
      }

      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A1:A`,
      });
      const existingUsernames = (existing.data.values || []).slice(1).map(r => (r[0] || '').toLowerCase());
      if (existingUsernames.includes(newUser.toLowerCase())) {
        return res.status(409).json({ success: false, error: 'Username already exists.' });
      }

      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const row = [
        newUser.toUpperCase(),
        hashPassword(password),
        (role || 'user').toLowerCase(),
        displayName || newUser.toUpperCase(),
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

      await writeAuditLog(sheets, 'USER_CREATED', actingUser,
        `Created user ${newUser.toUpperCase()} (${role || 'user'})`,
        newUser.toUpperCase()
      );

      return res.status(200).json({ success: true, message: 'User added successfully.' });
    }

    // ── PUT: Update user ─────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { row, active, role, password, displayName, username: editUsername } = req.body || {};
      if (!row) return res.status(400).json({ success: false, error: 'Row number required.' });

      // Validate password length if provided
      if (password !== undefined && (typeof password !== 'string' || password.length < 4 || password.length > 128)) {
        return res.status(400).json({ success: false, error: 'Password must be 4–128 characters.' });
      }

      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A${row}:F${row}`,
      });
      if (!current.data.values || current.data.values.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const prev        = current.data.values[0];
      let newUsername   = prev[0];

      if (editUsername && editUsername.toUpperCase() !== prev[0]) {
        if (typeof editUsername !== 'string' || editUsername.length > 64) {
          return res.status(400).json({ success: false, error: 'Invalid username.' });
        }
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET.USERS}!A1:A`,
        });
        const existingUsernames = (existing.data.values || []).slice(1).map(r => (r[0] || '').toLowerCase());
        if (existingUsernames.includes(editUsername.toLowerCase())) {
          return res.status(409).json({ success: false, error: 'Username already exists.' });
        }
        newUsername = editUsername.toUpperCase();
      }

      const updatedRow = [
        newUsername,
        password ? hashPassword(password) : prev[1],
        role        || prev[2],
        displayName || prev[3],
        active !== undefined ? active.toUpperCase() : prev[4],
        prev[5],
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
        editUsername && editUsername.toUpperCase() !== prev[0] && `username → "${newUsername}"`,
        role        && `role → ${role}`,
        active !== undefined && `status → ${active.toUpperCase()}`,
      ].filter(Boolean);

      await writeAuditLog(sheets, 'USER_UPDATED', actingUser, changes.join(', ') || 'updated', newUsername);

      return res.status(200).json({ success: true, message: 'User updated.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[users.js]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
