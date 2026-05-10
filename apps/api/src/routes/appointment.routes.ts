import express from 'express';
import {
  acceptAppointment,
  bookAppointment,
  cancelAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  completeAppointment,
  declineAppointment,
  changeAppointmentHospital,
  getAppointmentById,
} from '../controllers/appointment.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.post('/', protect, authorize(UserRole.PATIENT), bookAppointment);
router.get('/my', protect, authorize(UserRole.PATIENT), getPatientAppointments);
router.post('/cancel', protect, authorize(UserRole.PATIENT), cancelAppointment);
router.get('/doctor', protect, authorize(UserRole.DOCTOR), getDoctorAppointments);
router.post('/accept', protect, authorize(UserRole.DOCTOR), acceptAppointment);
router.post('/complete', protect, authorize(UserRole.DOCTOR), completeAppointment);
router.post('/decline', protect, authorize(UserRole.DOCTOR), declineAppointment);
router.put('/change-hospital', protect, authorize(UserRole.DOCTOR), changeAppointmentHospital);
router.get('/:id', protect, getAppointmentById);

export default router;
