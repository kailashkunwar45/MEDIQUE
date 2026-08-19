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
const { User, UserRole } = require("../models/user.model");
const { Hospital } = require("../models/hospital.model");
const { Appointment, AppointmentStatus } = require("../models/appointment.model");
const socket = require("../socket");
const getPendingHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isApprovedBySuperAdmin: false }).lean();
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getApprovedHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isApprovedBySuperAdmin: true }).lean();
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const approveHospital = async (req, res) => {
  try {
    const { hospitalId, status } = req.body;
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    if (status === "approved") {
      hospital.isApprovedBySuperAdmin = true;
      hospital.isActive = true;
      await User.updateMany(
        { hospitalId: hospital._id, role: UserRole.HOSPITAL_ADMIN },
        { isApprovedBySuperAdmin: true }
      );
    } else {
      hospital.isActive = false;
    }
    await hospital.save();
    res.json({ message: `Hospital ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getPendingDoctorsGlobal = async (req, res) => {
  try {
    const doctors = await User.find({
      role: UserRole.DOCTOR,
      isApprovedBySuperAdmin: false,
      isOnboarded: true
    }).populate("hospitalIds", "name").lean();
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getApprovedDoctorsGlobal = async (req, res) => {
  try {
    const doctors = await User.find({
      role: UserRole.DOCTOR,
      isApprovedBySuperAdmin: true
    }).populate("hospitalIds", "name").lean();
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const approveDoctorGlobal = async (req, res) => {
  try {
    const { doctorId, status } = req.body;
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    if (status === "approved") {
      doctor.isApprovedBySuperAdmin = true;
    } else {
    }
    await doctor.save();
    res.json({ message: `Doctor ${status} globally` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const removeDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    await User.findOneAndDelete({ _id: doctorId, role: UserRole.DOCTOR });
    res.json({ message: "Doctor removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const removeHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    await Hospital.findByIdAndDelete(hospitalId);
    await User.updateMany({ hospitalId }, { isActive: false });
    res.json({ message: "Hospital removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const banUser = async (req, res) => {
  try {
    const { userId, isBanned, reason } = req.body;
    await User.findByIdAndUpdate(userId, { isBanned, banReason: reason });
    res.json({ message: `User ${isBanned ? "banned" : "unbanned"} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const banHospital = async (req, res) => {
  try {
    const { hospitalId, isBanned, reason } = req.body;
    await Hospital.findByIdAndUpdate(hospitalId, { isBanned, banReason: reason });
    res.json({ message: `Hospital ${isBanned ? "banned" : "unbanned"} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const cancelAppointmentGlobal = async (req, res) => {
  try {
    const { appointmentId, reason } = req.body;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancelReason = reason || "Cancelled by System Administrator";
    await appointment.save();
    res.json({ message: "Appointment cancelled globally" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getGlobalStats = async (req, res) => {
  try {
    const hospitalCount = await Hospital.countDocuments();
    const doctorCount = await User.countDocuments({ role: UserRole.DOCTOR });
    const patientCount = await User.countDocuments({ role: UserRole.PATIENT });
    const totalAppointments = await Appointment.countDocuments();
    const appointmentMix = await Appointment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    res.json({
      hospitals: hospitalCount,
      doctors: doctorCount,
      patients: patientCount,
      appointments: {
        total: totalAppointments,
        mix: appointmentMix.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getPendingFeeUpdates = async (req, res) => {
  try {
    const doctors = await User.find({
      role: UserRole.DOCTOR,
      pendingFeeUpdate: { $exists: true }
    }).select("name email specialization appointmentFee pendingFeeUpdate").lean();
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const approveFeeUpdate = async (req, res) => {
  try {
    const { doctorId, status, reason } = req.body;
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    if (!doctor.pendingFeeUpdate || doctor.pendingFeeUpdate.status !== "pending") {
      return res.status(400).json({ message: "No pending fee update for this doctor" });
    }
    if (status === "approved") {
      doctor.appointmentFee = doctor.pendingFeeUpdate.newFee;
      doctor.pendingFeeUpdate.status = "approved";
      if (reason) doctor.pendingFeeUpdate.reason = reason;
    } else {
      doctor.pendingFeeUpdate.status = "rejected";
      if (reason) doctor.pendingFeeUpdate.reason = reason;
    }
    await doctor.save();
    try {
      (socket.getIo)().to(`user_${doctor._id}`).emit("feeUpdateNotification", {
        status: doctor.pendingFeeUpdate.status,
        newFee: doctor.pendingFeeUpdate.newFee,
        reason: doctor.pendingFeeUpdate.reason
      });
    } catch (err) {
      console.log("Failed to emit feeUpdateNotification", err);
    }
    res.json({ message: `Fee update ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const bulkUpdateFees = async (req, res) => {
  try {
    const { newFee } = req.body;
    if (!newFee || isNaN(Number(newFee))) {
      return res.status(400).json({ message: "Valid newFee is required" });
    }
    const result = await User.updateMany(
      { role: UserRole.DOCTOR },
      {
        pendingFeeUpdate: {
          newFee: Number(newFee),
          status: "pending",
          requestedAt: /* @__PURE__ */ new Date()
        }
      }
    );
    res.json({ message: `Bulk update initiated for ${result.modifiedCount} doctors`, count: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  approveDoctorGlobal: approveDoctorGlobal,
  approveFeeUpdate: approveFeeUpdate,
  approveHospital: approveHospital,
  banHospital: banHospital,
  banUser: banUser,
  bulkUpdateFees: bulkUpdateFees,
  cancelAppointmentGlobal: cancelAppointmentGlobal,
  getApprovedDoctorsGlobal: getApprovedDoctorsGlobal,
  getApprovedHospitals: getApprovedHospitals,
  getGlobalStats: getGlobalStats,
  getPendingDoctorsGlobal: getPendingDoctorsGlobal,
  getPendingFeeUpdates: getPendingFeeUpdates,
  getPendingHospitals: getPendingHospitals,
  removeDoctor: removeDoctor,
  removeHospital: removeHospital,
};
