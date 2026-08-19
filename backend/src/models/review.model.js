const mongoose = require("mongoose");
const reviewSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["doctor", "hospital"], required: true, default: "doctor" },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String }
  },
  { timestamps: true }
);
reviewSchema.index({ targetType: 1, doctorId: 1, patientId: 1, appointmentId: 1 }, { unique: true, sparse: true });
reviewSchema.index({ targetType: 1, hospitalId: 1, patientId: 1 }, { sparse: true });
const Review = mongoose.model("Review", reviewSchema);

module.exports = {
  Review: Review,
};
