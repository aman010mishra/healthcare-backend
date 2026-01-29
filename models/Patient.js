const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['normal', 'priority', 'followup'], required: true }
});

module.exports = mongoose.model('Patient', PatientSchema);