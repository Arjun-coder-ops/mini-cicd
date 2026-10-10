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
const listSecretsHandler = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.query.projectId;
    const secrets = await Secret.find({ projectId }).select('-encryptedValue');
    res.json({ secrets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createSecretHandler = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    const { name, value, environment = 'all' } = req.body;
    const encrypted = encrypt(value);
    
    // Upsert
    let secret = await Secret.findOne({ name, projectId, environment });
    if (secret) {
      secret.encryptedValue = encrypted;
    } else {
      secret = new Secret({ name, encryptedValue: encrypted, environment, projectId, createdBy: req.user._id });
    }
    await secret.save();
    
    const safeSecret = secret.toObject();
    delete safeSecret.encryptedValue;
    res.status(201).json({ secret: safeSecret, ...safeSecret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteSecretHandler = async (req, res) => {
  try {
    const id = req.params.secretId || req.params.id;
    await Secret.findByIdAndDelete(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get('/:projectId/secrets', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER']), listSecretsHandler);
router.get('/', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER']), listSecretsHandler);
router.post('/:projectId/secrets', requireProjectRole(['OWNER', 'ADMIN']), createSecretHandler);
router.post('/', requireProjectRole(['OWNER', 'ADMIN']), createSecretHandler);
router.delete('/:projectId/secrets/:secretId', requireProjectRole(['OWNER', 'ADMIN']), deleteSecretHandler);
router.delete('/:id', requireProjectRole(['OWNER', 'ADMIN']), deleteSecretHandler);

module.exports = { router, encrypt, decrypt };

