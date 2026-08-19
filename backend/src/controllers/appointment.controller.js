const { Appointment, AppointmentStatus } = require("../models/appointment.model");
const { Queue } = require("../models/queue.model");
const mongoose = require("mongoose");
const bookAppointment = async (req, res) => {
  try {
    const { doctorId, hospitalId, date, paymentMethod } = req.body;
    const patientId = req.user?._id;
    if (!doctorId || !hospitalId || !date) {
      return res.status(400).json({ message: "doctorId, hospitalId, and date are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(String(doctorId)) || !mongoose.Types.ObjectId.isValid(String(hospitalId))) {
      return res.status(400).json({ message: "doctorId and hospitalId must be valid ids" });
    }
    const appointmentDate = new Date(date).setHours(0, 0, 0, 0);
    const existingPatientBooking = await Appointment.findOne({
      patientId,
      doctorId,
      date: {
        $gte: new Date(appointmentDate),
        $lt: new Date(new Date(appointmentDate).getTime() + 24 * 60 * 60 * 1e3)
      },
      status: { $ne: AppointmentStatus.CANCELLED }
    });
    if (existingPatientBooking) {
      return res.status(400).json({ message: "You cannot book the same doctor more than once within 24 hours." });
    }
    let queue = await Queue.findOne({
      doctorId,
      hospitalId,
      date: appointmentDate
    });
    if (!queue) {
      queue = await Queue.create({
        doctorId,
        hospitalId,
        date: appointmentDate,
        currentToken: 0,
        totalTokens: 0
      });
    }
    const bookingCount = await Appointment.countDocuments({
      doctorId,
      date: {
        $gte: new Date(appointmentDate),
        $lt: new Date(new Date(appointmentDate).getTime() + 24 * 60 * 60 * 1e3)
      },
      status: { $ne: AppointmentStatus.CANCELLED }
    });
    if (bookingCount >= 8) {
      return res.status(400).json({ message: "Doctor has reached maximum booking limit (8) for this day" });
    }
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      hospitalId,
      date,
      tokenNumber: queue.totalTokens,
      status: AppointmentStatus.PENDING,
      paymentMethod: paymentMethod === "online" ? "online" : "pay_later",
      paymentStatus: paymentMethod === "online" ? "paid" : "unpaid",
      hospitalLocked: false
    });
    res.status(201).json({ appointment, queue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getPatientAppointments = async (req, res) => {
  try {
    const patientId = req.user?._id;
    const appointments = await Appointment.find({ patientId, patientDeleted: { $ne: true } }).populate("doctorId", "name email phone").populate("hospitalId", "name address contactEmail contactPhone").sort({ date: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const cancelAppointment = async (req, res) => {
  try {
    const patientId = req.user?._id;
    const { appointmentId, reason } = req.body;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      return res.status(400).json({ message: "Valid appointmentId is required" });
    }
    const appointment = await Appointment.findOne({ _id: appointmentId, patientId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    if (appointment.status === AppointmentStatus.CANCELLED) {
      return res.status(400).json({ message: "Appointment already cancelled" });
    }
    if (appointment.status === AppointmentStatus.COMPLETED) {
      return res.status(400).json({ message: "Completed appointment cannot be cancelled" });
    }
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancelledAt = /* @__PURE__ */ new Date();
    appointment.cancellationReason = typeof reason === "string" ? reason : void 0;
    if (appointment.paymentStatus === "paid") {
      appointment.forfeited = true;
    }
    await appointment.save();
    res.json({ message: "Appointment cancelled", appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const acceptAppointment = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const { appointmentId } = req.body;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      return res.status(400).json({ message: "Valid appointmentId is required" });
    }
    const appointment = await Appointment.findOne({ _id: appointmentId, doctorId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
    if (appointment.status === AppointmentStatus.CANCELLED) {
      return res.status(400).json({ message: "Cancelled appointment cannot be accepted" });
    }
    appointment.status = AppointmentStatus.CONFIRMED;
    appointment.acceptedAt = /* @__PURE__ */ new Date();
    appointment.hospitalLocked = true;
    await appointment.save();
    res.json({ message: "Appointment accepted", appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getDoctorAppointments = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const appointments = await Appointment.find({ doctorId, doctorDeleted: { $ne: true } }).populate("patientId", "name email phone").populate("hospitalId", "name address contactEmail contactPhone").sort({ date: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const completeAppointment = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const { appointmentId, doctorNotes } = req.body;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      return res.status(400).json({ message: "Valid appointmentId is required" });
    }
    const appointment = await Appointment.findOne({ _id: appointmentId, doctorId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      return res.status(400).json({ message: "Only confirmed appointments can be completed" });
    }
    if (!doctorNotes || doctorNotes.trim().length < 10) {
      return res.status(400).json({ message: "Detailed clinical notes (at least 10 characters) are mandatory to conclude the encounter." });
    }
    appointment.status = AppointmentStatus.COMPLETED;
    appointment.doctorNotes = doctorNotes;
    await appointment.save();
    res.json({ message: "Appointment completed", appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const declineAppointment = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const { appointmentId, reason } = req.body;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      return res.status(400).json({ message: "Valid appointmentId is required" });
    }
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appointmentId, doctorId },
      {
        status: AppointmentStatus.DECLINED,
        declinedAt: /* @__PURE__ */ new Date(),
        declineReason: reason
      },
      { new: true }
    );
    res.json({ message: "Appointment declined", appointment: updatedAppointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const changeAppointmentHospital = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const { appointmentId, hospitalId } = req.body;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      return res.status(400).json({ message: "Valid appointmentId is required" });
    }
    if (!hospitalId || !mongoose.Types.ObjectId.isValid(String(hospitalId))) {
      return res.status(400).json({ message: "Valid hospitalId is required" });
    }
    const appointment = await Appointment.findOne({ _id: appointmentId, doctorId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
    if (appointment.hospitalLocked) {
      return res.status(400).json({ message: "Hospital cannot be changed after appointment is accepted" });
    }
    appointment.hospitalId = hospitalId;
    await appointment.save();
    res.json({ message: "Hospital updated, patient will be notified", appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getAppointmentById = async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    const appointment = await Appointment.findById(id).populate("patientId", "name email phone").populate("doctorId", "name email specialization").populate("hospitalId", "name address contactPhone");
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    const userId = req.user?._id;
    if (String(appointment.patientId._id) !== String(userId) && String(appointment.doctorId._id) !== String(userId)) {
      return res.status(403).json({ message: "Unauthorized to view this appointment" });
    }
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const togglePaymentStatus = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const appointmentId = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    const appointment = await Appointment.findOne({ _id: appointmentId, doctorId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
    if (appointment.paymentMethod !== "pay_later") {
      return res.status(400).json({ message: "Can only toggle payment status for onsite (pay_later) appointments" });
    }
    const newStatus = appointment.paymentStatus === "paid" ? "unpaid" : "paid";
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appointmentId, doctorId },
      { paymentStatus: newStatus },
      { new: true }
    );
    res.json({ message: `Payment status changed to ${newStatus}`, appointment: updatedAppointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const deleteHistoryAppointments = async (req, res) => {
  try {
    const userId = req.user?._id;
    const role = req.user?.role;
    const { appointmentIds } = req.body;
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ message: "appointmentIds array is required" });
    }
    const validIds = appointmentIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
    if (validIds.length === 0) {
      return res.status(400).json({ message: "No valid appointment IDs provided" });
    }
    const updateQuery = {};
    const matchQuery = {
      _id: { $in: validIds },
      status: { $in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.DECLINED] }
    };
    if (role === "patient") {
      matchQuery.patientId = userId;
      updateQuery.patientDeleted = true;
    } else if (role === "doctor") {
      matchQuery.doctorId = userId;
      updateQuery.doctorDeleted = true;
    } else {
      return res.status(403).json({ message: "Unauthorized role for this action" });
    }
    const result = await Appointment.updateMany(matchQuery, { $set: updateQuery });
    res.json({ message: `${result.modifiedCount} appointments deleted from history.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  acceptAppointment: acceptAppointment,
  bookAppointment: bookAppointment,
  cancelAppointment: cancelAppointment,
  changeAppointmentHospital: changeAppointmentHospital,
  completeAppointment: completeAppointment,
  declineAppointment: declineAppointment,
  deleteHistoryAppointments: deleteHistoryAppointments,
  getAppointmentById: getAppointmentById,
  getDoctorAppointments: getDoctorAppointments,
  getPatientAppointments: getPatientAppointments,
  togglePaymentStatus: togglePaymentStatus,
};
