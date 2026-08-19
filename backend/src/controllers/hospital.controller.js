const mongoose = require("mongoose");
const hospital = require("../models/hospital.model");
const user = require("../models/user.model");
const review = require("../models/review.model");
const appointment = require("../models/appointment.model");
const listHospitals = async (req, res) => {
  try {
    const hospitals = await hospital.Hospital.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getHospitalById = async (req, res) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: "Invalid hospitalId" });
    }
    const hospital = await hospital.Hospital.findById(hospitalId).lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    const doctors = await user.User.find({
      role: user.UserRole.DOCTOR,
      $or: [
        { hospitalId },
        { hospitalIds: { $in: [new mongoose.Types.ObjectId(hospitalId)] } }
      ]
    }).select("name email phone specialization bio hospitalIds").sort({ createdAt: -1 }).lean();
    const ratingStats = await review.Review.aggregate([
      { $match: { hospitalId: new mongoose.Types.ObjectId(hospitalId), targetType: "hospital" } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    res.json({
      hospital,
      doctors,
      stats: {
        avgRating: ratingStats[0]?.avg || 0,
        totalReviews: ratingStats[0]?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const listHospitalDoctors = async (req, res) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: "Invalid hospitalId" });
    }
    const doctors = await user.User.find({
      role: user.UserRole.DOCTOR,
      $or: [
        { hospitalId },
        { hospitalIds: { $in: [new mongoose.Types.ObjectId(hospitalId)] } }
      ]
    }).select("name email phone hospitalId hospitalIds role specialization bio").sort({ createdAt: -1 }).lean();
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const rateHospital = async (req, res) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    const patientId = req.user?._id;
    const { rating, comment } = req.body;
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: "Invalid hospitalId" });
    }
    const hospital = await hospital.Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }
    const hasVisited = await appointment.Appointment.findOne({
      patientId,
      hospitalId,
      status: appointment.AppointmentStatus.COMPLETED
    });
    if (!hasVisited) {
      return res.status(403).json({ message: "You can only review a hospital after completing an appointment there." });
    }
    const review = await review.Review.findOneAndUpdate(
      { targetType: "hospital", hospitalId, patientId },
      { $set: { targetType: "hospital", hospitalId, patientId, rating: r, comment: typeof comment === "string" ? comment : void 0 } },
      { upsert: true, new: true }
    );
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getHospitalReviews = async (req, res) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: "Invalid hospitalId" });
    }
    const reviews = await review.Review.find({ targetType: "hospital", hospitalId }).sort({ createdAt: -1 }).limit(50).populate("patientId", "name").lean();
    const stats = await review.Review.aggregate([
      { $match: { targetType: "hospital", hospitalId: new mongoose.Types.ObjectId(hospitalId) } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    res.json({
      stats: { average: stats[0]?.avg || 0, count: stats[0]?.count || 0 },
      reviews
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getHospitalById: getHospitalById,
  getHospitalReviews: getHospitalReviews,
  listHospitalDoctors: listHospitalDoctors,
  listHospitals: listHospitals,
  rateHospital: rateHospital,
};
