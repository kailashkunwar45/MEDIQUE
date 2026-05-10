import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/review.model';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Appointment, AppointmentStatus } from '../models/appointment.model';

export const addReview = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?._id;
    const { doctorId, rating, comment, appointmentId } = req.body;

    if (!doctorId || !mongoose.Types.ObjectId.isValid(String(doctorId))) {
      return res.status(400).json({ message: 'Valid doctorId is required' });
    }

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }

    // Must have a completed appointment with this doctor
    const hasCompleted = await Appointment.findOne({
      patientId,
      doctorId,
      status: AppointmentStatus.COMPLETED,
    });
    if (!hasCompleted) {
      return res.status(403).json({ message: 'You can only review a doctor after completing an appointment with them.' });
    }

    const doc: any = {
      targetType: 'doctor',
      doctorId,
      patientId,
      rating: r,
      comment: typeof comment === 'string' ? comment : undefined,
    };
    if (appointmentId && mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      doc.appointmentId = appointmentId;
    }

    const review = await Review.findOneAndUpdate(
      { targetType: 'doctor', doctorId, patientId, ...(doc.appointmentId ? { appointmentId: doc.appointmentId } : {}) },
      { $set: doc },
      { upsert: true, new: true }
    );

    res.status(201).json(review);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'You already reviewed this doctor for this appointment' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getDoctorReviews = async (req: Request, res: Response) => {
  try {
    const doctorId = String(req.params.doctorId);
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: 'Invalid doctorId' });
    }

    const reviews = await Review.find({ targetType: 'doctor', doctorId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('patientId', 'name')
      .lean();

    const stats = await Review.aggregate([
      { $match: { targetType: 'doctor', doctorId: new mongoose.Types.ObjectId(doctorId) } },
      { $group: { _id: '$doctorId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    res.json({
      stats: { average: stats[0]?.avg || 0, count: stats[0]?.count || 0 },
      reviews,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
