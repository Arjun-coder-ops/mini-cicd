const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['PLATFORM_ADMIN', 'USER'], default: 'USER' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  lastLoginAt: { type: Date },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);