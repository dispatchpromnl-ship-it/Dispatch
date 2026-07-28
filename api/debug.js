const { cors } = require('./_lib/cors');
const { SPREADSHEET_ID, SHEET } = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'GET only' });

  const report = { checks: [] };

  // 1. Check GOOGLE_CREDENTIALS
  const rawCreds = process.env.GOOGLE_CREDENTIALS;
  if (!rawCreds) {
    report.checks.push({ name: 'GOOGLE_CREDENTIALS', status: 'MISSING', detail: 'Set this env var in Vercel dashboard.' });
  } else {
    try {
      const creds = JSON.parse(rawCreds);
      report.checks.push({ name: 'GOOGLE_CREDENTIALS', status: 'OK', detail: `type: ${creds.type || 'unknown'}, project: ${creds.project_id || 'unknown'}` });
    } catch {
      report.checks.push({ name: 'GOOGLE_CREDENTIALS', status: 'INVALID', detail: 'Not valid JSON. Check copy-paste.' });
    }
  }

  // 2. Check SETUP_SECRET
  if (process.env.SETUP_SECRET) {
    report.checks.push({ name: 'SETUP_SECRET', status: 'OK', detail: 'Set (hidden)' });
  } else {
    report.checks.push({ name: 'SETUP_SECRET', status: 'MISSING', detail: 'Optional but recommended. Set in Vercel dashboard.' });
  }

  // 3. Try connecting to Google Sheets
  if (rawCreds) {
    try {
      const { getSheetsClient } = require('./_lib/sheets');
      const sheets = getSheetsClient();

      // Try reading USERS sheet
      try {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET.USERS}!A1:F`,
        });
        const rows = resp.data.values || [];
        if (rows.length <= 1) {
          report.checks.push({ name: 'USERS Sheet', status: 'EMPTY', detail: 'Sheet exists but has no user rows. Run /api/setup to create accounts.' });
        } else {
          const headers = rows[0];
          const userCount = rows.length - 1;
          report.checks.push({ name: 'USERS Sheet', status: 'OK', detail: `${userCount} user(s), columns: ${headers.join(', ')}` });
        }
      } catch (sheetErr) {
        report.checks.push({ name: 'USERS Sheet', status: 'ERROR', detail: sheetErr.message });
      }
    } catch (authErr) {
      report.checks.push({ name: 'Google Auth', status: 'ERROR', detail: authErr.message });
    }
  }

  return res.status(200).json({ success: true, report });
};
