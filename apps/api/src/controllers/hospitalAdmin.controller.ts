import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User, UserRole } from '../models/user.model';
import { Hospital } from '../models/hospital.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { Review } from '../models/review.model';
import { AuthRequest } from '../middlewares/auth.middleware';

export const onboardHospital = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    const { certification, services, name, address } = req.body;

    if (!hospitalId) return res.status(400).json({ message: 'Hospital ID not found in session' });

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    if (name) hospital.name = name;
    if (address) hospital.address = address;
    hospital.certification = certification;
    hospital.services = services;
    hospital.isOnboarded = true;
    await hospital.save();

    res.json({ message: 'Hospital onboarding completed', hospital });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getHospitalDoctors = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'Hospital ID not found' });

    const doctors = await User.find({
      role: UserRole.DOCTOR,
      $or: [
        { hospitalId: hospitalId as any },
        { hospitalIds: { $in: [hospitalId] } }
      ]
    }).lean();

    res.json(doctors);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Doctor approval moved to Super Admin exclusively.

export const getHospitalPatients = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'Hospital ID not found' });

    // Patients with fixed appointments at this hospital
    const appointments = await Appointment.find({
      hospitalId,
      status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] }
    })
    .populate('patientId', 'name email phone')
    .populate('doctorId', 'name specialization')
    .sort({ date: -1 });

    // Group by patient to avoid duplicates if they have multiple appointments
    const patients = Array.from(new Set(appointments.map(a => String(a.patientId?._id))))
      .map(pId => {
        const patientAppointments = appointments.filter(a => String(a.patientId?._id) === pId);
        const lastAppt: any = patientAppointments[0];
        return {
          _id: pId,
          name: lastAppt.patientId.name,
          email: lastAppt.patientId.email,
          phone: lastAppt.patientId.phone,
          doctorName: lastAppt.doctorId.name,
          doctorSpecialization: lastAppt.doctorId.specialization,
          lastVisit: lastAppt.date,
          status: lastAppt.status,
          appointmentId: lastAppt._id
        };
      });

    res.json(patients);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getHospitalUpcomingBookings = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'Hospital ID not found' });

    const appointments = await Appointment.find({
      hospitalId,
      status: AppointmentStatus.CONFIRMED,
      date: { $gte: new Date() }
    })
    .populate('patientId', 'name email')
    .populate('doctorId', 'name')
    .sort({ date: 1 });

    res.json(appointments);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getHospitalStats = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'Hospital ID not found' });

    const doctorCount = await User.countDocuments({
      role: UserRole.DOCTOR,
      $or: [{ hospitalId: hospitalId as any }, { hospitalIds: { $in: [hospitalId] } }]
    });

    const appointmentStats = await Appointment.aggregate([
      { $match: { hospitalId: new mongoose.Types.ObjectId(String(hospitalId)) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const totalPatients = await Appointment.distinct('patientId', { hospitalId });

    res.json({
      doctors: doctorCount,
      patients: totalPatients.length,
      appointments: appointmentStats.reduce((acc: any, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { pending: 0, confirmed: 0, completed: 0, cancelled: 0, declined: 0 })
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getDoctorStats = async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user?._id;
    
    const appointmentStats = await Appointment.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(String(doctorId)) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const ratingStats = await Review.aggregate([
      { $match: { targetId: new mongoose.Types.ObjectId(String(doctorId)), targetType: 'doctor' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } }
    ]);

    res.json({
      appointments: appointmentStats.reduce((acc: any, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { pending: 0, confirmed: 0, completed: 0, cancelled: 0, declined: 0 }),
      ratings: ratingStats.reduce((acc: any, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
