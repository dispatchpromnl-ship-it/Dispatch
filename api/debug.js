const { cors }                  = require('./_lib/cors');
const { SPREADSHEET_ID, SHEET } = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'GET only' });

  // ── Admin-only: must provide x-username + verify role via USERS sheet ────
  const requestingUser = req.headers['x-username'];
  if (!requestingUser) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  const report = { checks: [] };

  // 1. Check GOOGLE_CREDENTIALS (existence only — never expose content)
  const rawCreds = process.env.GOOGLE_CREDENTIALS;
  if (!rawCreds) {
    report.checks.push({ name: 'GOOGLE_CREDENTIALS', status: 'MISSING', detail: 'Set this env var in the Vercel dashboard.' });
  } else {
    try {
      const creds = JSON.parse(rawCreds);
      // Only expose non-secret metadata fields
      report.checks.push({
        name:   'GOOGLE_CREDENTIALS',
        status: 'OK',
        detail: `type: ${creds.type || 'unknown'}, project: ${creds.project_id || 'unknown'}`,
      });
    } catch {
      report.checks.push({ name: 'GOOGLE_CREDENTIALS', status: 'INVALID', detail: 'Not valid JSON. Check copy-paste.' });
    }
  }

  // 2. Check SETUP_SECRET (presence only)
  report.checks.push({
    name:   'SETUP_SECRET',
    status: process.env.SETUP_SECRET ? 'OK' : 'MISSING',
    detail: process.env.SETUP_SECRET ? 'Set (value hidden)' : 'Optional but recommended.',
  });

  // 3. Verify requesting user is admin before attempting Sheets connection
  if (rawCreds) {
    try {
      const { getSheetsClient } = require('./_lib/sheets');
      const sheets = getSheetsClient();

      // Admin check: read USERS sheet and verify role
      try {
        const usersResp = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET.USERS}!A1:F`,
        });
        const rows    = usersResp.data.values || [];
        const headers = rows[0] || [];
        const userRow = rows.slice(1).find(r => (r[0] || '').toLowerCase() === requestingUser.toLowerCase());

        if (!userRow) {
          return res.status(403).json({ success: false, error: 'User not found.' });
        }
        const roleIdx = headers.indexOf('ROLE');
        const role    = roleIdx >= 0 ? (userRow[roleIdx] || '') : '';
        if (role.toLowerCase() !== 'admin') {
          return res.status(403).json({ success: false, error: 'Admin access required.' });
        }

        const userCount = rows.length - 1;
        report.checks.push({
          name:   'USERS Sheet',
          status: userCount > 0 ? 'OK' : 'EMPTY',
          detail: userCount > 0
            ? `${userCount} user(s) found`
            : 'No user rows — run /api/setup to create accounts.',
        });
      } catch (sheetErr) {
        report.checks.push({ name: 'USERS Sheet', status: 'ERROR', detail: sheetErr.message });
      }
    } catch (authErr) {
      report.checks.push({ name: 'Google Auth', status: 'ERROR', detail: authErr.message });
    }
  }

  return res.status(200).json({ success: true, report });
};
