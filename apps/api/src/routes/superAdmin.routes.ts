import express from 'express';
import {
  getPendingHospitals,
  getApprovedHospitals,
  approveHospital,
  getPendingDoctorsGlobal,
  getApprovedDoctorsGlobal,
  approveDoctorGlobal,
  getGlobalStats,
  removeDoctor,
  removeHospital,
  banUser,
  banHospital,
  cancelAppointmentGlobal
} from '../controllers/superAdmin.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.use(protect, authorize(UserRole.SUPER_ADMIN));

router.get('/stats', getGlobalStats);

router.get('/hospitals/pending', getPendingHospitals);
router.get('/hospitals/approved', getApprovedHospitals);
router.post('/hospitals/approve', approveHospital);
router.delete('/hospitals/:hospitalId', removeHospital);
router.post('/hospitals/ban', banHospital);

router.get('/doctors/pending', getPendingDoctorsGlobal);
router.get('/doctors/approved', getApprovedDoctorsGlobal);
router.post('/doctors/approve', approveDoctorGlobal);
router.delete('/doctors/:doctorId', removeDoctor);
router.post('/doctors/ban', banUser);

router.post('/appointments/cancel', cancelAppointmentGlobal);

export default router;
