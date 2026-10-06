const fs = require('fs');

const models = {
  'User.js': `const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['PLATFORM_ADMIN', 'USER'], default: 'USER' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  lastLoginAt: { type: Date },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);`,

  'Project.js': `const mongoose = require('mongoose');
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  repository: { type: String, required: true },
  defaultBranch: { type: String, default: 'main' },
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  pipelineConfig: { type: String, default: '.ci.yml' },
}, { timestamps: true });
module.exports = mongoose.model('Project', projectSchema);`,

  'ProjectMember.js': `const mongoose = require('mongoose');
const projectMemberSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'], required: true },
}, { timestamps: true });
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
module.exports = mongoose.model('ProjectMember', projectMemberSchema);`,

  'BuildAttempt.js': `const mongoose = require('mongoose');
const buildAttemptSchema = new mongoose.Schema({
  buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Build', required: true },
  attemptNumber: { type: Number, required: true },
  workerId: { type: String },
  status: { type: String, enum: ['pending', 'running', 'success', 'failed', 'cancelled', 'timed_out'], default: 'pending' },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  duration: { type: Number },
  failureReason: { type: String },
}, { timestamps: true });
buildAttemptSchema.index({ buildId: 1, attemptNumber: 1 }, { unique: true });
module.exports = mongoose.model('BuildAttempt', buildAttemptSchema);`,

  'Deployment.js': `const mongoose = require('mongoose');
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
module.exports = mongoose.model('Deployment', deploymentSchema);`,

  'ApiKey.js': `const mongoose = require('mongoose');
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
module.exports = mongoose.model('ApiKey', apiKeySchema);`,

  'Secret.js': `const mongoose = require('mongoose');
const secretSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  encryptedValue: { type: String, required: true },
  environment: { type: String, enum: ['preview', 'staging', 'production', 'all'], default: 'all' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
secretSchema.index({ projectId: 1, name: 1, environment: 1 }, { unique: true });
module.exports = mongoose.model('Secret', secretSchema);`,

  'AuditLog.js': `const mongoose = require('mongoose');
const auditLogSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
}, { timestamps: true });
module.exports = mongoose.model('AuditLog', auditLogSchema);`,

  'WebhookDelivery.js': `const mongoose = require('mongoose');
const webhookDeliverySchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  eventType: { type: String, required: true },
  payloadHash: { type: String, required: true },
  processedAt: { type: Date },
  status: { type: String, enum: ['received', 'processed', 'failed', 'ignored'], default: 'received' },
}, { timestamps: true });
module.exports = mongoose.model('WebhookDelivery', webhookDeliverySchema);`
};

for (const [file, content] of Object.entries(models)) {
  fs.writeFileSync('server/models/' + file, content);
}
console.log('Models created.');
