const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");
var UserRole = /* @__PURE__ */ ((UserRole2) => {
  UserRole2["PATIENT"] = "patient";
  UserRole2["DOCTOR"] = "doctor";
  UserRole2["HOSPITAL_ADMIN"] = "hospital_admin";
  UserRole2["SUPER_ADMIN"] = "super_admin";
  return UserRole2;
})(UserRole || {});
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, select: false },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: "patient" /* PATIENT */,
      required: true
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital"
    },
    hospitalIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital"
    }],
    phone: { type: String },
    specialization: { type: String },
    bio: { type: String },
    degree: { type: String },
    certification: { type: String },
    college: { type: String },
    experienceYears: { type: Number },
    previousWork: { type: String },
    isOnboarded: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isApprovedBySuperAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    appointmentFee: { type: Number },
    pendingFeeUpdate: {
      newFee: { type: Number },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      requestedAt: { type: Date, default: Date.now },
      reason: { type: String }
    },
    hospitalApprovals: [{
      hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      updatedAt: { type: Date, default: Date.now }
    }]
  },
  {
    timestamps: true
  }
);
userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcryptjs.compare(enteredPassword, this.password);
};
userSchema.pre("save", async function() {
  if (!this.isModified("password") || !this.password) {
    return;
  } else {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
  }
});
const User = mongoose.model("User", userSchema);

module.exports = {
  User: User,
  UserRole: UserRole,
};
