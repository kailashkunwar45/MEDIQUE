import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Hospital } from '../models/hospital.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:5005';

const SPECIALIZATIONS = [
  "Cardiology", "Dermatology", "ENT", "Gastroenterology",
  "General Practice", "Gynecology", "Neurology", "Oncology",
  "Ophthalmology", "Orthopedics", "Pediatrics", "Psychiatry",
  "Radiology", "Urology"
];

// 5 doctors per specialization (14 specs × 5 = 70 doctors)
// Set 1 is already seeded, so we add 4 more per spec (indices 2-5)
const DOCTOR_NAMES_BY_SPEC: Record<string, string[]> = {
  "Cardiology":       ["Dr. Bikash Sharma", "Dr. Pooja Adhikari", "Dr. Sanjay Shrestha", "Dr. Manisha Karki"],
  "Dermatology":      ["Dr. Priya Lama", "Dr. Rohit Rai", "Dr. Sunita Thapa", "Dr. Kiran Maharjan"],
  "ENT":              ["Dr. Dipak Gurung", "Dr. Nisha Tamang", "Dr. Rajesh Bhattarai", "Dr. Asmita Pandey"],
  "Gastroenterology": ["Dr. Suresh Poudel", "Dr. Anita Chaudhary", "Dr. Bibek KC", "Dr. Sujata Magar"],
  "General Practice": ["Dr. Mohan Subedi", "Dr. Reena Limbu", "Dr. Ashish Thakuri", "Dr. Samiksha Oli"],
  "Gynecology":       ["Dr. Binita Rana", "Dr. Pratima Dhakal", "Dr. Kabita Ghimire", "Dr. Saru Joshi"],
  "Neurology":        ["Dr. Narayan Regmi", "Dr. Kopila Shrestha", "Dr. Dinesh Basnet", "Dr. Srijana Dahal"],
  "Oncology":         ["Dr. Prabha Koirala", "Dr. Rajan Panta", "Dr. Usha Giri", "Dr. Biswas Acharya"],
  "Ophthalmology":    ["Dr. Laxmi Pokhrel", "Dr. Santosh Bhandari", "Dr. Prativa Sharma", "Dr. Hemraj Luitel"],
  "Orthopedics":      ["Dr. Nirmal Devkota", "Dr. Samjhana Poudel", "Dr. Rajan Chand", "Dr. Anupama Thapa"],
  "Pediatrics":       ["Dr. Deepa Sharma", "Dr. Suman Shrestha", "Dr. Alisha Khadka", "Dr. Naresh Yadav"],
  "Psychiatry":       ["Dr. Bandana Panta", "Dr. Bishal Karmacharya", "Dr. Rupa Adhikari", "Dr. Deepak Silwal"],
  "Radiology":        ["Dr. Bharat Sharma", "Dr. Nirmala Bista", "Dr. Sujan Sapkota", "Dr. Mina Shrestha"],
  "Urology":          ["Dr. Rajendra Khatri", "Dr. Priyanka Dura", "Dr. Lokendra Tiwari", "Dr. Puspa Bogati"]
};

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Fetch real hospital IDs from DB
  const hospitals = await Hospital.find({ isOnboarded: true }).lean();
  if (!hospitals.length) throw new Error('No onboarded hospitals found. Run seed-demo.ts first.');
  const hospitalIds = hospitals.map(h => String(h._id));
  console.log(`Using ${hospitalIds.length} hospitals for affiliation.\n`);

  // Login as super admin
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@mediqueue.com', password: 'Admin@123' })
  });
  if (!loginRes.ok) throw new Error('Super admin login failed');
  const { accessToken: superAdminToken } = await loginRes.json() as any;
  console.log('Super admin authenticated.\n');

  let newCredentials = '\n\nADDITIONAL DOCTORS (Batch 2)\n============================\n';
  let doctorCount = 0; // global counter for unique emails

  for (const spec of SPECIALIZATIONS) {
    const names = DOCTOR_NAMES_BY_SPEC[spec];
    console.log(`Adding 4 more doctors for ${spec}...`);

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      // Use a counter-based unique index for emails
      doctorCount++;
      const email = `doctor_b2_${doctorCount}@mediqueue.com`;
      const password = `DocB2@${doctorCount}!!`;
      const assignedHospitalId = hospitalIds[doctorCount % hospitalIds.length];

      // Register
      const regRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'DOCTOR', phone: `984${doctorCount.toString().padStart(7, '0')}` })
      });
      if (!regRes.ok) {
        console.warn(`  ✗ Failed to register ${email}: ${await regRes.text()}`);
        continue;
      }
      const regData = await regRes.json() as any;
      const doctorToken = regData.accessToken;

      // Onboard
      await fetch(`${API_URL}/api/users/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
        body: JSON.stringify({
          degree: 'MBBS, MD', certification: 'NMC Registered', college: 'Institute of Medicine (IOM)',
          specialization: spec, experienceYears: 3 + i, previousWork: 'Various Clinics',
          hospitalIds: [assignedHospitalId]
        })
      });

      // Approve
      await fetch(`${API_URL}/api/super-admin/doctors/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ doctorId: regData._id, status: 'approved' })
      });

      const hospitalName = hospitals.find(h => String(h._id) === assignedHospitalId)?.name || assignedHospitalId;
      newCredentials += `Name: ${name}\nSpecialty: ${spec}\nHospital: ${hospitalName}\nLogin: ${email}\nPassword: ${password}\n\n`;
      console.log(`  ✓ ${name} (${spec}) → ${hospitalName}`);
      await delay(50);
    }
  }

  fs.appendFileSync(path.join(__dirname, '../../../../demo_credentials.txt'), newCredentials);
  console.log('\nAll done! Credentials appended to demo_credentials.txt');
  process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
