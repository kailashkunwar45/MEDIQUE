import { Request, Response } from 'express';
import { User, UserRole } from '../models/user.model';
import { generateTokens } from '../utils/jwt';
import mongoose from 'mongoose';
import { Hospital } from '../models/hospital.model';

const normalizeRole = (raw: unknown): UserRole => {
  if (!raw) return UserRole.PATIENT;
  if (typeof raw !== 'string') return UserRole.PATIENT;

  const v = raw.trim();
  const upper = v.toUpperCase();

  if (upper === 'PATIENT') return UserRole.PATIENT;
  if (upper === 'DOCTOR') return UserRole.DOCTOR;
  if (upper === 'HOSPITAL_ADMIN') return UserRole.HOSPITAL_ADMIN;
  // SUPER_ADMIN registration blocked
  if (upper === 'SUPER_ADMIN') throw new Error('Super Admin accounts must be created manually');
  
  const lower = v.toLowerCase();
  if (lower === UserRole.PATIENT) return UserRole.PATIENT;
  if (lower === UserRole.DOCTOR) return UserRole.DOCTOR;
  if (lower === UserRole.HOSPITAL_ADMIN) return UserRole.HOSPITAL_ADMIN;
  if (lower === UserRole.SUPER_ADMIN) throw new Error('Super Admin accounts must be created manually');
  
  return UserRole.PATIENT;
};

const ensureHospitalId = async (
  role: UserRole,
  rawHospitalId: unknown
): Promise<mongoose.Types.ObjectId | undefined> => {
  // Patients + super admins don't need a hospital.
  if (role === UserRole.PATIENT || role === UserRole.SUPER_ADMIN) return undefined;

  if (typeof rawHospitalId === 'string' && mongoose.Types.ObjectId.isValid(rawHospitalId)) {
    return new mongoose.Types.ObjectId(rawHospitalId);
  }

  // For doctor/admin accounts, create a default hospital so role-specific features work.
  const hospital = await Hospital.create({
    name: 'Demo Hospital',
    address: 'Kathmandu',
    contactEmail: 'demo@mediqueue.local',
    contactPhone: '0000000000',
    subscriptionTier: 'free',
    isActive: true,
  });

  return hospital._id as mongoose.Types.ObjectId;
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role: rawRole, hospitalId: rawHospitalId, phone } = req.body;
    const role = normalizeRole(rawRole);
    const hospitalId = await ensureHospitalId(role, rawHospitalId);

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      hospitalId,
      phone,
    });

    if (user) {
      const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.role);
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalIds: user.hospitalIds || [],
        isOnboarded: user.isOnboarded || false,
        accessToken,
        refreshToken,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      if (user.isBanned) {
        return res.status(403).json({ message: `Your account is banned. Reason: ${user.banReason || 'Unspecified'}` });
      }

      if (user.hospitalId) {
        const hospital = await Hospital.findById(user.hospitalId);
        if (hospital?.isBanned) {
          return res.status(403).json({ message: `Your hospital is temporarily banned. Reason: ${hospital.banReason || 'Unspecified'}` });
        }
      }

      if (user.role === UserRole.DOCTOR) {
        if (user.isOnboarded && !user.isApprovedBySuperAdmin) {
          return res.status(403).json({ message: 'Account pending final super-admin approval.' });
        }
      }

      if (user.role === UserRole.HOSPITAL_ADMIN && user.isOnboarded && !user.isApprovedBySuperAdmin) {
        return res.status(403).json({ message: 'Hospital admin account pending super-admin verification.' });
      }

      const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.role);
      
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalIds: user.hospitalIds || [],
        isOnboarded: user.isOnboarded || false,
        accessToken,
        refreshToken,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
