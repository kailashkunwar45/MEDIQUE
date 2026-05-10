const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Assume we are in apps/api
dotenv.config({ path: path.join(__dirname, '.env') });

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema);

const HospitalSchema = new mongoose.Schema({}, { strict: false });
const Hospital = mongoose.model('Hospital', HospitalSchema);

const AppointmentSchema = new mongoose.Schema({}, { strict: false });
const Appointment = mongoose.model('Appointment', AppointmentSchema);

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not found');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // 1. Find Doctor
    const doctor = await User.findOne({ name: /Prativa Sharma/i, role: 'doctor' });
    if (!doctor) throw new Error('Doctor Prativa Sharma not found');
    console.log(`Found Doctor: ${doctor.name} (${doctor._id})`);

    // 2. Find Hospital (from doctor's assignments)
    const hospitalId = doctor.hospitalIds && doctor.hospitalIds[0];
    if (!hospitalId) throw new Error('Doctor has no hospital assignment');
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) throw new Error('Assigned hospital not found');
    console.log(`Found Hospital: ${hospital.name} (${hospital._id})`);

    // 3. Create/Find Patient
    const patientEmail = 'testpatient@mediqueue.com';
    const patientPassword = 'Patient@123';
    let patient = await User.findOne({ email: patientEmail });
    if (!patient) {
      const hashedPassword = await bcrypt.hash(patientPassword, 10);
      patient = await User.create({
        name: 'Test Patient',
        email: patientEmail,
        password: hashedPassword,
        role: 'patient',
        phone: '9801234567',
        isApprovedBySuperAdmin: true,
        isOnboarded: true
      });
      console.log('Created test patient');
    } else {
      console.log('Using existing test patient');
    }

    // 4. Create 3 Appointment Requests
    console.log('Creating 3 appointment requests...');
    const dates = [
      new Date(Date.now() + 86400000 * 2), // 2 days later
      new Date(Date.now() + 86400000 * 5), // 5 days later
      new Date(Date.now() + 86400000 * 7), // 7 days later
    ];

    for (let i = 0; i < dates.length; i++) {
      await Appointment.create({
        patientId: patient._id,
        doctorId: doctor._id,
        hospitalId: hospital._id,
        date: dates[i],
        status: 'pending',
        paymentMethod: 'pay_later',
        paymentStatus: 'unpaid'
      });
      console.log(`  ✓ Created appointment for ${dates[i].toDateString()}`);
    }

    // 5. Save Patient Credentials
    const creds = `TEST PATIENT LOGIN\n==================\nEmail: ${patientEmail}\nPassword: ${patientPassword}\n`;
    fs.writeFileSync(path.join(__dirname, '../../patient_test_credentials.txt'), creds);
    console.log('\nSuccess! Patient credentials saved to patient_test_credentials.txt');

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}

run();
