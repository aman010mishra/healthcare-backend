// Simulate an OPD day with 3 doctors, multiple slots, and various token events
const mongoose = require('mongoose');
require('dotenv').config();
const Doctor = require('./models/Doctor');
const Slot = require('./models/Slot');
const Token = require('./models/Token');
const Patient = require('./models/Patient');

const PRIORITY_MAP = {
  emergency: 100,
  priority: 80,
  followup: 60,
  online: 40,
  walkin: 20
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  await Doctor.deleteMany({});
  await Slot.deleteMany({});
  await Token.deleteMany({});
  await Patient.deleteMany({});

  // Create 3 doctors
  const doctors = await Doctor.insertMany([
    { name: 'Dr. A' },
    { name: 'Dr. B' },
    { name: 'Dr. C' }
  ]);

  // Create slots for each doctor (9-10, 10-11)
  const now = new Date();
  const slots = [];
  for (const doc of doctors) {
    for (let i = 0; i < 2; i++) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + i, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10 + i, 0, 0);
      const slot = new Slot({
        doctor: doc._id,
        startTime: start,
        endTime: end,
        maxCapacity: 3
      });
      await slot.save();
      doc.slots.push(slot._id);
      slots.push(slot);
    }
    await doc.save();
  }

  // Create patients
  const patients = await Patient.insertMany([
    { name: 'Alice', type: 'normal' },
    { name: 'Bob', type: 'priority' },
    { name: 'Charlie', type: 'followup' },
    { name: 'Daisy', type: 'normal' },
    { name: 'Eve', type: 'normal' },
    { name: 'Frank', type: 'normal' },
    { name: 'Grace', type: 'normal' },
    { name: 'Henry', type: 'normal' }
  ]);

  // Book tokens for first slot of Dr. A
  const slot = slots[0];
  async function book(patient, source) {
    const token = new Token({
      slot: slot._id,
      patient: patient._id,
      source,
      status: 'allocated',
      priority: PRIORITY_MAP[source],
      createdAt: new Date()
    });
    await token.save();
    slot.tokens.push(token._id);
    await slot.save();
    return token;
  }

  // Fill slot: online, walkin, priority
  await book(patients[0], 'online');
  await book(patients[3], 'walkin');
  await book(patients[1], 'priority');

  // Try to add followup (should go to waitlist)
  const followupToken = new Token({
    slot: slot._id,
    patient: patients[2]._id,
    source: 'followup',
    status: 'waitlisted',
    priority: PRIORITY_MAP['followup'],
    createdAt: new Date()
  });
  await followupToken.save();
  slot.waitlist.push(followupToken._id);
  await slot.save();

  // Emergency insertion (should preempt walkin)
  const emergencyToken = new Token({
    slot: slot._id,
    patient: patients[4]._id,
    source: 'emergency',
    status: 'allocated',
    priority: PRIORITY_MAP['emergency'],
    createdAt: new Date()
  });
  await emergencyToken.save();
  // Find lowest-priority token (walkin)
  await slot.populate('tokens');
  let lowest = slot.tokens[0];
  for (const t of slot.tokens) {
    if (t.priority < lowest.priority) lowest = t;
  }
  slot.tokens = slot.tokens.filter(t => t._id.toString() !== lowest._id.toString());
  slot.waitlist.push(lowest._id);
  lowest.status = 'waitlisted';
  await lowest.save();
  slot.tokens.push(emergencyToken._id);
  await slot.save();

  // Cancel a token (online)
  const onlineToken = await Token.findOne({ slot: slot._id, source: 'online' });
  slot.tokens = slot.tokens.filter(t => t.toString() !== onlineToken._id.toString());
  onlineToken.status = 'cancelled';
  await onlineToken.save();
  // Allocate from waitlist (followup should be promoted)
  await slot.populate('waitlist');
  if (slot.waitlist.length && slot.tokens.length < slot.maxCapacity) {
    slot.waitlist.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
    const nextToken = slot.waitlist.shift();
    nextToken.status = 'allocated';
    await nextToken.save();
    slot.tokens.push(nextToken._id);
  }
  await slot.save();

  // Print final slot status
  await slot.populate('tokens');
  await slot.populate('waitlist');
  console.log('Final tokens in slot:', slot.tokens.map(t => ({ patient: t.patient, source: t.source, status: t.status })));
  console.log('Waitlist:', slot.waitlist.map(t => ({ patient: t.patient, source: t.source, status: t.status })));

  await mongoose.disconnect();
}

main();
