import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { User, UserRole } from '../models/user.model';
import { Hospital } from '../models/hospital.model';
import { Appointment } from '../models/appointment.model';
import { Review } from '../models/review.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:5005';
let superAdminToken = '';
let outputText = 'MEDIQUEUE DEMO CREDENTIALS\n===========================\n\n';

const KATHMANDU_HOSPITALS = [
  "Bir Hospital",
  "Tribhuvan University Teaching Hospital (TUTH)",
  "Patan Hospital",
  "Grande International Hospital",
  "Norvic International Hospital",
  "Nepal Mediciti Hospital",
  "Vayodha Hospitals",
  "B&B Hospital",
  "Civil Service Hospital",
  "Kathmandu Model Hospital",
  "Om Hospital and Research Centre",
  "KIST Medical College Teaching Hospital",
  "HAMS Hospital",
  "Star Hospital",
  "Green City Hospital"
];

const SPECIALIZATIONS = [
  "Cardiology", "Dermatology", "ENT", "Gastroenterology", 
  "General Practice", "Gynecology", "Neurology", "Oncology", 
  "Ophthalmology", "Orthopedics", "Pediatrics", "Psychiatry", 
  "Radiology", "Urology"
];

const DOCTOR_NAMES = [
  "Dr. Ramesh Sharma", "Dr. Sita Thapa", "Dr. Anil Karki", 
  "Dr. Bipana Shrestha", "Dr. Sandeep Rai", "Dr. Nabin Gurung", 
  "Dr. Pratik Lama", "Dr. Rojina Maharjan", "Dr. Suman KC", 
  "Dr. Anjali Pandey", "Dr. Manoj Chaudhary", "Dr. Sushma Tamang", 
  "Dr. Rabin Adhikari", "Dr. Srijana Bhattarai"
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not found');
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    console.log('Clearing old data...');
    await Hospital.deleteMany({});
    await Appointment.deleteMany({});
    await Review.deleteMany({});
    await User.deleteMany({ role: { $ne: UserRole.SUPER_ADMIN } });
    console.log('Old data cleared.');

    // 1. Login as Super Admin
    console.log('Logging in as super admin...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@mediqueue.com', password: 'Admin@123' })
    });
    if (!loginRes.ok) {
      const err = await loginRes.text();
      throw new Error('Super admin login failed: ' + err);
    }
    const loginData = await loginRes.json() as any;
    superAdminToken = loginData.accessToken;
    console.log('Super admin login successful.');

    // 2. Create Hospitals
    console.log('Creating 15 hospitals...');
    outputText += 'HOSPITALS\n---------\n';
    const hospitalIds: string[] = [];

    for (let i = 0; i < KATHMANDU_HOSPITALS.length; i++) {
      const name = KATHMANDU_HOSPITALS[i];
      const email = `admin${i+1}@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      const password = `Hospital@${i+1}!!`;

      // Register Hospital Admin
      const regRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${name} Admin`,
          email,
          password,
          role: 'HOSPITAL_ADMIN',
          phone: `98000000${i.toString().padStart(2, '0')}`
        })
      });
      if (!regRes.ok) {
        const errText = await regRes.text();
        throw new Error(`Failed to register ${email}: ${errText}`);
      }
      const regData = await regRes.json() as any;
      const hospitalAdminToken = regData.accessToken;
      const hospitalId = regData.hospitalId;
      hospitalIds.push(hospitalId);

      // Onboard Hospital
      await fetch(`${API_URL}/api/hospital-admin/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hospitalAdminToken}` },
        body: JSON.stringify({
          name,
          address: `Kathmandu, Nepal (Zone ${i+1})`,
          certification: 'A-Grade ISO Certified',
          services: 'Emergency, OPD, ICU, Pharmacy'
        })
      });

      // Approve Hospital via Super Admin
      await fetch(`${API_URL}/api/super-admin/hospitals/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
        body: JSON.stringify({ hospitalId, status: 'approved' })
      });

      outputText += `Name: ${name}\nLogin: ${email}\nPassword: ${password}\n\n`;
      console.log(`Created ${name}`);
      
      // small delay to prevent rapid-fire requests failing
      await delay(50);
    }

    // 3. Create Doctors
    console.log('\nCreating 14 doctors...');
    outputText += '\nDOCTORS\n-------\n';

    for (let i = 0; i < SPECIALIZATIONS.length; i++) {
      const spec = SPECIALIZATIONS[i];
      const name = DOCTOR_NAMES[i];
      const email = `doctor${i+1}@mediqueue.com`;
      const password = `Doctor@${i+1}!!`;
      const assignedHospitalId = hospitalIds[i % hospitalIds.length];

      // Register Doctor
      const regRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role: 'DOCTOR',
          phone: `98400000${i.toString().padStart(2, '0')}`
        })
      });
      if (!regRes.ok) throw new Error('Failed to register ' + email);
      const regData = await regRes.json() as any;
      const doctorToken = regData.accessToken;

      // Onboard Doctor
      await fetch(`${API_URL}/api/users/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({
          degree: 'MBBS, MD',
          certification: 'NMC Registered',
          college: 'Institute of Medicine (IOM)',
          specialization: spec,
          experienceYears: 5 + i,
          previousWork: 'Various Clinics',
          hospitalIds: [assignedHospitalId]
        })
      });

      // Approve Doctor via Super Admin
      await fetch(`${API_URL}/api/super-admin/doctors/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superAdminToken}` },
        body: JSON.stringify({ doctorId: regData._id, status: 'approved' })
      });

      outputText += `Name: ${name}\nSpecialty: ${spec}\nLogin: ${email}\nPassword: ${password}\n\n`;
      console.log(`Created ${name} (${spec})`);
      
      await delay(50);
    }

    fs.writeFileSync(path.join(__dirname, '../../../../demo_credentials.txt'), outputText);
    console.log('\nSeed complete! Credentials saved to demo_credentials.txt in the root of the project.');

    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

run();
