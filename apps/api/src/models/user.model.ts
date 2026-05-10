import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  HOSPITAL_ADMIN = 'hospital_admin',
  SUPER_ADMIN = 'super_admin',
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  hospitalId?: mongoose.Types.ObjectId; // Primary/legacy
  hospitalIds: mongoose.Types.ObjectId[]; // Multi-hospital support
  phone?: string;
  specialization?: string;
  bio?: string;
  degree?: string;
  certification?: string;
  college?: string;
  experienceYears?: number;
  previousWork?: string;
  isOnboarded: boolean;
  isVerified: boolean; // Hospital verification
  isApprovedBySuperAdmin: boolean; // Final global approval
  isBanned: boolean;
  banReason?: string;
  hospitalApprovals: {
    hospitalId: mongoose.Types.ObjectId;
    status: 'pending' | 'approved' | 'rejected';
    updatedAt: Date;
  }[];
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, select: false },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.PATIENT,
      required: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
    },
    hospitalIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
    }],
    phone: { type: String },
    specialization: { type: String },
    bio: { type: String },
    degree: { type: String },
    certification: { type: String },
    college: { type: String },
    experienceYears: { type: Number },
    previousWork: { type: String },
    isOnboarded: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isApprovedBySuperAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    hospitalApprovals: [{
      hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital' },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      updatedAt: { type: Date, default: Date.now }
    }],
  },
  {
    timestamps: true,
  }
);

userSchema.methods.matchPassword = async function (enteredPassword: string) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  } else {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

export const User = mongoose.model<IUser>('User', userSchema);
