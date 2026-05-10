import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Hospital } from '../models/hospital.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:5005';

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found');
  await mongoose.connect(uri);

  // Find all demo / unboarded hospitals
  const demoHospitals = await Hospital.find({
    $or: [
      { name: /demo/i },
      { isOnboarded: false },
      { isActive: false },
    ]
  }).lean();

  if (demoHospitals.length === 0) {
    console.log('✓ No demo hospitals found. Database is clean.');
    process.exit(0);
  }

  console.log(`Found ${demoHospitals.length} demo hospital(s). Deleting via Super Admin API...\n`);

  // Login as super admin
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@mediqueue.com', password: 'Admin@123' }),
  });
  if (!loginRes.ok) throw new Error('Super admin login failed: ' + await loginRes.text());
  const { accessToken } = await loginRes.json() as any;

  let deleted = 0;
  for (const h of demoHospitals) {
    const res = await fetch(`${API_URL}/api/super-admin/hospitals/${h._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      console.log(`  ✓ Deleted: ${h.name}`);
      deleted++;
    } else {
      const err = await res.text();
      console.warn(`  ✗ Failed to delete ${h.name}: ${err}`);
    }
  }

  console.log(`\nDone. ${deleted}/${demoHospitals.length} demo hospital(s) deleted.`);
  process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
