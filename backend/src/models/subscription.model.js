const mongoose = require("mongoose");
var SubscriptionTier = /* @__PURE__ */ ((SubscriptionTier2) => {
  SubscriptionTier2["FREE"] = "free";
  SubscriptionTier2["PRO"] = "pro";
  SubscriptionTier2["PREMIUM"] = "premium";
  return SubscriptionTier2;
})(SubscriptionTier || {});
var SubscriptionStatus = /* @__PURE__ */ ((SubscriptionStatus2) => {
  SubscriptionStatus2["ACTIVE"] = "active";
  SubscriptionStatus2["EXPIRED"] = "expired";
  SubscriptionStatus2["CANCELLED"] = "cancelled";
  return SubscriptionStatus2;
})(SubscriptionStatus || {});
const TIER_LIMITS = {
  ["free" /* FREE */]: { maxDoctors: 3, maxAppointmentsPerDay: 50, analytics: false, notifications: false },
  ["pro" /* PRO */]: { maxDoctors: 15, maxAppointmentsPerDay: 500, analytics: false, notifications: true },
  ["premium" /* PREMIUM */]: { maxDoctors: 999, maxAppointmentsPerDay: 9999, analytics: true, notifications: true }
};
const subscriptionSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, unique: true },
    tier: { type: String, enum: Object.values(SubscriptionTier), default: "free" /* FREE */ },
    status: { type: String, enum: Object.values(SubscriptionStatus), default: "active" /* ACTIVE */ },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    monthlyFee: { type: Number, default: 0 },
    limits: { type: mongoose.Schema.Types.Mixed, default: TIER_LIMITS["free" /* FREE */] }
  },
  { timestamps: true }
);
const Subscription = mongoose.model("Subscription", subscriptionSchema);

module.exports = {
  Subscription: Subscription,
  SubscriptionStatus: SubscriptionStatus,
  SubscriptionTier: SubscriptionTier,
  TIER_LIMITS: TIER_LIMITS,
};
