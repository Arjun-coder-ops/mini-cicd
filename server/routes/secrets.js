
const express = require('express');
const crypto = require('crypto');
const Secret = require('../models/Secret');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireProjectRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // Fallback for dev only
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

router.get('/:projectId/secrets', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER']), async (req, res) => {
  try {
    // Only return names and environments, never values
    const secrets = await Secret.find({ projectId: req.params.projectId }).select('-encryptedValue');
    res.json({ secrets });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:projectId/secrets', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { name, value, environment } = req.body;
    const encryptedValue = encrypt(value);
    const secret = await Secret.create({
      projectId: req.params.projectId,
      name,
      encryptedValue,
      environment: environment || 'all',
      createdBy: req.user._id,
    });
    
    await AuditLog.create({
      projectId: req.params.projectId, userId: req.user._id, action: 'SECRET_CREATED', resourceType: 'SECRET', resourceId: secret._id.toString(), ipAddress: req.ip
    });
    
    const secretSafe = secret.toObject();
    delete secretSafe.encryptedValue;
    res.status(201).json({ secret: secretSafe });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:projectId/secrets/:secretId', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const secret = await Secret.findOneAndDelete({ _id: req.params.secretId, projectId: req.params.projectId });
    if (!secret) return res.status(404).json({ error: 'Secret not found' });
    
    await AuditLog.create({
      projectId: req.params.projectId, userId: req.user._id, action: 'SECRET_DELETED', resourceType: 'SECRET', resourceId: secret._id.toString(), ipAddress: req.ip
    });
    
    res.json({ message: 'Secret deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, decrypt };
