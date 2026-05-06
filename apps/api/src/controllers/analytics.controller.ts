import { Response } from 'express';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { Payment, PaymentStatus } from '../models/payment.model';
import { User, UserRole } from '../models/user.model';
import { Hospital } from '../models/hospital.model';
import { Queue } from '../models/queue.model';
import { Subscription } from '../models/subscription.model';
import { AuthRequest } from '../middlewares/auth.middleware';

// ── Hospital Admin Analytics ──────────────────────────────────

export const getHospitalStats = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;

    const [
      totalAppointments,
      completedAppointments,
      pendingAppointments,
      totalRevenue,
      totalDoctors,
      totalPatients,
      recentPayments,
      last7DaysAppointments,
    ] = await Promise.all([
      Appointment.countDocuments({ hospitalId }),
      Appointment.countDocuments({ hospitalId, status: AppointmentStatus.COMPLETED }),
      Appointment.countDocuments({ hospitalId, status: AppointmentStatus.PENDING }),
      Payment.aggregate([
        { $match: { hospitalId, status: PaymentStatus.SUCCESS } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      User.countDocuments({ hospitalId, role: UserRole.DOCTOR }),
      User.countDocuments({ hospitalId, role: UserRole.PATIENT }),
      Payment.find({ hospitalId, status: PaymentStatus.SUCCESS })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('patientId', 'name')
        .lean(),
      // Last 7 days appointment trend
      Appointment.aggregate([
        {
          $match: {
            hospitalId,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      kpis: {
        totalAppointments,
        completedAppointments,
        pendingAppointments,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalDoctors,
        totalPatients,
        completionRate: totalAppointments ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
      },
      recentPayments,
      appointmentTrend: last7DaysAppointments,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Super Admin Analytics ──────────────────────────────────────

export const getPlatformStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalHospitals,
      activeHospitals,
      totalUsers,
      totalPatients,
      totalDoctors,
      totalRevenue,
      subscriptionBreakdown,
      revenueByMonth,
      topHospitals,
    ] = await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ isActive: true }),
      User.countDocuments(),
      User.countDocuments({ role: UserRole.PATIENT }),
      User.countDocuments({ role: UserRole.DOCTOR }),
      Payment.aggregate([
        { $match: { status: PaymentStatus.SUCCESS } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Subscription.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 } } },
      ]),
      // Revenue last 6 months
      Payment.aggregate([
        { $match: { status: PaymentStatus.SUCCESS } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 6 },
      ]),
      // Top hospitals by appointment count
      Appointment.aggregate([
        { $group: { _id: '$hospitalId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'hospitals', localField: '_id', foreignField: '_id', as: 'hospital' } },
        { $unwind: '$hospital' },
        { $project: { name: '$hospital.name', count: 1 } },
      ]),
    ]);

    res.json({
      kpis: {
        totalHospitals,
        activeHospitals,
        totalUsers,
        totalPatients,
        totalDoctors,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      subscriptionBreakdown,
      revenueByMonth: revenueByMonth.reverse(),
      topHospitals,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
