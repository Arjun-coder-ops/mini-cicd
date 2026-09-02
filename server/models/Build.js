const mongoose = require('mongoose');
const Counter = require('./Counter');

const stepSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  status:    { type: String, enum: ['pending', 'running', 'success', 'failed', 'cancelled', 'timed_out'], default: 'pending' },
  startedAt: { type: Date },
  finishedAt:{ type: Date },
  duration:  { type: Number }, // ms
});

const buildSchema = new mongoose.Schema(
  {
    // Unique build number (auto-incremented via pre-save)
    number: { type: Number, unique: true },

    // Source info
    repo:    { type: String, required: true }, // "owner/repo"
    branch:  { type: String, required: true },
    commit:  { type: String, required: true }, // full SHA
    commitShort: { type: String },             // first 7 chars
    commitMsg:   { type: String, default: '' },
    author:  { type: String, default: '' },

    // Pipeline status
    status: {
      type: String,
      enum: ['queued', 'running', 'success', 'failed', 'cancelled'],
      default: 'queued',
    },

    steps: [stepSchema],

    // Timing
    startedAt:  { type: Date },
    finishedAt: { type: Date },
    duration:   { type: Number }, // ms

    // Log file path (streamed line by line via SSE)
    logFile: { type: String },

    // Trigger
    trigger: { type: String, enum: ['push', 'manual', 'api'], default: 'push' },
  },
  { timestamps: true }
);

// Auto-increment build number
buildSchema.pre('save', async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      'build-number', { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }
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
