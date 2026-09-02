const mongoose = require('mongoose');

module.exports = mongoose.model('Counter', new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
}));
