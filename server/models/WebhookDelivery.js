const mongoose = require('mongoose');
const webhookDeliverySchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  eventType: { type: String, required: true },
  payloadHash: { type: String, required: true },
  processedAt: { type: Date },
  status: { type: String, enum: ['received', 'processed', 'failed', 'ignored'], default: 'received' },
}, { timestamps: true });
module.exports = mongoose.model('WebhookDelivery', webhookDeliverySchema);