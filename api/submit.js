const { google } = require('googleapis');

// ── Configuration ────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';
const SHEET_NAME     = 'DATABASE'; // Your sheet tab name

// ── Column order (must match your Google Sheet's Row 1 headers) ───────────────
const COLUMNS = [
  'DATE REQUESTED',
  'JOB ID',
  'PARTICULARS',
  'CONSIGNEE',
  'MBL',
  'HBL',
  'CONTAINER NUMBER',
  'REQUESTED BY',
  "SUPPLIER'S NAME",
  'ACCOUNT NO.',
  'BANK NAME',
  'TOTAL AMOUNT',
  'PAYMENT STATUS',
  'TIMESTAMP',
];

// ── Key → Column mapping ──────────────────────────────────────────────────────
const KEY_MAP = {
  date_requested   : 'DATE REQUESTED',
  job_id           : 'JOB ID',
  particulars      : 'PARTICULARS',
  consignee        : 'CONSIGNEE',
  mbl              : 'MBL',
  hbl              : 'HBL',
  container_number : 'CONTAINER NUMBER',
  requested_by     : 'REQUESTED BY',
  supplier_name    : "SUPPLIER'S NAME",
  account_no       : 'ACCOUNT NO.',
  bank_name        : 'BANK NAME',
  amount_2         : 'TOTAL AMOUNT',
  payment_status   : 'PAYMENT STATUS',
  timestamp        : 'TIMESTAMP',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildRow(data) {
  return COLUMNS.map(col => {
    const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
    return key && data[key] !== undefined ? String(data[key]) : '';
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Main Handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  cors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // ── Authenticate with Google using Service Account credentials ────────────
    const rawCreds = process.env.GOOGLE_CREDENTIALS;
    if (!rawCreds) {
      return res.status(500).json({
        success : false,
        error   : 'GOOGLE_CREDENTIALS environment variable is not set.',
      });
    }

    const credentials = JSON.parse(rawCreds);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ── Parse form body ───────────────────────────────────────────────────────
    const data = req.body || {};

    // ── Check if header row exists; write it if the sheet is empty ────────────
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId : SPREADSHEET_ID,
      range         : `${SHEET_NAME}!A1:A1`,
    });

    if (!existing.data.values || existing.data.values.length === 0) {
      // Sheet is empty — write headers first
      await sheets.spreadsheets.values.append({
        spreadsheetId : SPREADSHEET_ID,
        range         : `${SHEET_NAME}!A1`,
        valueInputOption : 'RAW',
        requestBody   : { values: [COLUMNS] },
      });
    }

    // ── Append the data row ───────────────────────────────────────────────────
    const row = buildRow(data);

    await sheets.spreadsheets.values.append({
      spreadsheetId    : SPREADSHEET_ID,
      range            : `${SHEET_NAME}!A1`,
      valueInputOption : 'USER_ENTERED',
      requestBody      : { values: [row] },
    });

    return res.status(200).json({
      success  : true,
      message  : 'Row appended successfully.',
      sheet    : SHEET_NAME,
      columns  : row.length,
    });

  } catch (err) {
    console.error('[submit.js] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
