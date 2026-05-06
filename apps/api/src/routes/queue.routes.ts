import express from 'express';
import { getQueueStatus, callNextPatient } from '../controllers/queue.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.get('/status', protect, getQueueStatus);
router.post('/call-next', protect, authorize(UserRole.DOCTOR), callNextPatient);

export default router;
