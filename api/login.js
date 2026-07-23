const { getSheetsClient }  = require('./_lib/sheets');
const { cors }             = require('./_lib/cors');
const { hashPassword }     = require('./_lib/hash');
const { SPREADSHEET_ID, SHEET } = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const sheets = getSheetsClient();

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required.' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET.USERS}!A1:F`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.status(401).json({ success: false, error: 'No users found. Contact admin.' });
    }

    // Build user objects from headers
    const headers = rows[0];
    const users = rows.slice(1).map(row => {
      const user = {};
      headers.forEach((h, i) => { user[h] = row[i] || ''; });
      return user;
    });

    const user = users.find(u =>
      u['USERNAME'] && u['USERNAME'].toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    if (user['ACTIVE'] && user['ACTIVE'].toUpperCase() !== 'YES') {
      return res.status(401).json({ success: false, error: 'Account is deactivated. Contact admin.' });
    }

    if (hashPassword(password) !== user['PASSWORD']) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    return res.status(200).json({
      success:     true,
      username:    user['USERNAME'],
      displayName: user['DISPLAY_NAME'] || user['USERNAME'],
      role:        (user['ROLE'] || 'user').toLowerCase(),
    });

  } catch (err) {
    console.error('[login.js]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
