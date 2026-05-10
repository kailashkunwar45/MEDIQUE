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

// 10 name options per specialization (we pick as many as needed)
const NAMES_POOL: Record<string, string[]> = {
  "Cardiology":       ["Dr. Ramesh Sharma","Dr. Bikash Sharma","Dr. Pooja Adhikari","Dr. Sanjay Shrestha","Dr. Manisha Karki","Dr. Arun Joshi","Dr. Binita Rana","Dr. Sunil Poudel","Dr. Priya Devi","Dr. Kamal Pandey"],
  "Dermatology":      ["Dr. Sita Thapa","Dr. Priya Lama","Dr. Rohit Rai","Dr. Sunita Thapa","Dr. Kiran Maharjan","Dr. Deepa Magar","Dr. Nabin KC","Dr. Rupa Basnet","Dr. Srijana Oli","Dr. Bijay Karki"],
  "ENT":              ["Dr. Anil Karki","Dr. Dipak Gurung","Dr. Nisha Tamang","Dr. Rajesh Bhattarai","Dr. Asmita Pandey","Dr. Lok Shrestha","Dr. Binu Lama","Dr. Rajan Rai","Dr. Suman Thapa","Dr. Kamala Panta"],
  "Gastroenterology": ["Dr. Bipana Shrestha","Dr. Suresh Poudel","Dr. Anita Chaudhary","Dr. Bibek KC","Dr. Sujata Magar","Dr. Jeevan Pokhrel","Dr. Sabita Dhakal","Dr. Ram Bahadur","Dr. Nitu Shrestha","Dr. Binod Regmi"],
  "General Practice": ["Dr. Sandeep Rai","Dr. Mohan Subedi","Dr. Reena Limbu","Dr. Ashish Thakuri","Dr. Samiksha Oli","Dr. Dipa Sharma","Dr. Roshan Thapa","Dr. Sunita Bista","Dr. Arjun Bhusal","Dr. Kamana Koirala"],
  "Gynecology":       ["Dr. Nabin Gurung","Dr. Binita Rana","Dr. Pratima Dhakal","Dr. Kabita Ghimire","Dr. Saru Joshi","Dr. Puja Shrestha","Dr. Sita Devi","Dr. Mina Thapa","Dr. Anita Basnet","Dr. Kopila Rana"],
  "Neurology":        ["Dr. Pratik Lama","Dr. Narayan Regmi","Dr. Kopila Shrestha","Dr. Dinesh Basnet","Dr. Srijana Dahal","Dr. Shankar Gurung","Dr. Anita Rai","Dr. Bikram Poudel","Dr. Sarita Limbu","Dr. Dipesh KC"],
  "Oncology":         ["Dr. Rojina Maharjan","Dr. Prabha Koirala","Dr. Rajan Panta","Dr. Usha Giri","Dr. Biswas Acharya","Dr. Prashant Sharma","Dr. Alina Karki","Dr. Sanjeev Rana","Dr. Mandira Thapa","Dr. Binay Subedi"],
  "Ophthalmology":    ["Dr. Suman KC","Dr. Laxmi Pokhrel","Dr. Santosh Bhandari","Dr. Prativa Sharma","Dr. Hemraj Luitel","Dr. Sudip Adhikari","Dr. Nirmala Oli","Dr. Bijay Shrestha","Dr. Kamala Magar","Dr. Sanjiv Rai"],
  "Orthopedics":      ["Dr. Anjali Pandey","Dr. Nirmal Devkota","Dr. Samjhana Poudel","Dr. Rajan Chand","Dr. Anupama Thapa","Dr. Sujan Karki","Dr. Dipika Rana","Dr. Naresh Basnet","Dr. Pramila KC","Dr. Arjun Panta"],
  "Pediatrics":       ["Dr. Manoj Chaudhary","Dr. Deepa Sharma","Dr. Suman Shrestha","Dr. Alisha Khadka","Dr. Naresh Yadav","Dr. Bina Tamang","Dr. Santosh Lama","Dr. Renu Ghimire","Dr. Dipak Acharya","Dr. Sarita Devi"],
  "Psychiatry":       ["Dr. Sushma Tamang","Dr. Bandana Panta","Dr. Bishal Karmacharya","Dr. Rupa Adhikari","Dr. Deepak Silwal","Dr. Pramod Joshi","Dr. Nita Bhattarai","Dr. Suresh Luitel","Dr. Kamana Shrestha","Dr. Bipin Rai"],
  "Radiology":        ["Dr. Rabin Adhikari","Dr. Bharat Sharma","Dr. Nirmala Bista","Dr. Sujan Sapkota","Dr. Mina Shrestha","Dr. Saroj Poudel","Dr. Sabina Karki","Dr. Ramesh Oli","Dr. Kamala Rana","Dr. Dipak Thapa"],
  "Urology":          ["Dr. Srijana Bhattarai","Dr. Rajendra Khatri","Dr. Priyanka Dura","Dr. Lokendra Tiwari","Dr. Puspa Bogati","Dr. Sandesh Sharma","Dr. Anjana Rai","Dr. Bikash KC","Dr. Sunita Gurung","Dr. Rajan Dhakal"]
};

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  // ── STEP 1: Remove demo/unboarded hospitals ──────────────────────────────
  const demoHospitals = await Hospital.find({
    $or: [{ name: /demo/i }, { isOnboarded: false }, { isActive: false }]
  }).lean();

  if (demoHospitals.length > 0) {
    console.log(`Found ${demoHospitals.length} demo/unboarded hospital(s) to remove:`);
    const demoIds = demoHospitals.map(h => String(h._id));
    const realHospitals = await Hospital.find({ isOnboarded: true, _id: { $nin: demoIds } }).lean();
    const realIds = realHospitals.map(h => String(h._id));

    if (realIds.length > 0) {
      const affected = await User.find({
        $or: [
          { hospitalId: { $in: demoIds as any } },
          { hospitalIds: { $elemMatch: { $in: demoIds.map(id => new mongoose.Types.ObjectId(id)) } } }
        ]
      });
      for (let i = 0; i < affected.length; i++) {
        const u = affected[i];
        const target = new mongoose.Types.ObjectId(realIds[i % realIds.length]);
        if (u.hospitalId && demoIds.includes(String(u.hospitalId))) u.hospitalId = target as any;
        if (Array.isArray(u.hospitalIds)) {
          u.hospitalIds = u.hospitalIds.map((hid: any) => demoIds.includes(String(hid)) ? target : hid) as any;
        }
        await u.save();
        console.log(`  ✓ Reassigned ${u.name} → ${realHospitals[i % realHospitals.length].name}`);
      }
    }
    await Hospital.deleteMany({ _id: { $in: demoHospitals.map(h => h._id) } });
    console.log(`✓ Deleted ${demoHospitals.length} demo hospital(s).\n`);
  } else {
    console.log('No demo hospitals found.\n');
  }

  // ── STEP 2: Login as super admin ─────────────────────────────────────────
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@mediqueue.com', password: 'Admin@123' })
  });
  if (!loginRes.ok) throw new Error('Super admin login failed: ' + await loginRes.text());
  const { accessToken: superAdminToken } = await loginRes.json() as any;
  console.log('Super admin authenticated.\n');

  // ── STEP 3: Get real hospitals ────────────────────────────────────────────
  const realHospitals = await Hospital.find({ isOnboarded: true }).lean();
  const realIds = realHospitals.map(h => String(h._id));
  console.log(`${realIds.length} real hospitals available.\n`);

  // ── STEP 4: Ensure 5 doctors per specialization ───────────────────────────
  let newCredentials = '\n\nDOCTORS ADDED BY FIX-ALL SCRIPT\n================================\n';
  let globalIdx = Date.now() % 100000; // unique base for emails

  for (const spec of SPECIALIZATIONS) {
    const existingDoctors = await User.find({
      role: UserRole.DOCTOR,
      specialization: { $regex: new RegExp(`^${spec}$`, 'i') },
      isOnboarded: true,
      isApprovedBySuperAdmin: true
    }).lean();

    const needed = Math.max(0, 5 - existingDoctors.length);
    if (needed === 0) {
      console.log(`✓ ${spec}: already has ${existingDoctors.length} doctor(s)`);
      continue;
    }

    console.log(`→ ${spec}: has ${existingDoctors.length}, adding ${needed}...`);
    const pool = NAMES_POOL[spec] || [];

    // Pick names not already used
    const usedNames = existingDoctors.map((d: any) => d.name.toLowerCase());
    const availableNames = pool.filter(n => !usedNames.includes(n.toLowerCase()));

    for (let i = 0; i < needed; i++) {
      const name = availableNames[i] || `Dr. Extra ${spec} ${i + 1}`;
      globalIdx++;
      const email = `doc_fx_${globalIdx}@mediqueue.com`;
      const password = `DFx@${globalIdx}!!`;
      const assignedHospitalId = realIds[globalIdx % realIds.length];

      await delay(1500); // respect rate limiter

      const regRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'DOCTOR', phone: `985${globalIdx.toString().padStart(7,'0')}` })
      });
      if (!regRes.ok) { console.warn(`  ✗ Register failed for ${name}: ${await regRes.text()}`); continue; }
      const regData = await regRes.json() as any;

      await delay(300);
      await fetch(`${API_URL}/api/users/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regData.accessToken}` },
        body: JSON.stringify({ degree: 'MBBS, MD', certification: 'NMC Registered', college: 'Tribhuvan University', specialization: spec, experienceYears: 4 + i, previousWork: 'Various Hospitals', hospitalIds: [assignedHospitalId] })
      });

      await delay(300);
      await fetch(`${API_URL}/api/super-admin/doctors/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ doctorId: regData._id, status: 'approved' })
      });

      const hName = realHospitals.find(h => String(h._id) === assignedHospitalId)?.name || assignedHospitalId;
      newCredentials += `Name: ${name}\nSpecialty: ${spec}\nHospital: ${hName}\nLogin: ${email}\nPassword: ${password}\n\n`;
      console.log(`  ✓ ${name} → ${hName}`);
    }
  }

  fs.appendFileSync(path.join(__dirname, '../../../../demo_credentials.txt'), newCredentials);
  console.log('\n\nAll done! New credentials appended to demo_credentials.txt');
  process.exit(0);
}

run().catch(err => { console.error('Script failed:', err); process.exit(1); });
