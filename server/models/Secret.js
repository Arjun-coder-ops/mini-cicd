const mongoose = require('mongoose');
const secretSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  encryptedValue: { type: String, required: true },
  environment: { type: String, enum: ['preview', 'staging', 'production', 'all'], default: 'all' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
secretSchema.index({ projectId: 1, name: 1, environment: 1 }, { unique: true });
module.exports = mongoose.model('Secret', secretSchema);