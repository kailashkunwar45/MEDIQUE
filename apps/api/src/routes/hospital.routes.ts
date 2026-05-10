import express from 'express';
import { listHospitals, listHospitalDoctors, getHospitalById, rateHospital, getHospitalReviews } from '../controllers/hospital.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.get('/', listHospitals);
router.get('/:hospitalId', getHospitalById);
router.get('/:hospitalId/doctors', listHospitalDoctors);
router.post('/:hospitalId/reviews', protect, authorize(UserRole.PATIENT), rateHospital);
router.get('/:hospitalId/reviews', getHospitalReviews);

export default router;
