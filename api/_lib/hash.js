const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function verifyPassword(password, hash) {
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compareSync(password, hash);
  }
  return sha256(password) === hash;
}

module.exports = { hashPassword, verifyPassword };
