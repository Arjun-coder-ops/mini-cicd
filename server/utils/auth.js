const crypto = require('crypto');
const { apiToken } = require('../config');

const suppliedToken = req => {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return typeof req.query.token === 'string' ? req.query.token : '';
};

const tokensMatch = (actual, expected) => {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const requireApiAuth = (req, res, next) => {
  if (!apiToken) return res.status(503).json({ error: 'API authentication is not configured' });
  if (!tokensMatch(suppliedToken(req), apiToken)) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

module.exports = { requireApiAuth, tokensMatch };
