const mongoose = require('mongoose');
const Counter = require('./Counter');

const stepSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['pending', 'running', 'success', 'failed', 'cancelled', 'timed_out'], default: 'pending' },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  duration: { type: Number }, // ms
});

const buildSchema = new mongoose.Schema({
  number: { type: Number },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  triggerType: { type: String, enum: ['push', 'manual', 'api'], default: 'push' },

  // Source info
  repo: { type: String, required: true },
  branch: { type: String, required: true },
  commit: { type: String, required: true },
  commitShort: { type: String },
  commitMessage: { type: String, default: '' },
  author: { type: String, default: '' },

  // Pipeline status
  status: {
    type: String,
    enum: ['queued', 'running', 'success', 'failed', 'cancelled', 'timed_out'],
    default: 'queued',
  },

  queueMetadata: { type: mongoose.Schema.Types.Mixed },

  steps: [stepSchema],

  // Timing
  startedAt: { type: Date },
  finishedAt: { type: Date },
  duration: { type: Number }, // ms

  failureReason: { type: String },
  idempotencyKey: { type: String },
  logFile: { type: String }, // For backward compatibility with Phase 0 logic
  logs: { type: String, default: '' },
}, { timestamps: true });

// Make it unique per project, but omit unique constraint if projectId is missing for backward compat
buildSchema.index({ projectId: 1, number: 1 }, { unique: true, sparse: true });
buildSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// Auto-increment build number
buildSchema.pre('save', async function (next) {
  if (this.isNew) {
    const counterId = this.projectId ? `build-number-${this.projectId}` : 'build-number';
    const counter = await Counter.findByIdAndUpdate(
      counterId, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    this.number = counter.sequence;
    this.commitShort = this.commit?.slice(0, 7) || 'unknown';
  }
  next();
});

// Virtual: duration in seconds
buildSchema.virtual('durationSec').get(function () {
  if (!this.duration) return null;
  return (this.duration / 1000).toFixed(1);
});

module.exports = mongoose.model('Build', buildSchema);
