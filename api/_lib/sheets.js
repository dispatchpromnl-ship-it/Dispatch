// ── Google Sheets auth & client factory ──────────────────────────────────────
const { google } = require('googleapis');

/**
 * Builds an authenticated Google Sheets client from the GOOGLE_CREDENTIALS env var.
 * Throws if the env var is missing.
 * @returns {{ sheets: import('googleapis').sheets_v4.Sheets }}
 */
function getSheetsClient() {
  const rawCreds = process.env.GOOGLE_CREDENTIALS;
  if (!rawCreds) {
    const err = new Error('GOOGLE_CREDENTIALS not set.');
    err.statusCode = 500;
    throw err;
  }

  const credentials = JSON.parse(rawCreds);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Ensures the first row of a sheet range has headers. Appends them if missing.
 * @param {object} sheets - Authenticated Sheets client
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {string[]} headers
 */
async function ensureHeaders(sheets, spreadsheetId, sheetName, headers) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:A1`,
  });

  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

module.exports = { getSheetsClient, ensureHeaders };
