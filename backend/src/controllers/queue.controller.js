var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
const { Queue } = require("../models/queue.model");
const { Appointment, AppointmentStatus } = require("../models/appointment.model");
const socket = require("../socket");
const notification = require("../services/notification.service");
const { User, UserRole } = require("../models/user.model");
const getQueueStatus = async (req, res) => {
  try {
    const { hospitalId, doctorId, date } = req.query;
    const queryDate = date ? new Date(date).setHours(0, 0, 0, 0) : (/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0);
    const queue = await Queue.findOne({
      hospitalId,
      doctorId,
      date: queryDate
    });
    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }
    res.json(queue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const callNextPatient = async (req, res) => {
  try {
    const doctorId = req.user?._id;
    const { queueId } = req.body;
    const queue = await Queue.findOne({ _id: queueId, doctorId });
    if (!queue) {
      return res.status(404).json({ message: "Queue not found or unauthorized" });
    }
    if (queue.currentToken < queue.totalTokens) {
      queue.currentToken += 1;
      await queue.save();
      if (queue.currentToken > 1) {
        await Appointment.findOneAndUpdate(
          { doctorId, date: queue.date, tokenNumber: queue.currentToken - 1 },
          { status: AppointmentStatus.COMPLETED }
        );
      }
      const nextAppointment = await Appointment.findOne({
        doctorId,
        date: queue.date,
        tokenNumber: queue.currentToken
      }).populate("patientId", "email name phone");
      if (nextAppointment) {
        const patient = nextAppointment.patientId;
        const doctor = await User.findById(doctorId);
        await notification.NotificationService.notifyNextInQueue(patient.email, patient.phone || "", doctor?.name || "Doctor");
      }
      const io = (socket.getIo)();
      io.to(`queue_${queue.hospitalId}_${queue.doctorId}`).emit("queueUpdated", {
        queueId: queue._id,
        currentToken: queue.currentToken,
        totalTokens: queue.totalTokens,
        nextPatient: nextAppointment ? nextAppointment.patientId?.name : null
      });
      res.json({ message: "Next patient called", queue, nextAppointment });
    } else {
      res.status(400).json({ message: "No more patients in the queue" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  callNextPatient: callNextPatient,
  getQueueStatus: getQueueStatus,
};
