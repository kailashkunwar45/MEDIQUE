import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { ChatMessage } from '../models/chatMessage.model';
import { UserRole } from '../models/user.model';

const canAccessChat = (req: AuthRequest, appt: any) => {
  const user = req.user;
  if (!user) return false;

  if (String(appt.patientId) === String(user._id)) return true;
  if (String(appt.doctorId) === String(user._id)) return true;

  if (user.role === UserRole.HOSPITAL_ADMIN && user.hospitalId && String(user.hospitalId) === String(appt.hospitalId)) {
    return true;
  }

  return false;
};

const chatWindowOpen = (appt: any) => {
  if (appt.status !== AppointmentStatus.CONFIRMED) return { ok: false, message: 'Chat is available only after doctor accepts' };
  const end = new Date(appt.date).getTime() + 24 * 60 * 60 * 1000;
  if (Date.now() > end) return { ok: false, message: 'Chat session is closed (24h window expired)' };
  return { ok: true };
};

export const getAppointmentMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      return res.status(400).json({ message: 'Invalid appointmentId' });
    }

    const appt = await Appointment.findById(appointmentId).lean();
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (!canAccessChat(req, appt)) return res.status(403).json({ message: 'Not authorized for this chat' });

    const window = chatWindowOpen(appt);
    if (!window.ok) return res.status(400).json({ message: window.message });

    const messages = await ChatMessage.find({ appointmentId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.json({ appointmentId, messages });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

