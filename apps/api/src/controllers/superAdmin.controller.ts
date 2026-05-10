import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User, UserRole } from '../models/user.model';
import { Hospital } from '../models/hospital.model';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getPendingHospitals = async (req: AuthRequest, res: Response) => {
  try {
    const hospitals = await Hospital.find({ isApprovedBySuperAdmin: false }).lean();
    res.json(hospitals);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getApprovedHospitals = async (req: AuthRequest, res: Response) => {
  try {
    const hospitals = await Hospital.find({ isApprovedBySuperAdmin: true }).lean();
    res.json(hospitals);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveHospital = async (req: AuthRequest, res: Response) => {
  try {
    const { hospitalId, status } = req.body; // status: 'approved' | 'rejected'
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    if (status === 'approved') {
      hospital.isApprovedBySuperAdmin = true;
      hospital.isActive = true;
      
      // Also approve the admin user associated with this hospital
      await User.updateMany(
        { hospitalId: hospital._id, role: UserRole.HOSPITAL_ADMIN },
        { isApprovedBySuperAdmin: true }
      );
    } else {
      hospital.isActive = false;
    }
    
    await hospital.save();
    res.json({ message: `Hospital ${status} successfully` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPendingDoctorsGlobal = async (req: AuthRequest, res: Response) => {
  try {
    const doctors = await User.find({
      role: UserRole.DOCTOR,
      isApprovedBySuperAdmin: false,
      isOnboarded: true
    }).populate('hospitalIds', 'name').lean();
    res.json(doctors);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getApprovedDoctorsGlobal = async (req: AuthRequest, res: Response) => {
  try {
    const doctors = await User.find({
      role: UserRole.DOCTOR,
      isApprovedBySuperAdmin: true
    }).populate('hospitalIds', 'name').lean();
    res.json(doctors);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveDoctorGlobal = async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId, status } = req.body;
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    if (status === 'approved') {
      doctor.isApprovedBySuperAdmin = true;
    } else {
      // Logic for rejection
    }

    await doctor.save();
    res.json({ message: `Doctor ${status} globally` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const removeDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.params;
    await User.findOneAndDelete({ _id: doctorId, role: UserRole.DOCTOR });
    res.json({ message: 'Doctor removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const removeHospital = async (req: AuthRequest, res: Response) => {
  try {
    const { hospitalId } = req.params;
    await Hospital.findByIdAndDelete(hospitalId);
    // Optionally deactivate all admins/doctors linked to this hospital
    await User.updateMany({ hospitalId }, { isActive: false });
    res.json({ message: 'Hospital removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const banUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, isBanned, reason } = req.body;
    await User.findByIdAndUpdate(userId, { isBanned, banReason: reason });
    res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'} successfully` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const banHospital = async (req: AuthRequest, res: Response) => {
  try {
    const { hospitalId, isBanned, reason } = req.body;
    await Hospital.findByIdAndUpdate(hospitalId, { isBanned, banReason: reason });
    res.json({ message: `Hospital ${isBanned ? 'banned' : 'unbanned'} successfully` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelAppointmentGlobal = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId, reason } = req.body;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancelReason = reason || 'Cancelled by System Administrator';
    await appointment.save();

    res.json({ message: 'Appointment cancelled globally' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getGlobalStats = async (req: AuthRequest, res: Response) => {
  try {
    const hospitalCount = await Hospital.countDocuments();
    const doctorCount = await User.countDocuments({ role: UserRole.DOCTOR });
    const patientCount = await User.countDocuments({ role: UserRole.PATIENT });
    const totalAppointments = await Appointment.countDocuments();

    const appointmentMix = await Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      hospitals: hospitalCount,
      doctors: doctorCount,
      patients: patientCount,
      appointments: {
        total: totalAppointments,
        mix: appointmentMix.reduce((acc: any, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
