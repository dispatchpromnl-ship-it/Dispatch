// ── Shared CORS helper ────────────────────────────────────────────────────────

/**
 * Sets CORS headers on the response.
 * @param {object} res - Express/Vercel response object
 * @param {string} [methods='GET, POST, PUT, DELETE, OPTIONS'] - Allowed methods
 */
function cors(res, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { cors };
