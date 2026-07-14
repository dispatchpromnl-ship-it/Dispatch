const { google } = require('googleapis');
const crypto = require('crypto');

const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const rawCreds = process.env.GOOGLE_CREDENTIALS;
    if (!rawCreds) return res.status(500).json({ success: false, error: 'GOOGLE_CREDENTIALS not set.' });

    const credentials = JSON.parse(rawCreds);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const { secret } = req.body || {};
    if (secret !== 'DISPATCH_PRO_SETUP_2026') {
      return res.status(403).json({ success: false, error: 'Invalid setup key.' });
    }

    // ── Get or create sheets ────────────────────────────────────────────────
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

    const sheetsToCreate = [];
    if (!existingSheets.includes('USERS')) sheetsToCreate.push({ addSheet: { properties: { title: 'USERS' } } });
    if (!existingSheets.includes('PENDING')) sheetsToCreate.push({ addSheet: { properties: { title: 'PENDING' } } });
    if (!existingSheets.includes('DATABASE')) sheetsToCreate.push({ addSheet: { properties: { title: 'DATABASE' } } });
    if (!existingSheets.includes('AUDIT_LOG')) sheetsToCreate.push({ addSheet: { properties: { title: 'AUDIT_LOG' } } });

    if (sheetsToCreate.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: sheetsToCreate },
      });
    }

    // ── Write USERS headers + default accounts ──────────────────────────────
    const userHeaders = ['USERNAME', 'PASSWORD', 'ROLE', 'DISPLAY_NAME', 'ACTIVE', 'CREATED'];
    const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

    // Default accounts: 2 admins + 8 users
    const defaultUsers = [
      // Admins
      ['ADMIN1', 'admin123', 'admin', 'ADMIN ONE', 'YES', now],
      ['ADMIN2', 'admin123', 'admin', 'ADMIN TWO', 'YES', now],
      // Regular Users
      ['USER1', 'user123', 'user', 'USER ONE', 'YES', now],
      ['USER2', 'user123', 'user', 'USER TWO', 'YES', now],
      ['USER3', 'user123', 'user', 'USER THREE', 'YES', now],
      ['USER4', 'user123', 'user', 'USER FOUR', 'YES', now],
      ['USER5', 'user123', 'user', 'USER FIVE', 'YES', now],
      ['USER6', 'user123', 'user', 'USER SIX', 'YES', now],
      ['USER7', 'user123', 'user', 'USER SEVEN', 'YES', now],
      ['USER8', 'user123', 'user', 'USER EIGHT', 'YES', now],
    ];

    // Hash passwords
    const hashedUsers = defaultUsers.map(u => [u[0], hashPassword(u[1]), u[2], u[3], u[4], u[5]]);

    // Check if USERS has data
    const usersData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'USERS!A1:A1',
    });

    if (!usersData.data.values || usersData.data.values.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'USERS!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [userHeaders, ...hashedUsers] },
      });
    }

    // ── Write PENDING headers ───────────────────────────────────────────────
    const pendingHeaders = [
      'DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
      'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
      'BANK NAME', 'TOTAL AMOUNT', 'PAYMENT STATUS', 'TIMESTAMP',
      'SUBMITTED BY', 'STATUS', 'ADMIN_REMARKS', 'REVIEWED_BY', 'REVIEWED_AT',
    ];

    const pendingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'PENDING!A1:A1',
    });

    if (!pendingData.data.values || pendingData.data.values.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'PENDING!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [pendingHeaders] },
      });
    }

    // Also ensure DATABASE has headers
    const dbHeaders = [
      'DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
      'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
      'BANK NAME', 'TOTAL AMOUNT', 'PAYMENT STATUS', 'TIMESTAMP',
    ];

    const dbData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DATABASE!A1:A1',
    });

    if (!dbData.data.values || dbData.data.values.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DATABASE!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [dbHeaders] },
      });
    }

    // ── Create AUDIT_LOG sheet ───────────────────────────────────────────────
    const auditHeaders = ['TIMESTAMP', 'ACTION', 'USER', 'DETAILS', 'TARGET'];

    const auditData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'AUDIT_LOG!A1:A1',
    });

    if (!auditData.data.values || auditData.data.values.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'AUDIT_LOG!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [auditHeaders] },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Setup complete! USERS and PENDING sheets created with default accounts.',
      accounts: {
        admins: [
          { username: 'ADMIN1', password: 'admin123' },
          { username: 'ADMIN2', password: 'admin123' },
        ],
        users: [
          { username: 'USER1', password: 'user123' },
          { username: 'USER2', password: 'user123' },
          { username: 'USER3', password: 'user123' },
          { username: 'USER4', password: 'user123' },
          { username: 'USER5', password: 'user123' },
          { username: 'USER6', password: 'user123' },
          { username: 'USER7', password: 'user123' },
          { username: 'USER8', password: 'user123' },
        ],
      },
    });

  } catch (err) {
    console.error('[setup.js] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
