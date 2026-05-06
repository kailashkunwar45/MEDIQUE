import express from 'express';
import { getAppointmentMessages } from '../controllers/chat.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/:appointmentId/messages', protect, getAppointmentMessages);

export default router;

