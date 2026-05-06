import express from 'express';
import { getHospitalStats, getPlatformStats } from '../controllers/analytics.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { cacheMiddleware } from '../middlewares/cache.middleware';

const router = express.Router();

router.get('/hospital', protect, authorize(UserRole.HOSPITAL_ADMIN), cacheMiddleware(300), getHospitalStats);
router.get('/platform', protect, authorize(UserRole.SUPER_ADMIN), cacheMiddleware(300), getPlatformStats);

export default router;
