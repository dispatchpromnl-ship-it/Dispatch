const { getSheetsClient }              = require('./_lib/sheets');
const { cors }                         = require('./_lib/cors');
const { verifyPassword }               = require('./_lib/hash');
const { SPREADSHEET_ID, SHEET }        = require('./_lib/constants');

// ── In-memory rate limiter (per IP, resets on cold-start) ────────────────────
const loginAttempts = new Map(); // ip → { count, resetAt }
const MAX_ATTEMPTS  = 10;        // max failures before lockout
const WINDOW_MS     = 15 * 60 * 1000; // 15-minute window

function checkRateLimit(ip) {
  const now  = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { blocked: false };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const waitSec = Math.ceil((entry.resetAt - now) / 1000);
    return { blocked: true, waitSec };
  }
  return { blocked: false };
}

function recordFailure(ip) {
  const now  = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  entry.count += 1;
  loginAttempts.set(ip, entry);
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

module.exports = async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    // ── Rate limiting ────────────────────────────────────────────────────
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const rl = checkRateLimit(ip);
    if (rl.blocked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Please wait ${Math.ceil(rl.waitSec / 60)} minute(s) before trying again.`,
      });
    }

    // ── Input validation ─────────────────────────────────────────────────
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required.' });
    }
    if (typeof username !== 'string' || username.length > 64) {
      return res.status(400).json({ success: false, error: 'Invalid username.' });
    }
    if (typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Invalid password.' });
    }

    const sheets = getSheetsClient();

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
      console.warn('[login.js] USERS sheet is empty or has no user rows.');
      return res.status(401).json({ success: false, error: 'No users found. Run setup first or contact admin.' });
    }

    const headers = rows[0];
    const users = rows.slice(1).map(row => {
      const user = {};
      headers.forEach((h, i) => { user[h] = row[i] || ''; });
      return user;
    });

    const user = users.find(u =>
      u['USERNAME'] && u['USERNAME'].toLowerCase() === username.toLowerCase()
    );

    // Use generic message for all auth failures to prevent user enumeration
    const authFail = () => {
      recordFailure(ip);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    };

    if (!user) return authFail();

    if (user['ACTIVE'] && user['ACTIVE'].toUpperCase() !== 'YES') {
      return res.status(401).json({ success: false, error: 'Account is deactivated. Contact admin.' });
    }

    const storedHash = user['PASSWORD'];
    if (!storedHash) {
      console.error(`[login.js] User "${username}" has no password hash.`);
      return res.status(500).json({ success: false, error: 'Account data corrupted. Re-run setup.' });
    }

    if (!verifyPassword(password, storedHash)) return authFail();

    // Success — clear failure counter
    clearAttempts(ip);
    console.log(`[login.js] Successful login: "${user['USERNAME']}"`);

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
