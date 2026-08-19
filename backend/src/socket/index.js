const socket = require("socket.io");
const redis_adapter = require("@socket.io/redis-adapter");
const redis = require("redis");
const jsonwebtoken = require("jsonwebtoken");
const user = require("../models/user.model");
const appointment = require("../models/appointment.model");
const chatMessage = require("../models/chatMessage.model");
const chatConnection = require("../models/chatConnection.model");
const mongoose = require("mongoose");
let io;
const initSocket = async (server) => {
  io = new socket.Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  if (process.env.REDIS_URL) {
    try {
      const pubClient = (redis.createClient)({ url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD });
      const subClient = pubClient.duplicate();
      pubClient.on("error", (err) => console.log("Redis Pub Client Error", err.message));
      subClient.on("error", (err) => console.log("Redis Sub Client Error", err.message));
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connection timeout")), 2000))
      ]);
      io.adapter((redis_adapter.createAdapter)(pubClient, subClient));
      console.log("Socket.io Redis adapter enabled");
    } catch (e) {
      console.log("Redis connection failed, running Socket.io in memory mode:", e.message);
    }
  } else {
    console.log("Redis URL not provided, Socket.io running in memory mode");
  }
  io.on("connection", (socket) => {
    console.log(`New client connected: ${socket.id}`);
    socket.on("joinQueue", (data) => {
      const room = `queue_${data.hospitalId}_${data.doctorId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
    const getUserFromToken = async (token) => {
      if (!token) return null;
      try {
        const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET || "fallback_secret");
        return await user.User.findById(decoded.id).select("-password");
      } catch {
        return null;
      }
    };
    const canAccessChat = (user, appt) => {
      if (!user) return false;
      if (String(appt.patientId) === String(user._id)) return true;
      if (String(appt.doctorId) === String(user._id)) return true;
      if (user.role === user.UserRole.HOSPITAL_ADMIN && user.hospitalId && String(user.hospitalId) === String(appt.hospitalId)) return true;
      return false;
    };
    const chatWindowOpen = async (appt) => {
      if (appt.status === appointment.AppointmentStatus.CONFIRMED) {
        return { ok: true };
      }
      if (appt.status === appointment.AppointmentStatus.COMPLETED) {
        const connection = await chatConnection.ChatConnection.findOne({
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          status: chatConnection.ChatConnectionStatus.ACTIVE
        });
        if (connection) return { ok: true };
        return { ok: false, message: "Session concluded. Request chat reconnection to continue." };
      }
      if (appt.status === appointment.AppointmentStatus.CANCELLED || appt.status === appointment.AppointmentStatus.DECLINED) {
        return { ok: false, message: "Chat is disabled for cancelled or declined appointments." };
      }
      return { ok: false, message: "Chat is available only after doctor accepts the encounter." };
    };
    socket.on("joinChat", async (data) => {
      const user = await getUserFromToken(data?.token);
      if (!user) return socket.emit("chatError", { message: "Unauthorized" });
      if (!data?.appointmentId || !mongoose.Types.ObjectId.isValid(data.appointmentId)) {
        return socket.emit("chatError", { message: "Invalid appointmentId" });
      }
      const appt = await appointment.Appointment.findById(data.appointmentId).lean();
      if (!appt) return socket.emit("chatError", { message: "Appointment not found" });
      if (!canAccessChat(user, appt)) return socket.emit("chatError", { message: "Not authorized for this chat" });
      const window = await chatWindowOpen(appt);
      if (!window.ok) {
        console.log(`chatError (joinChat): ${window.message} for user ${user.name}`);
        return socket.emit("chatError", { message: window.message });
      }
      const room = `chat_${data.appointmentId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} (${user.name}) joined room ${room}`);
      socket.emit("chatJoined", { appointmentId: data.appointmentId });
    });
    socket.on("sendMessage", async (data) => {
      const user = await getUserFromToken(data?.token);
      if (!user) return socket.emit("chatError", { message: "Unauthorized" });
      if (!data?.appointmentId || !mongoose.Types.ObjectId.isValid(data.appointmentId)) {
        return socket.emit("chatError", { message: "Invalid appointmentId" });
      }
      if (typeof data.text !== "string" || !data.text.trim()) {
        return socket.emit("chatError", { message: "Message cannot be empty" });
      }
      const appt = await appointment.Appointment.findById(data.appointmentId).lean();
      if (!appt) return socket.emit("chatError", { message: "Appointment not found" });
      if (!canAccessChat(user, appt)) return socket.emit("chatError", { message: "Not authorized for this chat" });
      const window = await chatWindowOpen(appt);
      if (!window.ok) {
        console.log(`chatError (sendMessage): ${window.message} for user ${user.name}`);
        return socket.emit("chatError", { message: window.message });
      }
      const msg = await chatMessage.ChatMessage.create({
        appointmentId: appt._id,
        hospitalId: appt.hospitalId,
        senderId: user._id,
        senderRole: user.role,
        text: data.text.trim()
      });
      console.log(`Message sent in room chat_${data.appointmentId} by ${user.name}`);
      const messagePayload = {
        _id: msg._id,
        appointmentId: data.appointmentId,
        senderId: user._id,
        senderRole: user.role,
        text: msg.text,
        createdAt: msg.createdAt
      };
      io.to(`chat_${data.appointmentId}`).emit("message", messagePayload);
      const recipientId = String(user._id) === String(appt.patientId) ? appt.doctorId : appt.patientId;
      io.to(`user_${recipientId}`).emit("messageNotification", messagePayload);
    });
    socket.on("registerUser", async (data) => {
      const user = await getUserFromToken(data?.token);
      if (user) {
        socket.join(`user_${user._id}`);
        console.log(`Socket ${socket.id} (${user.name}) joined global user room user_${user._id}`);
      }
    });
  });
  return io;
};
const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = {
  getIo: getIo,
  initSocket: initSocket,
};
