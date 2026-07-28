// ── Audit log writer ──────────────────────────────────────────────────────────
const { SPREADSHEET_ID, SHEET } = require('./constants');

const AUDIT_HEADERS = ['TIMESTAMP', 'ACTION', 'USER', 'DETAILS', 'TARGET'];

/**
 * Appends one row to the AUDIT_LOG sheet.
 * Silently logs errors so audit failures never break the main request flow.
 *
 * @param {object} sheets    - Authenticated Sheets client
 * @param {string} action    - e.g. 'REQUEST_SUBMITTED'
 * @param {string} user      - Username performing the action
 * @param {string} [details] - Human-readable detail string
 * @param {string} [target]  - Target identifier (row, username, job ID, etc.)
 */
async function writeAuditLog(sheets, action, user, details = '', target = '') {
  try {
    const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

    // Ensure headers row exists
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET.AUDIT_LOG}!A1:A1`,
    });

    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.AUDIT_LOG}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [AUDIT_HEADERS] },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET.AUDIT_LOG}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[now, action, user, details, target]] },
    });
  } catch (e) {
    console.error('[audit] Write failed:', e.message);
  }
}

module.exports = { writeAuditLog, AUDIT_HEADERS };
