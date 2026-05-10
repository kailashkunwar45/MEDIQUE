import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth.middleware';
import { User, UserRole } from '../models/user.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { Review } from '../models/review.model';

export const onboardDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { 
      degree, 
      certification, 
      college, 
      specialization, 
      experienceYears, 
      previousWork, 
      hospitalIds 
    } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== UserRole.DOCTOR) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    user.degree = degree;
    user.certification = certification;
    user.college = college;
    user.specialization = specialization;
    user.experienceYears = Number(experienceYears);
    user.previousWork = previousWork;
    user.hospitalIds = hospitalIds;
    user.isOnboarded = true;
    
    // Initialize hospital approvals
    if (Array.isArray(hospitalIds)) {
      user.hospitalApprovals = hospitalIds.map(hId => ({
        hospitalId: new mongoose.Types.ObjectId(String(hId)),
        status: 'pending',
        updatedAt: new Date()
      })) as any;
    }

    await user.save();

    res.json({ message: 'Onboarding completed successfully. Account pending hospital approval.', user });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  res.json(req.user);
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { name, phone, specialization, bio } = req.body;

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        ...(typeof name === 'string' ? { name } : {}),
        ...(typeof phone === 'string' ? { phone } : {}),
        ...(typeof specialization === 'string' ? { specialization } : {}),
        ...(typeof bio === 'string' ? { bio } : {}),
      },
      { new: true }
    ).select('-password');

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const listAllDoctors = async (req: Request, res: Response) => {
  try {
    const doctors = await User.find({
      role: UserRole.DOCTOR,
      isOnboarded: true
    })
      .select('-password')
      .populate('hospitalId', 'name address contactPhone contactEmail')
      .lean();
    res.json(doctors);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getDoctorProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doctorId = String(id);
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const doctor = await User.findOne({ _id: doctorId, role: UserRole.DOCTOR })
      .select('-password')
      .populate('hospitalId', 'name address contactPhone contactEmail')
      .lean();

    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const totalBookings = await Appointment.countDocuments({ doctorId: doctorId });

    const ratingStats = await Review.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(doctorId), targetType: 'doctor' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const reviews = await Review.find({ doctorId: new mongoose.Types.ObjectId(doctorId), targetType: 'doctor' })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('patientId', 'name')
      .lean();

    res.json({
      doctor,
      stats: {
        totalBookings,
        avgRating: ratingStats[0]?.avg || 0,
        totalReviews: ratingStats[0]?.count || 0,
      },
      reviews,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
