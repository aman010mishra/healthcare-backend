const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
  slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  source: { type: String, enum: ['online', 'walkin', 'priority', 'followup', 'emergency'], required: true },
  status: { type: String, enum: ['allocated', 'cancelled', 'no_show', 'completed', 'waitlisted'], default: 'allocated' },
  priority: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Token', TokenSchema);