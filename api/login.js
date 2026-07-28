const { getSheetsClient }  = require('./_lib/sheets');
const { cors }             = require('./_lib/cors');
const { verifyPassword }    = require('./_lib/hash');
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

    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A1:F`,
      });
    } catch (sheetErr) {
      console.error('[login.js] Failed to read USERS sheet:', sheetErr.message);
      return res.status(500).json({ success: false, error: 'Cannot connect to database. GOOGLE_CREDENTIALS may be missing or invalid. Run /api/setup first.' });
    }

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      console.warn('[login.js] USERS sheet is empty or has no user rows. Run /api/setup with SETUP_SECRET to create accounts.');
      return res.status(401).json({ success: false, error: 'No users found. Run setup first or contact admin.' });
    }

    // Build user objects from headers
    const headers = rows[0];
    const users = rows.slice(1).map(row => {
      const user = {};
      headers.forEach((h, i) => { user[h] = row[i] || ''; });
      return user;
    });

    console.log(`[login.js] Login attempt for "${username}" — ${users.length} user(s) in sheet`);

    const user = users.find(u =>
      u['USERNAME'] && u['USERNAME'].toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      console.warn(`[login.js] No matching user for "${username}"`);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    if (user['ACTIVE'] && user['ACTIVE'].toUpperCase() !== 'YES') {
      return res.status(401).json({ success: false, error: 'Account is deactivated. Contact admin.' });
    }

    const storedHash = user['PASSWORD'];
    if (!storedHash) {
      console.error(`[login.js] User "${username}" has no password hash in sheet.`);
      return res.status(500).json({ success: false, error: 'Account data corrupted. Re-run setup.' });
    }

    if (!verifyPassword(password, storedHash)) {
      console.warn(`[login.js] Password mismatch for "${username}" — stored hash starts with: ${storedHash.substring(0, 7)}`);
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
