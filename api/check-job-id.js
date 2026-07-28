const { getSheetsClient }       = require('./_lib/sheets');
const { cors }                  = require('./_lib/cors');
const { SPREADSHEET_ID, SHEET } = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const sheets = getSheetsClient();

    const [pendingRes, dbRes] = await Promise.allSettled([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET.PENDING}!B:B` }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET.DATABASE}!B:B` }),
    ]);

    const toIds = result =>
      result.status === 'fulfilled'
        ? (result.value.data.values || []).slice(1).map(r => (r[0] || '').trim().toUpperCase()).filter(Boolean)
        : [];

    const pendingIds = toIds(pendingRes);
    const dbIds      = toIds(dbRes);
    const allIds     = [...new Set([...pendingIds, ...dbIds])];

    return res.status(200).json({ success: true, pendingIds, dbIds, allIds });

  } catch (err) {
    console.error('[check-job-id]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
