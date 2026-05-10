import { Request, Response } from 'express';
import { ChatConnection, ChatConnectionStatus } from '../models/chatConnection.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { ChatMessage } from '../models/chatMessage.model';
import { AuthRequest } from '../middlewares/auth.middleware';
import mongoose from 'mongoose';

export const requestChat = async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.body;
    const patientId = req.user?._id;

    if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });

    // 1. Check if patient has any COMPLETED appointment with this doctor
    const completedAppt = await Appointment.findOne({
      patientId,
      doctorId,
      status: AppointmentStatus.COMPLETED
    });

    if (!completedAppt) {
      return res.status(403).json({ message: 'You can only request chat with doctors you have already visited and finished an appointment with.' });
    }

    // 2. Check for existing connection
    let connection = await ChatConnection.findOne({ patientId, doctorId });

    if (connection) {
      if (connection.status === ChatConnectionStatus.ACTIVE) {
        return res.status(200).json({ message: 'Chat is already active', connection });
      }
      if (connection.status === ChatConnectionStatus.PENDING) {
        return res.status(200).json({ message: 'Chat request already pending', connection });
      }
      
      // Reset if denied/closed
      connection.status = ChatConnectionStatus.PENDING;
      connection.initiatedBy = 'patient';
      connection.lastActivity = new Date();
      await connection.save();
    } else {
      connection = await ChatConnection.create({
        patientId,
        doctorId,
        status: ChatConnectionStatus.PENDING,
        initiatedBy: 'patient'
      });
    }

    res.status(201).json({ message: 'Chat request sent to doctor', connection });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const respondToChatRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { connectionId, action } = req.body; // action: 'approve' | 'decline'
    const doctorId = req.user?._id;

    const connection = await ChatConnection.findOne({ _id: connectionId, doctorId });
    if (!connection) return res.status(404).json({ message: 'Chat request not found' });

    if (action === 'approve') {
      connection.status = ChatConnectionStatus.ACTIVE;
    } else {
      connection.status = ChatConnectionStatus.DENIED;
    }

    connection.lastActivity = new Date();
    await connection.save();

    res.json({ message: `Chat request ${action}ed`, connection });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const reconnectWithPatient = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.body;
    const doctorId = req.user?._id;

    if (!patientId) return res.status(400).json({ message: 'patientId is required' });

    let connection = await ChatConnection.findOne({ patientId, doctorId });

    if (connection) {
      connection.status = ChatConnectionStatus.ACTIVE;
      connection.initiatedBy = 'doctor';
      connection.lastActivity = new Date();
      await connection.save();
    } else {
      connection = await ChatConnection.create({
        patientId,
        doctorId,
        status: ChatConnectionStatus.ACTIVE,
        initiatedBy: 'doctor'
      });
    }

    res.json({ message: 'Re-connected with patient. Chat is now active.', connection });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPendingChatRequests = async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user?._id;
    const requests = await ChatConnection.find({
      doctorId,
      status: ChatConnectionStatus.PENDING,
      initiatedBy: 'patient'
    }).populate('patientId', 'name phone email');
    
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getChatConnectionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId, patientId } = req.query;
    const userId = req.user?._id;

    const query: any = {};
    if (doctorId) query.doctorId = doctorId;
    if (patientId) query.patientId = patientId;

    // Security: must be one of the parties
    if (String(query.doctorId) !== String(userId) && String(query.patientId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const connection = await ChatConnection.findOne(query);
    res.json(connection || { status: 'none' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const appointmentId = String(req.params.appointmentId);
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: 'Invalid appointment ID' });
    }

    // 1. Verify that the appointment exists and the user is part of it
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (String(appointment.patientId) !== String(userId) && String(appointment.doctorId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized to access this chat' });
    }

    // 2. Fetch messages
    const messages = await ChatMessage.find({ appointmentId }).sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const role = req.user?.role;

    // 1. Find all appointments for this user
    const query = role === 'doctor' ? { doctorId: userId } : { patientId: userId };
    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialization')
      .sort({ updatedAt: -1 })
      .lean();

    // 2. For each appointment, get last message and unread count
    const conversations = await Promise.all(appointments.map(async (appt: any) => {
      const lastMessage = await ChatMessage.findOne({ appointmentId: appt._id })
        .sort({ createdAt: -1 })
        .lean();

      const unreadCount = await ChatMessage.countDocuments({
        appointmentId: appt._id,
        senderId: { $ne: userId },
        isRead: false
      });

      return {
        appointmentId: appt._id,
        partner: role === 'doctor' ? appt.patientId : appt.doctorId,
        lastMessage,
        unreadCount,
        status: appt.status,
        date: appt.date
      };
    }));

    // Filter to only include those that have messages or are eligible
    const filtered = conversations.filter(c => c.lastMessage || c.status === AppointmentStatus.CONFIRMED);

    res.json(filtered);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.user?._id;

    if (!appointmentId) return res.status(400).json({ message: 'appointmentId is required' });

    await ChatMessage.updateMany(
      { appointmentId, senderId: { $ne: userId }, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
