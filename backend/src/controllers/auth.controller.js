const user = require("../models/user.model");
const jwt = require("../utils/jwt");
const mongoose = require("mongoose");
const hospital = require("../models/hospital.model");
const normalizeRole = (raw) => {
  if (!raw) return user.UserRole.PATIENT;
  if (typeof raw !== "string") return user.UserRole.PATIENT;
  const v = raw.trim();
  const upper = v.toUpperCase();
  if (upper === "PATIENT") return user.UserRole.PATIENT;
  if (upper === "DOCTOR") return user.UserRole.DOCTOR;
  if (upper === "HOSPITAL_ADMIN") return user.UserRole.HOSPITAL_ADMIN;
  if (upper === "SUPER_ADMIN") throw new Error("Super Admin accounts must be created manually");
  const lower = v.toLowerCase();
  if (lower === user.UserRole.PATIENT) return user.UserRole.PATIENT;
  if (lower === user.UserRole.DOCTOR) return user.UserRole.DOCTOR;
  if (lower === user.UserRole.HOSPITAL_ADMIN) return user.UserRole.HOSPITAL_ADMIN;
  if (lower === user.UserRole.SUPER_ADMIN) throw new Error("Super Admin accounts must be created manually");
  return user.UserRole.PATIENT;
};
const ensureHospitalId = async (role, rawHospitalId) => {
  if (role === user.UserRole.PATIENT || role === user.UserRole.SUPER_ADMIN) return void 0;
  if (typeof rawHospitalId === "string" && mongoose.Types.ObjectId.isValid(rawHospitalId)) {
    return new mongoose.Types.ObjectId(rawHospitalId);
  }
  const hospital = await hospital.Hospital.create({
    name: "Demo Hospital",
    address: "Kathmandu",
    contactEmail: "demo@mediqueue.local",
    contactPhone: "0000000000",
    subscriptionTier: "free",
    isActive: true
  });
  return hospital._id;
};
const register = async (req, res) => {
  try {
    let { name, email, password, role: rawRole, hospitalId: rawHospitalId, phone } = req.body;
    if (typeof name === "string") name = name.trim();
    if (typeof email === "string") email = email.trim();
    if (typeof password === "string") password = password.trim();
    if (typeof phone === "string") phone = phone.trim();
    const role = normalizeRole(rawRole);
    const hospitalId = await ensureHospitalId(role, rawHospitalId);
    const userExists = await user.User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const user = await user.User.create({
      name,
      email,
      password,
      role,
      hospitalId,
      phone
    });
    if (user) {
      const { accessToken, refreshToken } = (jwt.generateTokens)(user._id.toString(), user.role);
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalIds: user.hospitalIds || [],
        isOnboarded: user.isOnboarded || false,
        appointmentFee: user.appointmentFee || 0,
        pendingFeeUpdate: user.pendingFeeUpdate,
        accessToken,
        refreshToken
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const login = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (typeof email === "string") email = email.trim();
    if (typeof password === "string") password = password.trim();
    const user = await user.User.findOne({ email }).select("+password");
    if (user && await user.matchPassword(password)) {
      if (user.isBanned) {
        return res.status(403).json({ message: `Your account is banned. Reason: ${user.banReason || "Unspecified"}` });
      }
      if (user.hospitalId) {
        const hospital = await hospital.Hospital.findById(user.hospitalId);
        if (hospital?.isBanned) {
          return res.status(403).json({ message: `Your hospital is temporarily banned. Reason: ${hospital.banReason || "Unspecified"}` });
        }
      }
      if (user.role === user.UserRole.DOCTOR) {
        if (user.isOnboarded && !user.isApprovedBySuperAdmin) {
          return res.status(403).json({ message: "Account pending final super-admin approval." });
        }
      }
      if (user.role === user.UserRole.HOSPITAL_ADMIN && user.isOnboarded && !user.isApprovedBySuperAdmin) {
        return res.status(403).json({ message: "Hospital admin account pending super-admin verification." });
      }
      const { accessToken, refreshToken } = (jwt.generateTokens)(user._id.toString(), user.role);
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalIds: user.hospitalIds || [],
        isOnboarded: user.isOnboarded || false,
        appointmentFee: user.appointmentFee || 0,
        pendingFeeUpdate: user.pendingFeeUpdate,
        accessToken,
        refreshToken
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  login: login,
  register: register,
};
