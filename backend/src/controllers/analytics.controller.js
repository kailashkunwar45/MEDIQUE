var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
const { Appointment, AppointmentStatus } = require("../models/appointment.model");
const { Payment, PaymentStatus, PaymentProvider } = require("../models/payment.model");
const { User, UserRole } = require("../models/user.model");
const { Hospital } = require("../models/hospital.model");
const { Subscription, SubscriptionTier, SubscriptionStatus, BillingCycle } = require("../models/subscription.model");
const getHospitalStats = async (req, res) => {
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
      last7DaysAppointments
    ] = await Promise.all([
      Appointment.countDocuments({ hospitalId }),
      Appointment.countDocuments({ hospitalId, status: AppointmentStatus.COMPLETED }),
      Appointment.countDocuments({ hospitalId, status: AppointmentStatus.PENDING }),
      Payment.aggregate([
        { $match: { hospitalId, status: PaymentStatus.SUCCESS } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      User.countDocuments({ hospitalId, role: UserRole.DOCTOR }),
      User.countDocuments({ hospitalId, role: UserRole.PATIENT }),
      Payment.find({ hospitalId, status: PaymentStatus.SUCCESS }).sort({ createdAt: -1 }).limit(10).populate("patientId", "name").lean(),
      // Last 7 days appointment trend
      Appointment.aggregate([
        {
          $match: {
            hospitalId,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);
    res.json({
      kpis: {
        totalAppointments,
        completedAppointments,
        pendingAppointments,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalDoctors,
        totalPatients,
        completionRate: totalAppointments ? Math.round(completedAppointments / totalAppointments * 100) : 0
      },
      recentPayments,
      appointmentTrend: last7DaysAppointments
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getPlatformStats = async (req, res) => {
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
      topHospitals
    ] = await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ isActive: true }),
      User.countDocuments(),
      User.countDocuments({ role: UserRole.PATIENT }),
      User.countDocuments({ role: UserRole.DOCTOR }),
      Payment.aggregate([
        { $match: { status: PaymentStatus.SUCCESS } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Subscription.aggregate([
        { $group: { _id: "$tier", count: { $sum: 1 } } }
      ]),
      // Revenue last 6 months
      Payment.aggregate([
        { $match: { status: PaymentStatus.SUCCESS } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 6 }
      ]),
      // Top hospitals by appointment count
      Appointment.aggregate([
        { $group: { _id: "$hospitalId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: "hospitals", localField: "_id", foreignField: "_id", as: "hospital" } },
        { $unwind: "$hospital" },
        { $project: { name: "$hospital.name", count: 1 } }
      ])
    ]);
    res.json({
      kpis: {
        totalHospitals,
        activeHospitals,
        totalUsers,
        totalPatients,
        totalDoctors,
        totalRevenue: totalRevenue[0]?.total || 0
      },
      subscriptionBreakdown,
      revenueByMonth: revenueByMonth.reverse(),
      topHospitals
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getHospitalStats: getHospitalStats,
  getPlatformStats: getPlatformStats,
};
