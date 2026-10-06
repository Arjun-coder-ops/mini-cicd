const mongoose = require('mongoose');
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  repository: { type: String, required: true },
  defaultBranch: { type: String, default: 'main' },
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  pipelineConfig: { type: String, default: '.ci.yml' },
}, { timestamps: true });
module.exports = mongoose.model('Project', projectSchema);