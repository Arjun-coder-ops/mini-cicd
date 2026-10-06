const mongoose = require('mongoose');
const deploymentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Build', required: true },
  environment: { type: String, enum: ['preview', 'staging', 'production'], required: true },
  status: { type: String, enum: ['pending', 'running', 'success', 'failed', 'cancelled'], default: 'pending' },
  commit: { type: String, required: true },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  duration: { type: Number },
  deployedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deploymentMetadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });
module.exports = mongoose.model('Deployment', deploymentSchema);