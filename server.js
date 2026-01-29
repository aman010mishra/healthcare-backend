const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Models
const Doctor = require('./models/Doctor');
const Slot = require('./models/Slot');
const Token = require('./models/Token');
const Patient = require('./models/Patient');

// --- API Endpoints ---

// 1. Create Doctor
app.post('/doctors', async (req, res) => {
  try {
    const doctor = new Doctor({ name: req.body.name });
    await doctor.save();
    res.json(doctor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Create Slot
app.post('/doctors/:doctorId/slots', async (req, res) => {
  try {
    const { startTime, endTime, maxCapacity } = req.body;
    const slot = new Slot({
      doctor: req.params.doctorId,
      startTime,
      endTime,
      maxCapacity
    });
    await slot.save();
    await Doctor.findByIdAndUpdate(req.params.doctorId, { $push: { slots: slot._id } });
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Create Patient
app.post('/patients', async (req, res) => {
  try {
    const patient = new Patient({ name: req.body.name, type: req.body.type });
    await patient.save();
    res.json(patient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Book Token
const PRIORITY_MAP = {
  emergency: 100,
  priority: 80,
  followup: 60,
  online: 40,
  walkin: 20
};

async function allocateToken(slot, token) {
  await slot.populate('tokens');
  if (slot.tokens.length < slot.maxCapacity) {
    slot.tokens.push(token._id);
    await slot.save();
    return 'allocated';
  }
  // Preemption logic
  let lowestToken = null;
  for (const t of slot.tokens) {
    const tok = await Token.findById(t);
    if (!lowestToken || tok.priority < lowestToken.priority || (tok.priority === lowestToken.priority && tok.createdAt < lowestToken.createdAt)) {
      lowestToken = tok;
    }
  }
  if (token.priority > lowestToken.priority) {
    // Remove lowest, add to waitlist
    slot.tokens = slot.tokens.filter(t => t.toString() !== lowestToken._id.toString());
    slot.waitlist.push(lowestToken._id);
    lowestToken.status = 'waitlisted';
    await lowestToken.save();
    slot.tokens.push(token._id);
    await slot.save();
    return 'preempted';
  } else {
    slot.waitlist.push(token._id);
    await slot.save();
    return 'waitlisted';
  }
}

app.post('/slots/:slotId/tokens', async (req, res) => {
  try {
    const { patientId, source } = req.body;
    const slot = await Slot.findById(req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Duplicate booking check: same patient, same slot
    const existingToken = await Token.findOne({ slot: slot._id, patient: patient._id, status: { $in: ['allocated', 'waitlisted'] } });
    if (existingToken) {
      return res.status(409).json({ error: 'Duplicate booking: Patient already has a token for this slot.' });
    }

    // Duplicate booking check: same patient, overlapping slot time
    // Find all slots for this doctor that overlap in time
    const overlappingSlots = await Slot.find({
      doctor: slot.doctor,
      $or: [
        { startTime: { $lt: slot.endTime }, endTime: { $gt: slot.startTime } }
      ]
    });
    const overlappingSlotIds = overlappingSlots.map(s => s._id);
    const duplicateToken = await Token.findOne({ slot: { $in: overlappingSlotIds }, patient: patient._id, status: { $in: ['allocated', 'waitlisted'] } });
    if (duplicateToken) {
      return res.status(409).json({ error: 'Duplicate booking: Patient already has a token for an overlapping slot.' });
    }

    const priority = PRIORITY_MAP[source] || 0;
    const token = new Token({ slot: slot._id, patient: patient._id, source, status: 'allocated', priority });
    await token.save();
    const status = await allocateToken(slot, token);
    token.status = (status === 'allocated' || status === 'preempted') ? 'allocated' : 'waitlisted';
    await token.save();
    res.json({ token, status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Cancel Token
app.post('/tokens/:tokenId/cancel', async (req, res) => {
  try {
    const token = await Token.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ error: 'Token not found' });
    const slot = await Slot.findById(token.slot);
    slot.tokens = slot.tokens.filter(t => t.toString() !== token._id.toString());
    slot.waitlist = slot.waitlist.filter(t => t.toString() !== token._id.toString());
    token.status = 'cancelled';
    await token.save();
    // Reallocate from waitlist
    await slot.populate('waitlist');
    if (slot.waitlist.length && slot.tokens.length < slot.maxCapacity) {
      slot.waitlist.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
      const nextToken = slot.waitlist.shift();
      nextToken.status = 'allocated';
      await nextToken.save();
      slot.tokens.push(nextToken._id);
    }
    await slot.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Mark No-Show
app.post('/tokens/:tokenId/no_show', async (req, res) => {
  try {
    const token = await Token.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ error: 'Token not found' });
    const slot = await Slot.findById(token.slot);
    slot.tokens = slot.tokens.filter(t => t.toString() !== token._id.toString());
    token.status = 'no_show';
    await token.save();
    // Reallocate from waitlist
    await slot.populate('waitlist');
    if (slot.waitlist.length && slot.tokens.length < slot.maxCapacity) {
      slot.waitlist.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
      const nextToken = slot.waitlist.shift();
      nextToken.status = 'allocated';
      await nextToken.save();
      slot.tokens.push(nextToken._id);
    }
    await slot.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Emergency Add
app.post('/slots/:slotId/emergency', async (req, res) => {
  try {
    const { patientId } = req.body;
    const slot = await Slot.findById(req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const token = new Token({ slot: slot._id, patient: patient._id, source: 'emergency', status: 'allocated', priority: PRIORITY_MAP['emergency'] });
    await token.save();
    const status = await allocateToken(slot, token);
    token.status = (status === 'allocated' || status === 'preempted') ? 'allocated' : 'waitlisted';
    await token.save();
    res.json({ token, status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Get Slot Status
app.get('/slots/:slotId', async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.slotId).populate('tokens').populate('waitlist');
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json({ slot, tokens: slot.tokens, waitlist: slot.waitlist });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
