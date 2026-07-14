const { google } = require('googleapis');

const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';
const AUDIT_SHEET = 'AUDIT_LOG';

const AUDIT_HEADERS = ['TIMESTAMP', 'ACTION', 'USER', 'DETAILS', 'TARGET'];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

    // ── GET: Read audit logs ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${AUDIT_SHEET}!A1:E`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) {
        return res.status(200).json({ success: true, logs: [] });
      }

      const headers = rows[0];
      const logs = rows.slice(1).reverse().map((row, idx) => {
        const log = {};
        headers.forEach((h, i) => { log[h] = row[i] || ''; });
        return {
          timestamp: log['TIMESTAMP'] || '',
          action: log['ACTION'] || '',
          user: log['USER'] || '',
          details: log['DETAILS'] || '',
          target: log['TARGET'] || '',
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

      // Ensure headers exist
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${AUDIT_SHEET}!A1:A1`,
      });

      if (!existing.data.values || existing.data.values.length === 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${AUDIT_SHEET}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [AUDIT_HEADERS] },
        });
      }

      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const row = [now, action, user, details || '', target || ''];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${AUDIT_SHEET}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });

      return res.status(200).json({ success: true, message: 'Audit log recorded.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[audit.js] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
