// ── Google Sheets auth & client factory ────────────────────────────────────
const { google } = require('googleapis');

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Parses GOOGLE_CREDENTIALS env var.
 * @returns {object} Parsed credentials
 */
function parseCredentials() {
  const rawCreds = process.env.GOOGLE_CREDENTIALS;
  if (!rawCreds) {
    const err = new Error('GOOGLE_CREDENTIALS environment variable is not set.');
    err.statusCode = 500;
    throw err;
  }
  try {
    return JSON.parse(rawCreds);
  } catch {
    const err = new Error('GOOGLE_CREDENTIALS is not valid JSON.');
    err.statusCode = 500;
    throw err;
  }
}

/**
 * Creates an authenticated GoogleAuth client with the given scopes.
 * @param {string[]} scopes
 * @returns {import('googleapis').GoogleAuth}
 */
function createAuth(scopes) {
  const credentials = parseCredentials();
  return new google.auth.GoogleAuth({ credentials, scopes });
}

/**
 * Returns an authenticated Google Sheets client.
 * @returns {import('googleapis').sheets_v4.Sheets}
 */
function getSheetsClient() {
  const auth = createAuth(['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
}

// ── Column rename migrations ────────────────────────────────────────────────
const COLUMN_RENAMES = {
  'PAYMENT STATUS': 'INVOICE DUE DATE',
};

/**
 * Ensures the first row of a sheet has headers. Appends if empty, or renames
 * any old column headers that have been migrated.
 */
async function ensureHeaders(sheets, spreadsheetId, sheetName, headers) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1`,
  });

  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:            `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody:      { values: [headers] },
    });
    return;
  }

  const currentHeaders = existing.data.values[0];
  let needsUpdate = false;
  const updatedHeaders = currentHeaders.map(h => {
    if (COLUMN_RENAMES[h] && headers.includes(COLUMN_RENAMES[h])) {
      needsUpdate = true;
      return COLUMN_RENAMES[h];
    }
    return h;
  });

  // Add any new columns that don't exist yet
  for (const h of headers) {
    if (!updatedHeaders.includes(h)) {
      updatedHeaders.push(h);
      needsUpdate = true;
    }
  }

  if (needsUpdate) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody:      { values: [updatedHeaders] },
    });
    console.log(`[sheets] Updated headers in ${sheetName}`);
  }
}

module.exports = {
  getSheetsClient, ensureHeaders,
  MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES,
};
