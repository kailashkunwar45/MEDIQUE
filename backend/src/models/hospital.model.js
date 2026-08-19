const mongoose = require("mongoose");
const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String },
    subscriptionTier: { type: String, enum: ["free", "pro", "premium"], default: "free" },
    isActive: { type: Boolean, default: true },
    certification: { type: String },
    services: [{ type: String }],
    isOnboarded: { type: Boolean, default: false },
    isApprovedBySuperAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String }
  },
  {
    timestamps: true
  }
);
const Hospital = mongoose.model("Hospital", hospitalSchema);

module.exports = {
  Hospital: Hospital,
};
