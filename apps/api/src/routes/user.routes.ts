import express from 'express';
import { getMe, updateMe, getDoctorProfile, listAllDoctors, onboardDoctor } from '../controllers/user.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.post('/onboard', protect, authorize(UserRole.DOCTOR), onboardDoctor);
router.get('/doctors', listAllDoctors); // public, lists all approved doctors
router.get('/doctors/:id', getDoctorProfile); // public

export default router;
