const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Slot' }]
});

module.exports = mongoose.model('Doctor', DoctorSchema);