const mongoose = require("mongoose");
const user = require("../models/user.model");
const hospital = require("../models/hospital.model");
const appointment = require("../models/appointment.model");
const review = require("../models/review.model");
const onboardHospital = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    const { certification, services, name, address } = req.body;
    if (!hospitalId) return res.status(400).json({ message: "Hospital ID not found in session" });
    const hospital = await hospital.Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    if (name) hospital.name = name;
    if (address) hospital.address = address;
    hospital.certification = certification;
    hospital.services = services;
    hospital.isOnboarded = true;
    await hospital.save();
    res.json({ message: "Hospital onboarding completed", hospital });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getHospitalDoctors = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: "Hospital ID not found" });
    const doctors = await user.User.find({
      role: user.UserRole.DOCTOR,
      $or: [
        { hospitalId },
        { hospitalIds: { $in: [hospitalId] } }
      ]
    }).lean();
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getHospitalPatients = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: "Hospital ID not found" });
    const appointments = await appointment.Appointment.find({
      hospitalId,
      status: { $in: [appointment.AppointmentStatus.CONFIRMED, appointment.AppointmentStatus.COMPLETED] }
    }).populate("patientId", "name email phone").populate("doctorId", "name specialization").sort({ date: -1 });
    const patients = Array.from(new Set(appointments.map((a) => String(a.patientId?._id)))).map((pId) => {
      const patientAppointments = appointments.filter((a) => String(a.patientId?._id) === pId);
      const lastAppt = patientAppointments[0];
      return {
        _id: pId,
        name: lastAppt.patientId.name,
        email: lastAppt.patientId.email,
        phone: lastAppt.patientId.phone,
        doctorName: lastAppt.doctorId.name,
        doctorSpecialization: lastAppt.doctorId.specialization,
        lastVisit: lastAppt.date,
        status: lastAppt.status,
        appointmentId: lastAppt._id
      };
    });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getHospitalUpcomingBookings = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: "Hospital ID not found" });
    const appointments = await appointment.Appointment.find({
      hospitalId,
      status: appointment.AppointmentStatus.CONFIRMED,
      date: { $gte: /* @__PURE__ */ new Date() }
    }).populate("patientId", "name email").populate("doctorId", "name").sort({ date: 1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getHospitalStats = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: "Hospital ID not found" });
    const doctorCount = await user.User.countDocuments({
      role: user.UserRole.DOCTOR,
      $or: [{ hospitalId }, { hospitalIds: { $in: [hospitalId] } }]
    });
    const appointmentStats = await appointment.Appointment.aggregate([
      { $match: { hospitalId: new mongoose.Types.ObjectId(String(hospitalId)) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const totalPatients = await appointment.Appointment.distinct("patientId", { hospitalId });
    res.json({
      doctors: doctorCount,
      patients: totalPatients.length,
      appointments: appointmentStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { pending: 0, confirmed: 0, completed: 0, cancelled: 0, declined: 0 })
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getDoctorStats = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const appointmentStats = await appointment.Appointment.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(String(doctorId)) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const ratingStats = await review.Review.aggregate([
      { $match: { targetId: new mongoose.Types.ObjectId(String(doctorId)), targetType: "doctor" } },
      { $group: { _id: "$rating", count: { $sum: 1 } } }
    ]);
    res.json({
      appointments: appointmentStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { pending: 0, confirmed: 0, completed: 0, cancelled: 0, declined: 0 }),
      ratings: ratingStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDoctorStats: getDoctorStats,
  getHospitalDoctors: getHospitalDoctors,
  getHospitalPatients: getHospitalPatients,
  getHospitalStats: getHospitalStats,
  getHospitalUpcomingBookings: getHospitalUpcomingBookings,
  onboardHospital: onboardHospital,
};
