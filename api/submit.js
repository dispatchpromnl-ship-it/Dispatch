// DEPRECATED — kept only to return a clear error to old cached frontends.
const { cors } = require('./_lib/cors');

module.exports = function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated. Please refresh your browser and use the updated form.',
  });
};
