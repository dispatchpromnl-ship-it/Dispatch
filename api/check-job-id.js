const { google } = require('googleapis');

const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';
const PENDING_SHEET = 'PENDING';
const DATABASE_SHEET = 'DATABASE';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawCreds = process.env.GOOGLE_CREDENTIALS;
    if (!rawCreds) return res.status(500).json({ error: 'GOOGLE_CREDENTIALS not set.' });

    const credentials = JSON.parse(rawCreds);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    let pendingIds = [];
    let dbIds = [];

    try {
      const pendingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: `${PENDING_SHEET}!B:B`,
      });
      pendingIds = (pendingRes.data.values || []).slice(1).map(r => (r[0] || '').trim().toUpperCase()).filter(Boolean);
    } catch (e) { console.error('[check-job-id] PENDING read failed:', e.message); }

    try {
      const dbRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: `${DATABASE_SHEET}!B:B`,
      });
      dbIds = (dbRes.data.values || []).slice(1).map(r => (r[0] || '').trim().toUpperCase()).filter(Boolean);
    } catch (e) { console.error('[check-job-id] DATABASE read failed:', e.message); }

    const allIds = [...new Set([...pendingIds, ...dbIds])];

    return res.status(200).json({
      success: true,
      pendingIds,
      dbIds,
      allIds,
    });
  } catch (err) {
    console.error('[check-job-id] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
