import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { User, UserRole } from '../models/user.model';
import { Hospital } from '../models/hospital.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:5005';

const SPECIALIZATIONS = [
  "Cardiology", "Dermatology", "ENT", "Gastroenterology",
  "General Practice", "Gynecology", "Neurology", "Oncology",
  "Ophthalmology", "Orthopedics", "Pediatrics", "Psychiatry",
  "Radiology", "Urology"
];

const NEW_HOSPITALS = [
  { name: "Medicare National Hospital", address: "Chabahil, Kathmandu", email: "info@medicare.com.np" },
  { name: "Shahid Gangalal National Heart Center", address: "Bansbari, Kathmandu", email: "info@sgnhc.org.np" },
  { name: "Nepal Eye Hospital", address: "Tripureshwor, Kathmandu", email: "info@nepaleyehospital.org" },
  { name: "Paropakar Maternity and Women's Hospital", address: "Thapathali, Kathmandu", email: "info@pmwh.gov.np" },
  { name: "Sukraraj Tropical and Infectious Disease Hospital", address: "Teku, Kathmandu", email: "info@stidh.gov.np" },
  { name: "Kanti Children's Hospital", address: "Maharajgunj, Kathmandu", email: "info@kantichildrenhospital.gov.np" },
  { name: "National Trauma Center", address: "Mahankal, Kathmandu", email: "info@nationaltraumacenter.gov.np" },
  { name: "Manmohan Memorial Community Hospital", address: "Pharping, Kathmandu", email: "info@mmch.com.np" },
  { name: "Helping Hands Community Hospital", address: "Chabahil, Kathmandu", email: "info@helpinghands.com.np" },
  { name: "Nepal-Korea Friendship Municipality Hospital", address: "Thimi, Bhaktapur", email: "info@nkfmh.org.np" },
  { name: "Siddhi Memorial Hospital", address: "Bhaktapur", email: "info@smh.org.np" },
  { name: "Dhulikhel Hospital", address: "Dhulikhel, Kavre", email: "info@dhulikhelhospital.org" },
  { name: "Scheer Memorial Adventist Hospital", address: "Banepa, Kavre", email: "info@scheermemorial.org" },
  { name: "Anandaban Hospital", address: "Lele, Lalitpur", email: "info@anandaban.org" },
  { name: "Patas Hospital", address: "Gwarko, Lalitpur", email: "info@patas.com.np" }
];

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  // 1. Register 15 New Hospitals
  console.log('--- Registering 15 New Hospitals ---');
  let credentialsText = '\n\nSCALING DEMO: 15 NEW HOSPITALS & 30 NEW DOCTORS\n==============================================\n';
  
  const createdHospitalIds: string[] = [];

  for (const h of NEW_HOSPITALS) {
    const adminEmail = h.email.replace('info@', 'admin@');
    const adminPassword = 'Hospital@123';

    // Register Hospital Admin
    const regRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${h.name} Admin`, email: adminEmail, password: adminPassword, role: 'HOSPITAL_ADMIN' })
    });

    if (!regRes.ok) {
      console.warn(`  ✗ Hospital Admin Registration failed for ${h.name}: ${await regRes.text()}`);
      continue;
    }
    const regData = await regRes.json() as any;

    // Onboard Hospital
    await delay(300);
    const onboardRes = await fetch(`${API_URL}/api/hospitals/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regData.accessToken}` },
      body: JSON.stringify({ name: h.name, address: h.address, contactEmail: h.email, contactPhone: '01-' + (Math.floor(Math.random() * 9000000) + 1000000) })
    });

    if (onboardRes.ok) {
      const onboardData = await onboardRes.json() as any;
      createdHospitalIds.push(onboardData.hospital._id);
      credentialsText += `Hospital: ${h.name}\nAdmin Login: ${adminEmail}\nPassword: ${adminPassword}\n\n`;
      console.log(`  ✓ Registered & Onboarded: ${h.name}`);
    } else {
      console.warn(`  ✗ Hospital Onboarding failed for ${h.name}: ${await onboardRes.text()}`);
    }
    await delay(500);
  }

  // 2. Login as Super Admin for Approvals
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@mediqueue.com', password: 'Admin@123' })
  });
  if (!loginRes.ok) throw new Error('Super admin login failed');
  const { accessToken: superAdminToken } = await loginRes.json() as any;
  console.log('\nSuper admin authenticated for approvals.\n');

  // Approve all new hospitals
  for (const hid of createdHospitalIds) {
    await fetch(`${API_URL}/api/super-admin/hospitals/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ hospitalId: hid, status: 'approved' })
    });
  }
  console.log(`✓ Approved ${createdHospitalIds.length} hospitals.\n`);

  // 3. Add 30 More Doctors to reach 100 total
  console.log('--- Registering 30 More Doctors ---');
  const allHospitals = await Hospital.find({ isOnboarded: true, isApprovedBySuperAdmin: true }).lean();
  const allHospitalIds = allHospitals.map(h => String(h._id));

  let docCount = 0;
  let globalIdx = Date.now() % 100000;

  for (let i = 0; i < 30; i++) {
    const spec = SPECIALIZATIONS[i % SPECIALIZATIONS.length];
    const name = `Dr. Specialist ${i + 71}`; // Starting after the 70 existing
    globalIdx++;
    const email = `doctor_scaled_${globalIdx}@mediqueue.com`;
    const password = `Doc@${globalIdx}!!`;
    const assignedHospitalId = allHospitalIds[globalIdx % allHospitalIds.length];

    await delay(1000); // Rate limit respect

    // Register
    const regRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: 'DOCTOR', phone: `984${globalIdx.toString().padStart(7,'0')}` })
    });
    if (!regRes.ok) { console.warn(`  ✗ Doctor Registration failed for ${name}: ${await regRes.text()}`); continue; }
    const regData = await regRes.json() as any;

    // Onboard
    await delay(300);
    await fetch(`${API_URL}/api/users/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regData.accessToken}` },
      body: JSON.stringify({ degree: 'MBBS, MS', certification: 'NMC Licensed', college: 'Kathmandu University', specialization: spec, experienceYears: 5 + (i % 10), previousWork: 'Kathmandu Clinic', hospitalIds: [assignedHospitalId] })
    });

    // Approve
    await delay(300);
    await fetch(`${API_URL}/api/super-admin/doctors/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ doctorId: regData._id, status: 'approved' })
    });

    const hName = allHospitals.find(h => String(h._id) === assignedHospitalId)?.name || assignedHospitalId;
    credentialsText += `Doctor: ${name}\nSpecialty: ${spec}\nHospital: ${hName}\nLogin: ${email}\nPassword: ${password}\n\n`;
    console.log(`  ✓ ${name} → ${hName}`);
    docCount++;
  }

  fs.appendFileSync(path.join(__dirname, '../../../../demo_credentials.txt'), credentialsText);
  console.log(`\n\nScale complete! Added 15 hospitals and ${docCount} doctors.`);
  console.log('Credentials appended to demo_credentials.txt');
  process.exit(0);
}

run().catch(err => { console.error('Scale script failed:', err); process.exit(1); });
