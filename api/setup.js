const { getSheetsClient, ensureHeaders } = require('./_lib/sheets');
const { cors }                           = require('./_lib/cors');
const { hashPassword }                   = require('./_lib/hash');
const { AUDIT_HEADERS }                  = require('./_lib/audit');
const {
  SPREADSHEET_ID, SHEET,
  PENDING_COLUMNS, DB_COLUMNS,
} = require('./_lib/constants');

const SETUP_SECRET   = 'DISPATCH_PRO_SETUP_2026';
const USER_HEADERS   = ['USERNAME', 'PASSWORD', 'ROLE', 'DISPLAY_NAME', 'ACTIVE', 'CREATED'];

const DEFAULT_USERS = [
  ['ADMIN1', 'admin123', 'admin', 'ADMIN ONE'],
  ['ADMIN2', 'admin123', 'admin', 'ADMIN TWO'],
  ['USER1',  'user123',  'user',  'USER ONE'],
  ['USER2',  'user123',  'user',  'USER TWO'],
  ['USER3',  'user123',  'user',  'USER THREE'],
  ['USER4',  'user123',  'user',  'USER FOUR'],
  ['USER5',  'user123',  'user',  'USER FIVE'],
  ['USER6',  'user123',  'user',  'USER SIX'],
  ['USER7',  'user123',  'user',  'USER SEVEN'],
  ['USER8',  'user123',  'user',  'USER EIGHT'],
];

module.exports = async function handler(req, res) {
  cors(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  try {
    const { secret } = req.body || {};
    if (secret !== SETUP_SECRET) {
      return res.status(403).json({ success: false, error: 'Invalid setup key.' });
    }

    const sheets = getSheetsClient();

    // ── Ensure all required sheets exist ────────────────────────────────
    const spreadsheet   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingNames = spreadsheet.data.sheets.map(s => s.properties.title);
    const toCreate      = [SHEET.USERS, SHEET.PENDING, SHEET.DATABASE, SHEET.AUDIT_LOG]
      .filter(name => !existingNames.includes(name))
      .map(title => ({ addSheet: { properties: { title } } }));

    if (toCreate.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: toCreate },
      });
    }

    const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

    // ── USERS: write headers + default accounts if empty ────────────────
    const usersData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET.USERS}!A1:A1`,
    });
    if (!usersData.data.values || usersData.data.values.length === 0) {
      const rows = DEFAULT_USERS.map(([u, p, r, d]) => [
        u, hashPassword(p), r, d, 'YES', now,
      ]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.USERS}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [USER_HEADERS, ...rows] },
      });
    }

    // ── PENDING / DATABASE / AUDIT_LOG: ensure headers only ─────────────
    await ensureHeaders(sheets, SPREADSHEET_ID, SHEET.PENDING,   PENDING_COLUMNS);
    await ensureHeaders(sheets, SPREADSHEET_ID, SHEET.DATABASE,  DB_COLUMNS);
    await ensureHeaders(sheets, SPREADSHEET_ID, SHEET.AUDIT_LOG, AUDIT_HEADERS);

    return res.status(200).json({
      success: true,
      message: 'Setup complete! Sheets created with default accounts.',
      accounts: {
        admins: DEFAULT_USERS.filter(u => u[2] === 'admin').map(([username, password]) => ({ username, password })),
        users:  DEFAULT_USERS.filter(u => u[2] === 'user').map(([username, password])  => ({ username, password })),
      },
    });

  } catch (err) {
    console.error('[setup.js]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
