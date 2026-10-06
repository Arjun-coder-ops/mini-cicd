const express = require('express');
const crypto = require('crypto');
const Secret = require('../models/Secret');
const { requireAuth, requireProjectRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (process.env.NODE_ENV === 'production') {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required in production');
  }
  if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string');
  }
} else if (!ENCRYPTION_KEY) {
  // Safe default for dev, but will cause secrets to be lost on restart
  ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: Using random ENCRYPTION_KEY. Secrets will be unreadable after restart.');
}

const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const textParts = text.split(':');
  if (textParts.length === 2) {
    // Legacy CBC support if needed, but for now we assume GCM or fail
    throw new Error('Legacy encryption format not supported');
  }
  const iv = Buffer.from(textParts.shift(), 'hex');
  const authTag = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// Routes
router.get('/', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER']), async (req, res) => {
  try {
    const secrets = await Secret.find({ projectId: req.query.projectId }).select('-value');
    res.json(secrets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { name, value, projectId } = req.body;
    const encryptedValue = encrypt(value);
    
    // Upsert
    let secret = await Secret.findOne({ name, projectId });
    if (secret) {
      secret.value = encryptedValue;
    } else {
      secret = new Secret({ name, value: encryptedValue, projectId, createdBy: req.user._id });
    }
    await secret.save();
    
    const safeSecret = secret.toObject();
    delete safeSecret.value;
    res.status(201).json(safeSecret);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    await Secret.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, encrypt, decrypt };

