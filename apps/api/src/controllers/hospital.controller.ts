import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Hospital } from '../models/hospital.model';
import { User, UserRole } from '../models/user.model';

export const listHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await Hospital.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    res.json(hospitals);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const listHospitalDoctors = async (req: Request, res: Response) => {
  try {
    const { hospitalId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: 'Invalid hospitalId' });
    }

    const doctors = await User.find({ role: UserRole.DOCTOR, hospitalId })
      .select('name email phone hospitalId role')
      .sort({ createdAt: -1 })
      .lean();

    res.json(doctors);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

