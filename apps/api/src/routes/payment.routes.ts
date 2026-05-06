import express from 'express';
import { initiateKhaltiPayment, verifyKhaltiPayment, initiateEsewaPayment, verifyEsewaPayment } from '../controllers/payment.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.post('/khalti/initiate', protect, authorize(UserRole.PATIENT), initiateKhaltiPayment);
router.post('/khalti/verify', protect, authorize(UserRole.PATIENT), verifyKhaltiPayment);
router.post('/esewa/initiate', protect, authorize(UserRole.PATIENT), initiateEsewaPayment);
router.post('/esewa/verify', protect, authorize(UserRole.PATIENT), verifyEsewaPayment);

export default router;
