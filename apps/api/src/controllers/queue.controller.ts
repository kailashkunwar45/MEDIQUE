import { Request, Response } from 'express';
import { Queue } from '../models/queue.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getIo } from '../socket';
import { NotificationService } from '../services/notification.service';
import { User } from '../models/user.model';

export const getQueueStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { hospitalId, doctorId, date } = req.query;
    
    const queryDate = date ? new Date(date as string).setHours(0, 0, 0, 0) : new Date().setHours(0, 0, 0, 0);

    const queue = await Queue.findOne({
      hospitalId: hospitalId as string,
      doctorId: doctorId as string,
      date: queryDate,
    });

    if (!queue) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    res.json(queue);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const callNextPatient = async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user?._id;
    const { queueId } = req.body;

    const queue = await Queue.findOne({ _id: queueId, doctorId });
    if (!queue) {
      return res.status(404).json({ message: 'Queue not found or unauthorized' });
    }

    if (queue.currentToken < queue.totalTokens) {
      queue.currentToken += 1;
      await queue.save();

      // Update the appointment status to completed for the previous patient
      if (queue.currentToken > 1) {
        await Appointment.findOneAndUpdate(
          { doctorId, date: queue.date, tokenNumber: queue.currentToken - 1 },
          { status: AppointmentStatus.COMPLETED }
        );
      }

      // Find the next appointment
      const nextAppointment = await Appointment.findOne({
        doctorId,
        date: queue.date,
        tokenNumber: queue.currentToken,
      }).populate('patientId', 'email name phone');

      if (nextAppointment) {
        const patient = nextAppointment.patientId as any;
        const doctor = await User.findById(doctorId);
        await NotificationService.notifyNextInQueue(patient.email, patient.phone || '', doctor?.name || 'Doctor');
      }

      // Emit socket event
      const io = getIo();
      io.to(`queue_${queue.hospitalId}_${queue.doctorId}`).emit('queueUpdated', {
        queueId: queue._id,
        currentToken: queue.currentToken,
        totalTokens: queue.totalTokens,
        nextPatient: nextAppointment ? (nextAppointment as any).patientId?.name : null,
      });

      res.json({ message: 'Next patient called', queue, nextAppointment });
    } else {
      res.status(400).json({ message: 'No more patients in the queue' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
