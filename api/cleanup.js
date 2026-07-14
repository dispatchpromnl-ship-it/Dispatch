const { google } = require('googleapis');

const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const rawCreds = process.env.GOOGLE_CREDENTIALS;
    if (!rawCreds) return res.status(500).json({ error: 'GOOGLE_CREDENTIALS not set.' });

    const credentials = JSON.parse(rawCreds);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const results = {};

    for (const sheetName of ['PENDING', 'DATABASE']) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) {
        results[sheetName] = { before: 0, after: 0, removed: 0 };
        continue;
      }

      const header = rows[0];
      const jobIdCol = header.indexOf('JOB ID');
      if (jobIdCol === -1) {
        results[sheetName] = { error: 'JOB ID column not found' };
        continue;
      }

      const dataRows = rows.slice(1);
      const before = dataRows.length;

      const seen = new Set();
      const unique = [];
      for (const row of dataRows) {
        const jobId = (row[jobIdCol] || '').trim().toUpperCase();
        if (jobId && seen.has(jobId)) continue;
        if (jobId) seen.add(jobId);
        unique.push(row);
      }

      const removed = before - unique.length;

      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A2:Z`,
      });

      if (unique.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: unique },
        });
      }

      results[sheetName] = { before, after: unique.length, removed };
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('[cleanup] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
