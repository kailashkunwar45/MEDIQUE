import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/user.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createSuperAdmin() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found');
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const email = 'superadmin@mediqueue.com';
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Super Admin already exists');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    const superAdmin = new User({
      name: 'Main System Admin',
      email,
      password: hashedPassword,
      role: 'super_admin',
      isApprovedBySuperAdmin: true,
      isOnboarded: true
    });

    await superAdmin.save();
    console.log('Super Admin created successfully:');
    console.log('Email: superadmin@mediqueue.com');
    console.log('Password: Admin@123');
    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
