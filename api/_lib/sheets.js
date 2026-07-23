// ── Google Sheets auth & client factory ──────────────────────────────────────
const { google } = require('googleapis');

/**
 * Builds an authenticated Google Sheets client from the GOOGLE_CREDENTIALS env var.
 * Throws a structured error if the env var is missing or malformed.
 * @returns {import('googleapis').sheets_v4.Sheets}
 */
function getSheetsClient() {
  const rawCreds = process.env.GOOGLE_CREDENTIALS;
  if (!rawCreds) {
    const err = new Error('GOOGLE_CREDENTIALS environment variable is not set.');
    err.statusCode = 500;
    throw err;
  }

  let credentials;
  try {
    credentials = JSON.parse(rawCreds);
  } catch {
    const err = new Error('GOOGLE_CREDENTIALS is not valid JSON.');
    err.statusCode = 500;
    throw err;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Ensures the first row of a sheet has headers. Appends them if the sheet is empty.
 * @param {import('googleapis').sheets_v4.Sheets} sheets
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
      range:            `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody:      { values: [headers] },
    });
  }
}

module.exports = { getSheetsClient, ensureHeaders };
