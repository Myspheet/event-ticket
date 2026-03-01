const { customAlphabet } = require('nanoid');

// Alphanumeric uppercase only for backup codes
const nanoidAlpha = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

// Full nanoid for unique internal codes (URL-safe)
const nanoidFull = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);

function generateUniqueCode() {
  return nanoidFull();
}

function generateBackupCode() {
  // Format: XXXX-XXXX-XX  (10 chars with dashes for readability)
  const raw = nanoidAlpha();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
}

module.exports = { generateUniqueCode, generateBackupCode };
