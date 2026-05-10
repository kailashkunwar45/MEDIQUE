import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User, UserRole } from '../models/user.model';
import { Hospital } from '../models/hospital.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Find demo hospitals (any named "Demo Hospital" or not active/onboarded)
  const demoHospitals = await Hospital.find({
    $or: [
      { name: 'Demo Hospital' },
      { name: /demo/i },
      { isOnboarded: false }
    ]
  }).lean();

  if (demoHospitals.length === 0) {
    console.log('No demo hospitals found.');
    process.exit(0);
  }

  console.log(`Found ${demoHospitals.length} demo hospital(s):`);
  demoHospitals.forEach(h => console.log(` - ${h.name} (${h._id})`));

  // Find real hospitals (onboarded, not named demo)
  const realHospitals = await Hospital.find({
    isOnboarded: true,
    name: { $not: /demo/i },
    _id: { $nin: demoHospitals.map(h => h._id) }
  }).lean();

  if (realHospitals.length === 0) {
    console.log('No real hospitals found to reassign users to. Aborting.');
    process.exit(1);
  }

  console.log(`\nFound ${realHospitals.length} real hospital(s) to reassign to.`);

  const demoIds = demoHospitals.map(h => String(h._id));

  // Find all users affiliated with demo hospitals
  const affectedUsers = await User.find({
    $or: [
      { hospitalId: { $in: demoIds as any } },
      { hospitalIds: { $elemMatch: { $in: demoIds.map(id => new mongoose.Types.ObjectId(id)) } } }
    ]
  });

  console.log(`\nFound ${affectedUsers.length} user(s) affiliated with demo hospitals.`);

  // Re-affiliate each user with a real hospital (round-robin)
  for (let i = 0; i < affectedUsers.length; i++) {
    const user = affectedUsers[i];
    const targetHospital = realHospitals[i % realHospitals.length];
    const targetId = new mongoose.Types.ObjectId(String(targetHospital._id));

    // Update hospitalId if it was pointing at a demo hospital
    const oldHospId = user.hospitalId ? String(user.hospitalId) : null;
    if (oldHospId && demoIds.includes(oldHospId)) {
      user.hospitalId = targetId as any;
    }

    // Update hospitalIds array - replace demo hospital refs with real ones
    if (Array.isArray(user.hospitalIds) && user.hospitalIds.length > 0) {
      user.hospitalIds = user.hospitalIds.map((hId: any) => {
        return demoIds.includes(String(hId)) ? targetId : hId;
      }) as any;
    } else if (user.role === UserRole.DOCTOR) {
      user.hospitalIds = [targetId] as any;
    }

    // Also fix hospitalApprovals array if present
    if (Array.isArray((user as any).hospitalApprovals)) {
      (user as any).hospitalApprovals = (user as any).hospitalApprovals.map((ha: any) => {
        if (demoIds.includes(String(ha.hospitalId))) {
          return { ...ha, hospitalId: targetId };
        }
        return ha;
      });
    }

    await user.save();
    console.log(` ✓ Reassigned ${user.name} (${user.role}) → ${targetHospital.name}`);
  }

  // Delete demo hospitals
  const deleteResult = await Hospital.deleteMany({
    _id: { $in: demoHospitals.map(h => h._id) }
  });
  console.log(`\n✓ Deleted ${deleteResult.deletedCount} demo hospital(s).`);
  console.log('Cleanup complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
