const { Payment, PaymentStatus, PaymentProvider } = require("../models/payment.model");
const { Appointment, AppointmentStatus } = require("../models/appointment.model");
const crypto = require("crypto");
const notification = require("../services/notification.service");
const initiateKhaltiPayment = async (req, res) => {
  try {
    const { appointmentId, amount } = req.body;
    const patientId = req.user?._id;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    const payment = await Payment.create({
      patientId,
      appointmentId,
      hospitalId: appointment.hospitalId,
      provider: PaymentProvider.KHALTI,
      amount,
      status: PaymentStatus.PENDING,
      transactionId: crypto.randomBytes(8).toString("hex")
    });
    res.json({
      paymentId: payment._id,
      transactionId: payment.transactionId,
      paymentUrl: `https://test-pay.khalti.com/?txnId=${payment.transactionId}`,
      amount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const verifyKhaltiPayment = async (req, res) => {
  try {
    const { token, amount, transactionId } = req.body;
    const payment = await Payment.findOne({ transactionId });
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    payment.status = PaymentStatus.SUCCESS;
    payment.providerReferenceId = token;
    await payment.save();
    const appointment = await Appointment.findByIdAndUpdate(payment.appointmentId, { paymentStatus: "paid" }, { new: true }).populate("patientId", "email name phone").populate("doctorId", "name");
    if (appointment) {
      const patient = appointment.patientId;
      const doctor = appointment.doctorId;
      await notification.NotificationService.notifyAppointmentConfirmed(patient.email, patient.phone || "", {
        date: appointment.date.toLocaleDateString(),
        doctorName: doctor.name,
        tokenNumber: appointment.tokenNumber
      });
    }
    res.json({ message: "Payment verified successfully", payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const initiateEsewaPayment = async (req, res) => {
  try {
    const { appointmentId, amount } = req.body;
    const patientId = req.user?._id;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    const transactionId = crypto.randomBytes(8).toString("hex");
    const payment = await Payment.create({
      patientId,
      appointmentId,
      hospitalId: appointment.hospitalId,
      provider: PaymentProvider.ESEWA,
      amount,
      status: PaymentStatus.PENDING,
      transactionId
    });
    res.json({
      paymentId: payment._id,
      transactionId,
      paymentUrl: `https://test-esewa.com.np/epay/main?tAmt=${amount}&amt=${amount}&txAmt=0&psc=0&pdc=0&scd=${process.env.ESEWA_MERCHANT_CODE}&pid=${transactionId}&su=http://localhost:3000/patient?success=true&fu=http://localhost:3000/patient?failed=true`,
      amount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const verifyEsewaPayment = async (req, res) => {
  try {
    const { transactionId, refId } = req.body;
    const payment = await Payment.findOne({ transactionId });
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    payment.status = PaymentStatus.SUCCESS;
    payment.providerReferenceId = refId;
    await payment.save();
    const appointment = await Appointment.findByIdAndUpdate(payment.appointmentId, { paymentStatus: "paid" }, { new: true }).populate("patientId", "email name phone").populate("doctorId", "name");
    if (appointment) {
      const patient = appointment.patientId;
      const doctor = appointment.doctorId;
      await notification.NotificationService.notifyAppointmentConfirmed(patient.email, patient.phone || "", {
        date: appointment.date.toLocaleDateString(),
        doctorName: doctor.name,
        tokenNumber: appointment.tokenNumber
      });
    }
    res.json({ message: "eSewa Payment verified successfully", payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  initiateEsewaPayment: initiateEsewaPayment,
  initiateKhaltiPayment: initiateKhaltiPayment,
  verifyEsewaPayment: verifyEsewaPayment,
  verifyKhaltiPayment: verifyKhaltiPayment,
};
