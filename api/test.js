module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ alive: true, timestamp: new Date().toISOString() });
};
