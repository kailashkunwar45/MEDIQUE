import express from 'express';
import { listHospitals, listHospitalDoctors } from '../controllers/hospital.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/', protect, listHospitals);
router.get('/:hospitalId/doctors', protect, listHospitalDoctors);

export default router;

