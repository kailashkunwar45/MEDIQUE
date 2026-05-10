const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor', 'hospital_admin', 'super_admin'], default: 'patient' },
  isApprovedBySuperAdmin: { type: Boolean, default: false },
  isOnboarded: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function clearUsersAndRecreateAdmin() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not found in .env');
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    // Delete all users
    const deleteResult = await User.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing users.`);

    // Recreate Super Admin
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    const superAdmin = new User({
      name: 'Main System Admin',
      email: 'superadmin@mediqueue.com',
      password: hashedPassword,
      role: 'super_admin',
      isApprovedBySuperAdmin: true,
      isOnboarded: true
    });

    await superAdmin.save();
    console.log('Super Admin account has been recreated:');
    console.log('Email: superadmin@mediqueue.com');
    console.log('Password: Admin@123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error clearing users:', error);
    process.exit(1);
  }
}

clearUsersAndRecreateAdmin();
