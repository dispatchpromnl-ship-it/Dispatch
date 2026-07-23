const { getSheetsClient }       = require('./_lib/sheets');
const { cors }                  = require('./_lib/cors');
const { SPREADSHEET_ID, SHEET } = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  try {
    const sheets  = getSheetsClient();
    const results = {};

    for (const sheetName of [SHEET.PENDING, SHEET.DATABASE]) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) {
        results[sheetName] = { before: 0, after: 0, removed: 0 };
        continue;
      }

      const header    = rows[0];
      const jobIdCol  = header.indexOf('JOB ID');
      if (jobIdCol === -1) {
        results[sheetName] = { error: 'JOB ID column not found' };
        continue;
      }

      const dataRows = rows.slice(1);
      const before   = dataRows.length;

      const seen   = new Set();
      const unique = dataRows.filter(row => {
        const jobId = (row[jobIdCol] || '').trim().toUpperCase();
        if (jobId && seen.has(jobId)) return false;
        if (jobId) seen.add(jobId);
        return true;
      });

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
    console.error('[cleanup]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
