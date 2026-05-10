import express from 'express';
import {
  onboardHospital,
  getHospitalDoctors,
  getHospitalPatients,
  getHospitalUpcomingBookings,
  getHospitalStats,
  getDoctorStats
} from '../controllers/hospitalAdmin.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

// General Stats (Doctor can see their own, Admin can see hospital's)
router.get('/doctor/stats', protect, authorize(UserRole.DOCTOR), getDoctorStats);

// Admin Only
router.post('/onboard', protect, authorize(UserRole.HOSPITAL_ADMIN), onboardHospital);
router.get('/doctors', protect, authorize(UserRole.HOSPITAL_ADMIN), getHospitalDoctors);
router.get('/patients', protect, authorize(UserRole.HOSPITAL_ADMIN), getHospitalPatients);
router.get('/upcoming', protect, authorize(UserRole.HOSPITAL_ADMIN), getHospitalUpcomingBookings);
router.get('/stats', protect, authorize(UserRole.HOSPITAL_ADMIN), getHospitalStats);

export default router;
