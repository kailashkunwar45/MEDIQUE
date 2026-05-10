import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/user.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { ChatMessage } from '../models/chatMessage.model';
import { ChatConnection, ChatConnectionStatus } from '../models/chatConnection.model';
import mongoose from 'mongoose';

let io: SocketIOServer;

export const initSocket = async (server: Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.log('Redis Pub Client Error', err));
    subClient.on('error', (err) => console.log('Redis Sub Client Error', err));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.io Redis adapter enabled');
  } else {
    console.log('Redis URL not provided, Socket.io running in memory mode');
  }

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Join a room for a specific doctor's queue
    socket.on('joinQueue', (data: { hospitalId: string; doctorId: string }) => {
      const room = `queue_${data.hospitalId}_${data.doctorId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    const getUserFromToken = async (token?: string) => {
      if (!token) return null;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
        return await User.findById(decoded.id).select('-password');
      } catch {
        return null;
      }
    };

    const canAccessChat = (user: any, appt: any) => {
      if (!user) return false;
      if (String(appt.patientId) === String(user._id)) return true;
      if (String(appt.doctorId) === String(user._id)) return true;
      if (user.role === UserRole.HOSPITAL_ADMIN && user.hospitalId && String(user.hospitalId) === String(appt.hospitalId)) return true;
      return false;
    };

    const chatWindowOpen = async (appt: any) => {
      // 1. If CONFIRMED, original rule (active during session)
      if (appt.status === AppointmentStatus.CONFIRMED) {
        return { ok: true };
      }

      // 2. If COMPLETED, check for ACTIVE ChatConnection
      if (appt.status === AppointmentStatus.COMPLETED) {
        const connection = await ChatConnection.findOne({
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          status: ChatConnectionStatus.ACTIVE
        });
        if (connection) return { ok: true };
        return { ok: false, message: 'Session concluded. Request chat reconnection to continue.' };
      }

      if (appt.status === AppointmentStatus.CANCELLED || appt.status === AppointmentStatus.DECLINED) {
        return { ok: false, message: 'Chat is disabled for cancelled or declined appointments.' };
      }

      return { ok: false, message: 'Chat is available only after doctor accepts the encounter.' };
    };

    socket.on('joinChat', async (data: { appointmentId: string; token: string }) => {
      const user = await getUserFromToken(data?.token);
      if (!user) return socket.emit('chatError', { message: 'Unauthorized' });
      if (!data?.appointmentId || !mongoose.Types.ObjectId.isValid(data.appointmentId)) {
        return socket.emit('chatError', { message: 'Invalid appointmentId' });
      }

      const appt = await Appointment.findById(data.appointmentId).lean();
      if (!appt) return socket.emit('chatError', { message: 'Appointment not found' });
      if (!canAccessChat(user, appt)) return socket.emit('chatError', { message: 'Not authorized for this chat' });

      const window = await chatWindowOpen(appt);
      if (!window.ok) {
        console.log(`chatError (joinChat): ${window.message} for user ${user.name}`);
        return socket.emit('chatError', { message: window.message });
      }

      const room = `chat_${data.appointmentId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} (${user.name}) joined room ${room}`);
      socket.emit('chatJoined', { appointmentId: data.appointmentId });
    });

    socket.on('sendMessage', async (data: { appointmentId: string; token: string; text: string }) => {
      const user = await getUserFromToken(data?.token);
      if (!user) return socket.emit('chatError', { message: 'Unauthorized' });
      if (!data?.appointmentId || !mongoose.Types.ObjectId.isValid(data.appointmentId)) {
        return socket.emit('chatError', { message: 'Invalid appointmentId' });
      }
      if (typeof data.text !== 'string' || !data.text.trim()) {
        return socket.emit('chatError', { message: 'Message cannot be empty' });
      }

      const appt = await Appointment.findById(data.appointmentId).lean();
      if (!appt) return socket.emit('chatError', { message: 'Appointment not found' });
      if (!canAccessChat(user, appt)) return socket.emit('chatError', { message: 'Not authorized for this chat' });
      const window = await chatWindowOpen(appt);
      if (!window.ok) {
        console.log(`chatError (sendMessage): ${window.message} for user ${user.name}`);
        return socket.emit('chatError', { message: window.message });
      }

      const msg = await ChatMessage.create({
        appointmentId: appt._id,
        hospitalId: appt.hospitalId,
        senderId: user._id,
        senderRole: user.role,
        text: data.text.trim(),
      });

      console.log(`Message sent in room chat_${data.appointmentId} by ${user.name}`);

      const messagePayload = {
        _id: msg._id,
        appointmentId: data.appointmentId,
        senderId: user._id,
        senderRole: user.role,
        text: msg.text,
        createdAt: msg.createdAt,
      };

      io.to(`chat_${data.appointmentId}`).emit('message', messagePayload);

      // Notify the recipient globally for unread counts
      const recipientId = String(user._id) === String(appt.patientId) ? appt.doctorId : appt.patientId;
      io.to(`user_${recipientId}`).emit('messageNotification', messagePayload);
    });

    socket.on('registerUser', async (data: { token: string }) => {
      const user = await getUserFromToken(data?.token);
      if (user) {
        socket.join(`user_${user._id}`);
        console.log(`Socket ${socket.id} (${user.name}) joined global user room user_${user._id}`);
      }
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
