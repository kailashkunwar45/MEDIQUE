import express from 'express';
import { addReview, getDoctorReviews } from '../controllers/review.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.post('/', protect, authorize(UserRole.PATIENT), addReview);
router.get('/doctor/:doctorId', protect, getDoctorReviews);

export default router;

