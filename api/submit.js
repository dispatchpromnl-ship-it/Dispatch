// DEPRECATED — This endpoint is no longer used.
// Requests now go through /api/approve which handles the approval workflow.
// This file is kept only to prevent 404 errors from old cached frontends.

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated. Please refresh your browser and use the updated form.',
  });
};
