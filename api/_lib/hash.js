// ── Password hashing ──────────────────────────────────────────────────────────
const crypto = require('crypto');

/**
 * Returns the SHA-256 hex digest of a password string.
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = { hashPassword };
