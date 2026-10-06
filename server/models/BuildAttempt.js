const mongoose = require('mongoose');
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
module.exports = mongoose.model('BuildAttempt', buildAttemptSchema);