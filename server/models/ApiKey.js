const mongoose = require('mongoose');
const apiKeySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true },
  scopes: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastUsedAt: { type: Date },
  expiresAt: { type: Date },
  revokedAt: { type: Date },
}, { timestamps: true });
module.exports = mongoose.model('ApiKey', apiKeySchema);