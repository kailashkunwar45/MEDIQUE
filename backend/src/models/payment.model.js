const mongoose = require("mongoose");
var PaymentProvider = /* @__PURE__ */ ((PaymentProvider2) => {
  PaymentProvider2["KHALTI"] = "khalti";
  PaymentProvider2["ESEWA"] = "esewa";
  return PaymentProvider2;
})(PaymentProvider || {});
var PaymentStatus = /* @__PURE__ */ ((PaymentStatus2) => {
  PaymentStatus2["PENDING"] = "pending";
  PaymentStatus2["SUCCESS"] = "success";
  PaymentStatus2["FAILED"] = "failed";
  PaymentStatus2["REFUNDED"] = "refunded";
  return PaymentStatus2;
})(PaymentStatus || {});
const paymentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    provider: { type: String, enum: Object.values(PaymentProvider), required: true },
    amount: { type: Number, required: true },
    transactionId: { type: String, unique: true, sparse: true },
    providerReferenceId: { type: String },
    status: { type: String, enum: Object.values(PaymentStatus), default: "pending" /* PENDING */ }
  },
  {
    timestamps: true
  }
);
const Payment = mongoose.model("Payment", paymentSchema);

module.exports = {
  Payment: Payment,
  PaymentProvider: PaymentProvider,
  PaymentStatus: PaymentStatus,
};
