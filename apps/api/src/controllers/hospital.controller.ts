import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Hospital } from '../models/hospital.model';
import { User, UserRole } from '../models/user.model';
import { Review } from '../models/review.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { AuthRequest } from '../middlewares/auth.middleware';

export const listHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await Hospital.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    res.json(hospitals);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getHospitalById = async (req: Request, res: Response) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: 'Invalid hospitalId' });
    }

    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    const doctors = await User.find({ 
      role: UserRole.DOCTOR, 
      $or: [
        { hospitalId: hospitalId as any },
        { hospitalIds: { $in: [new mongoose.Types.ObjectId(hospitalId)] } }
      ]
    })
      .select('name email phone specialization bio hospitalIds')
      .sort({ createdAt: -1 })
      .lean();

    const ratingStats = await Review.aggregate([
      { $match: { hospitalId: new mongoose.Types.ObjectId(hospitalId), targetType: 'hospital' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    res.json({
      hospital,
      doctors,
      stats: {
        avgRating: ratingStats[0]?.avg || 0,
        totalReviews: ratingStats[0]?.count || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const listHospitalDoctors = async (req: Request, res: Response) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: 'Invalid hospitalId' });
    }

    const doctors = await User.find({ 
      role: UserRole.DOCTOR, 
      $or: [
        { hospitalId: hospitalId as any },
        { hospitalIds: { $in: [new mongoose.Types.ObjectId(hospitalId)] } }
      ]
    })
      .select('name email phone hospitalId hospitalIds role specialization bio')
      .sort({ createdAt: -1 })
      .lean();

    res.json(doctors);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const rateHospital = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    const patientId = req.user?._id;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: 'Invalid hospitalId' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }

    // Must have a completed appointment at this hospital
    const hasVisited = await Appointment.findOne({
      patientId,
      hospitalId,
      status: AppointmentStatus.COMPLETED,
    });
    if (!hasVisited) {
      return res.status(403).json({ message: 'You can only review a hospital after completing an appointment there.' });
    }

    const review = await Review.findOneAndUpdate(
      { targetType: 'hospital', hospitalId, patientId },
      { $set: { targetType: 'hospital', hospitalId, patientId, rating: r, comment: typeof comment === 'string' ? comment : undefined } },
      { upsert: true, new: true }
    );

    res.status(201).json(review);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getHospitalReviews = async (req: Request, res: Response) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: 'Invalid hospitalId' });
    }

    const reviews = await Review.find({ targetType: 'hospital', hospitalId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('patientId', 'name')
      .lean();

    const stats = await Review.aggregate([
      { $match: { targetType: 'hospital', hospitalId: new mongoose.Types.ObjectId(hospitalId) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    res.json({
      stats: { average: stats[0]?.avg || 0, count: stats[0]?.count || 0 },
      reviews,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
