const { getSheetsClient }              = require('./_lib/sheets');
const { cors }                         = require('./_lib/cors');
const { writeAuditLog, AUDIT_HEADERS } = require('./_lib/audit');
const { SPREADSHEET_ID, SHEET }        = require('./_lib/constants');

// ── Shared auth helper (Vercel serverless has no Express middleware) ──────────
async function requireAdmin(sheets, username) {
  if (!username) return { ok: false, status: 401, error: 'Authentication required.' };

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.USERS}!A1:F`,
  });
  const rows    = resp.data.values || [];
  const headers = rows[0] || [];
  const userRow = rows.slice(1).find(r => (r[0] || '').toLowerCase() === username.toLowerCase());
  if (!userRow) return { ok: false, status: 401, error: 'User not found.' };

  const activeIdx = headers.indexOf('ACTIVE');
  if (activeIdx >= 0 && (userRow[activeIdx] || '').toUpperCase() !== 'YES') {
    return { ok: false, status: 401, error: 'Account is deactivated.' };
  }

  const roleIdx = headers.indexOf('ROLE');
  if (roleIdx < 0 || (userRow[roleIdx] || '').toLowerCase() !== 'admin') {
    return { ok: false, status: 403, error: 'Admin access required.' };
  }

  return { ok: true };
}

module.exports = async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets   = getSheetsClient();
    const username = req.headers['x-username'];

    // All audit operations require admin
    const auth = await requireAdmin(sheets, username);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    // ── GET: Read audit logs ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.AUDIT_LOG}!A1:E`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return res.status(200).json({ success: true, logs: [] });

      const headers = rows[0];
      const logs = rows.slice(1).reverse().map(row => {
        const log = {};
        headers.forEach((h, i) => { log[h] = row[i] || ''; });
        return {
          timestamp: log['TIMESTAMP'] || '',
          action:    log['ACTION']    || '',
          user:      log['USER']      || '',
          details:   log['DETAILS']   || '',
          target:    log['TARGET']    || '',
        };
      });

      return res.status(200).json({ success: true, logs });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[audit.js]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
