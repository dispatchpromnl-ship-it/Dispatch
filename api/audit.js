const { getSheetsClient }        = require('./_lib/sheets');
const { cors }                   = require('./_lib/cors');
const { writeAuditLog, AUDIT_HEADERS } = require('./_lib/audit');
const { SPREADSHEET_ID, SHEET }  = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res, 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = getSheetsClient();

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

    // ── POST: Write audit log entry ───────────────────────────────────────
    if (req.method === 'POST') {
      const { action, user, details, target } = req.body || {};
      if (!action || !user) {
        return res.status(400).json({ success: false, error: 'Action and user required.' });
      }
      await writeAuditLog(sheets, action, user, details, target);
      return res.status(200).json({ success: true, message: 'Audit log recorded.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[audit.js]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
