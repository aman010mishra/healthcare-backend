const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  maxCapacity: { type: Number, required: true },
  tokens: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Token' }],
  waitlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Token' }]
});

module.exports = mongoose.model('Slot', SlotSchema);