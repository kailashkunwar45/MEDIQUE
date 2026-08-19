const { User, UserRole } = require("../models/user.model");
const { Hospital } = require("../models/hospital.model");
const jwt = require("../utils/jwt");
const mongoose = require("mongoose");

const normalizeRole = (raw) => {
  if (!raw) return UserRole.PATIENT;
  if (typeof raw !== "string") return UserRole.PATIENT;
  const v = raw.trim();
  const upper = v.toUpperCase();
  if (upper === "PATIENT") return UserRole.PATIENT;
  if (upper === "DOCTOR") return UserRole.DOCTOR;
  if (upper === "HOSPITAL_ADMIN") return UserRole.HOSPITAL_ADMIN;
  if (upper === "SUPER_ADMIN") throw new Error("Super Admin accounts must be created manually");
  const lower = v.toLowerCase();
  if (lower === UserRole.PATIENT) return UserRole.PATIENT;
  if (lower === UserRole.DOCTOR) return UserRole.DOCTOR;
  if (lower === UserRole.HOSPITAL_ADMIN) return UserRole.HOSPITAL_ADMIN;
  if (lower === UserRole.SUPER_ADMIN) throw new Error("Super Admin accounts must be created manually");
  return UserRole.PATIENT;
};

const ensureHospitalId = async (role, rawHospitalId) => {
  if (role === UserRole.PATIENT || role === UserRole.SUPER_ADMIN) return void 0;
  if (typeof rawHospitalId === "string" && mongoose.Types.ObjectId.isValid(rawHospitalId)) {
    return new mongoose.Types.ObjectId(rawHospitalId);
  }
  const hosp = await Hospital.create({
    name: "Demo Hospital",
    address: "Kathmandu",
    contactEmail: "demo@mediqueue.local",
    contactPhone: "0000000000",
    subscriptionTier: "free",
    isActive: true
  });
  return hosp._id;
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
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const newUser = await User.create({
      name,
      email,
      password,
      role,
      hospitalId,
      phone
    });
    if (newUser) {
      const { accessToken, refreshToken } = jwt.generateTokens(newUser._id.toString(), newUser.role);
      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        hospitalId: newUser.hospitalId,
        hospitalIds: newUser.hospitalIds || [],
        isOnboarded: newUser.isOnboarded || false,
        appointmentFee: newUser.appointmentFee || 0,
        pendingFeeUpdate: newUser.pendingFeeUpdate,
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
    const foundUser = await User.findOne({ email }).select("+password");
    if (foundUser && (await foundUser.matchPassword(password))) {
      if (foundUser.isBanned) {
        return res.status(403).json({ message: `Your account is banned. Reason: ${foundUser.banReason || "Unspecified"}` });
      }
      if (foundUser.hospitalId) {
        const hosp = await Hospital.findById(foundUser.hospitalId);
        if (hosp?.isBanned) {
          return res.status(403).json({ message: `Your hospital is temporarily banned. Reason: ${hosp.banReason || "Unspecified"}` });
        }
      }
      if (foundUser.role === UserRole.DOCTOR) {
        if (foundUser.isOnboarded && !foundUser.isApprovedBySuperAdmin) {
          return res.status(403).json({ message: "Account pending final super-admin approval." });
        }
      }
      if (foundUser.role === UserRole.HOSPITAL_ADMIN && foundUser.isOnboarded && !foundUser.isApprovedBySuperAdmin) {
        return res.status(403).json({ message: "Hospital admin account pending super-admin verification." });
      }
      const { accessToken, refreshToken } = jwt.generateTokens(foundUser._id.toString(), foundUser.role);
      res.json({
        _id: foundUser._id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
        hospitalId: foundUser.hospitalId,
        hospitalIds: foundUser.hospitalIds || [],
        isOnboarded: foundUser.isOnboarded || false,
        appointmentFee: foundUser.appointmentFee || 0,
        pendingFeeUpdate: foundUser.pendingFeeUpdate,
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
  login,
  register,
};
