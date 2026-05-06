import express from 'express';
import { acceptAppointment, bookAppointment, cancelAppointment, getPatientAppointments } from '../controllers/appointment.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.post('/', protect, authorize(UserRole.PATIENT), bookAppointment);
router.get('/my', protect, authorize(UserRole.PATIENT), getPatientAppointments);
router.post('/cancel', protect, authorize(UserRole.PATIENT), cancelAppointment);
router.post('/accept', protect, authorize(UserRole.DOCTOR), acceptAppointment);

export default router;
