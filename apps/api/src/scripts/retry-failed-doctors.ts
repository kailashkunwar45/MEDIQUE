import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Hospital } from '../models/hospital.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:5005';

// Only the ones that got rate-limited
const FAILED_DOCTORS: { name: string; spec: string; index: number }[] = [
  { name: "Dr. Bharat Sharma",    spec: "Radiology",  index: 49 },
  { name: "Dr. Nirmala Bista",    spec: "Radiology",  index: 50 },
  { name: "Dr. Sujan Sapkota",    spec: "Radiology",  index: 51 },
  { name: "Dr. Mina Shrestha",    spec: "Radiology",  index: 52 },
  { name: "Dr. Rajendra Khatri",  spec: "Urology",    index: 53 },
  { name: "Dr. Priyanka Dura",    spec: "Urology",    index: 54 },
  { name: "Dr. Lokendra Tiwari",  spec: "Urology",    index: 55 },
  { name: "Dr. Puspa Bogati",     spec: "Urology",    index: 56 },
];

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found');
  await mongoose.connect(uri);

  const hospitals = await Hospital.find({ isOnboarded: true }).lean();
  const hospitalIds = hospitals.map(h => String(h._id));

  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@mediqueue.com', password: 'Admin@123' })
  });
  const { accessToken: superAdminToken } = await loginRes.json() as any;
  console.log('Super admin authenticated. Retrying failed doctors with 2s delay...\n');

  let newCredentials = '\n\nRETRIED DOCTORS (Batch 2 - Continued)\n=======================================\n';

  for (const d of FAILED_DOCTORS) {
    const email = `doctor_b2_${d.index}@mediqueue.com`;
    const password = `DocB2@${d.index}!!`;
    const assignedHospitalId = hospitalIds[d.index % hospitalIds.length];

    // Wait 2 seconds between each to avoid rate limit
    await delay(2000);

    const regRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name, email, password, role: 'DOCTOR', phone: `984${d.index.toString().padStart(7, '0')}` })
    });
    if (!regRes.ok) { console.warn(`  ✗ Still failed: ${email} — ${await regRes.text()}`); continue; }
    const regData = await regRes.json() as any;

    await fetch(`${API_URL}/api/users/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regData.accessToken}` },
      body: JSON.stringify({ degree: 'MBBS, MD', certification: 'NMC Registered', college: 'Institute of Medicine (IOM)', specialization: d.spec, experienceYears: 5, previousWork: 'Various Clinics', hospitalIds: [assignedHospitalId] })
    });

    await delay(500);
    await fetch(`${API_URL}/api/super-admin/doctors/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ doctorId: regData._id, status: 'approved' })
    });

    const hospitalName = hospitals.find(h => String(h._id) === assignedHospitalId)?.name;
    newCredentials += `Name: ${d.name}\nSpecialty: ${d.spec}\nHospital: ${hospitalName}\nLogin: ${email}\nPassword: ${password}\n\n`;
    console.log(`  ✓ ${d.name} (${d.spec}) → ${hospitalName}`);
  }

  fs.appendFileSync(path.join(__dirname, '../../../../demo_credentials.txt'), newCredentials);
  console.log('\nRetry complete! Credentials appended.');
  process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
