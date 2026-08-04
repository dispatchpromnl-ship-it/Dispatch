// ── Shared serverless auth helpers ───────────────────────────────────────────
// Used by Vercel API routes that have no Express middleware chain.
// Validates x-username header against the USERS sheet.

const { SPREADSHEET_ID, SHEET } = require('./constants');

/**
 * Verifies that the x-username header belongs to an active user.
 * Returns { ok, user } on success or { ok: false, status, error } on failure.
 *
 * @param {object} sheets   Authenticated Sheets client
 * @param {string} username Value of the x-username header
 */
async function verifyUser(sheets, username) {
  if (!username || typeof username !== 'string' || username.length > 64) {
    return { ok: false, status: 401, error: 'Authentication required.' };
  }

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.USERS}!A1:F`,
  });

  const rows    = resp.data.values || [];
  const headers = rows[0] || [];
  const userRow = rows.slice(1).find(r => (r[0] || '').toLowerCase() === username.toLowerCase());

  if (!userRow) return { ok: false, status: 401, error: 'User not found.' };

  const col = key => userRow[headers.indexOf(key)] || '';

  if (col('ACTIVE').toUpperCase() !== 'YES') {
    return { ok: false, status: 401, error: 'Account is deactivated.' };
  }

  return {
    ok:   true,
    user: {
      username:    col('USERNAME'),
      role:        col('ROLE').toLowerCase(),
      displayName: col('DISPLAY_NAME'),
    },
  };
}

/**
 * Verifies x-username AND that the user has role === 'admin'.
 */
async function verifyAdmin(sheets, username) {
  const result = await verifyUser(sheets, username);
  if (!result.ok) return result;
  if (result.user.role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin access required.' };
  }
  return result;
}

module.exports = { verifyUser, verifyAdmin };
