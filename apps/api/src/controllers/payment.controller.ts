import { Request, Response } from 'express';
import axios from 'axios';
import { Payment, PaymentProvider, PaymentStatus } from '../models/payment.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { AuthRequest } from '../middlewares/auth.middleware';
import crypto from 'crypto';
import { NotificationService } from '../services/notification.service';

export const initiateKhaltiPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId, amount } = req.body;
    const patientId = req.user?._id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const payment = await Payment.create({
      patientId,
      appointmentId,
      hospitalId: appointment.hospitalId,
      provider: PaymentProvider.KHALTI,
      amount,
      status: PaymentStatus.PENDING,
      transactionId: crypto.randomBytes(8).toString('hex'), 
    });

    res.json({
      paymentId: payment._id,
      transactionId: payment.transactionId,
      paymentUrl: `https://test-pay.khalti.com/?txnId=${payment.transactionId}`,
      amount: amount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyKhaltiPayment = async (req: Request, res: Response) => {
  try {
    const { token, amount, transactionId } = req.body;

    const payment = await Payment.findOne({ transactionId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    payment.status = PaymentStatus.SUCCESS;
    payment.providerReferenceId = token;
    await payment.save();

    const appointment = await Appointment.findByIdAndUpdate(payment.appointmentId, { paymentStatus: 'paid' }, { new: true })
      .populate('patientId', 'email name phone')
      .populate('doctorId', 'name');

    if (appointment) {
      const patient = appointment.patientId as any;
      const doctor = appointment.doctorId as any;
      await NotificationService.notifyAppointmentConfirmed(patient.email, patient.phone || '', {
        date: appointment.date.toLocaleDateString(),
        doctorName: doctor.name,
        tokenNumber: appointment.tokenNumber,
      });
    }

    res.json({ message: 'Payment verified successfully', payment });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const initiateEsewaPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId, amount } = req.body;
    const patientId = req.user?._id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const transactionId = crypto.randomBytes(8).toString('hex');
    const payment = await Payment.create({
      patientId,
      appointmentId,
      hospitalId: appointment.hospitalId,
      provider: PaymentProvider.ESEWA,
      amount,
      status: PaymentStatus.PENDING,
      transactionId,
    });

    res.json({
      paymentId: payment._id,
      transactionId,
      paymentUrl: `https://test-esewa.com.np/epay/main?tAmt=${amount}&amt=${amount}&txAmt=0&psc=0&pdc=0&scd=${process.env.ESEWA_MERCHANT_CODE}&pid=${transactionId}&su=http://localhost:3000/patient?success=true&fu=http://localhost:3000/patient?failed=true`,
      amount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyEsewaPayment = async (req: Request, res: Response) => {
  try {
    const { transactionId, refId } = req.body;

    const payment = await Payment.findOne({ transactionId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    payment.status = PaymentStatus.SUCCESS;
    payment.providerReferenceId = refId;
    await payment.save();

    const appointment = await Appointment.findByIdAndUpdate(payment.appointmentId, { paymentStatus: 'paid' }, { new: true })
      .populate('patientId', 'email name phone')
      .populate('doctorId', 'name');

    if (appointment) {
      const patient = appointment.patientId as any;
      const doctor = appointment.doctorId as any;
      await NotificationService.notifyAppointmentConfirmed(patient.email, patient.phone || '', {
        date: appointment.date.toLocaleDateString(),
        doctorName: doctor.name,
        tokenNumber: appointment.tokenNumber,
      });
    }

    res.json({ message: 'eSewa Payment verified successfully', payment });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
