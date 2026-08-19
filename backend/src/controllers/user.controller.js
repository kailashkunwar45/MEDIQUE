const mongoose = require("mongoose");
const user = require("../models/user.model");
const appointment = require("../models/appointment.model");
const review = require("../models/review.model");
const onboardDoctor = async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      degree,
      certification,
      college,
      specialization,
      experienceYears,
      previousWork,
      hospitalIds,
      appointmentFee
    } = req.body;
    const user = await user.User.findById(userId);
    if (!user || user.role !== user.UserRole.DOCTOR) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    user.degree = degree;
    user.certification = certification;
    user.college = college;
    user.specialization = specialization;
    user.experienceYears = Number(experienceYears);
    user.previousWork = previousWork;
    user.hospitalIds = hospitalIds;
    user.appointmentFee = Number(appointmentFee) || 0;
    user.isOnboarded = true;
    if (Array.isArray(hospitalIds)) {
      user.hospitalApprovals = hospitalIds.map((hId) => ({
        hospitalId: new mongoose.Types.ObjectId(String(hId)),
        status: "pending",
        updatedAt: /* @__PURE__ */ new Date()
      }));
    }
    await user.save();
    res.json({ message: "Onboarding completed successfully. Account pending hospital approval.", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getMe = async (req, res) => {
  res.json(req.user);
};
const updateMe = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { name, phone, specialization, bio } = req.body;
    const updated = await user.User.findByIdAndUpdate(
      userId,
      {
        ...typeof name === "string" ? { name } : {},
        ...typeof phone === "string" ? { phone } : {},
        ...typeof specialization === "string" ? { specialization } : {},
        ...typeof bio === "string" ? { bio } : {}
      },
      { new: true }
    ).select("-password");
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const requestFeeUpdate = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { newFee } = req.body;
    if (!newFee || isNaN(Number(newFee))) {
      return res.status(400).json({ message: "Valid newFee is required" });
    }
    const updatedUser = await user.User.findByIdAndUpdate(
      userId,
      {
        pendingFeeUpdate: {
          newFee: Number(newFee),
          status: "pending",
          requestedAt: /* @__PURE__ */ new Date()
        }
      },
      { new: true }
    );
    res.json({ message: "Fee update requested. Pending Super Admin approval.", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const listAllDoctors = async (req, res) => {
  try {
    const doctors = await user.User.find({
      role: user.UserRole.DOCTOR,
      isOnboarded: true
    }).select("-password").populate("hospitalId", "name address contactPhone contactEmail").lean();
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getDoctorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = String(id);
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "Invalid doctor id" });
    }
    const doctor = await user.User.findOne({ _id: doctorId, role: user.UserRole.DOCTOR }).select("-password").populate("hospitalId", "name address contactPhone contactEmail").lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    const totalBookings = await appointment.Appointment.countDocuments({ doctorId });
    const ratingStats = await review.Review.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(doctorId), targetType: "doctor" } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    const reviews = await review.Review.find({ doctorId: new mongoose.Types.ObjectId(doctorId), targetType: "doctor" }).sort({ createdAt: -1 }).limit(20).populate("patientId", "name").lean();
    res.json({
      doctor,
      stats: {
        totalBookings,
        avgRating: ratingStats[0]?.avg || 0,
        totalReviews: ratingStats[0]?.count || 0
      },
      reviews
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDoctorProfile: getDoctorProfile,
  getMe: getMe,
  listAllDoctors: listAllDoctors,
  onboardDoctor: onboardDoctor,
  requestFeeUpdate: requestFeeUpdate,
  updateMe: updateMe,
};
