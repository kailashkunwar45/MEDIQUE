const mongoose = require("mongoose");
var AppointmentStatus = /* @__PURE__ */ ((AppointmentStatus2) => {
  AppointmentStatus2["PENDING"] = "pending";
  AppointmentStatus2["CONFIRMED"] = "confirmed";
  AppointmentStatus2["COMPLETED"] = "completed";
  AppointmentStatus2["CANCELLED"] = "cancelled";
  AppointmentStatus2["DECLINED"] = "declined";
  return AppointmentStatus2;
})(AppointmentStatus || {});
const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(AppointmentStatus),
      default: "pending" /* PENDING */
    },
    paymentMethod: {
      type: String,
      enum: ["online", "pay_later"],
      default: "pay_later"
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid"
    },
    acceptedAt: { type: Date },
    declinedAt: { type: Date },
    declineReason: { type: String },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    forfeited: { type: Boolean, default: false },
    tokenNumber: { type: Number },
    hospitalLocked: { type: Boolean, default: false },
    doctorNotes: { type: String },
    cancelReason: { type: String },
    patientDeleted: { type: Boolean, default: false },
    doctorDeleted: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);
const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = {
  Appointment: Appointment,
  AppointmentStatus: AppointmentStatus,
};
