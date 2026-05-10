import express from 'express';
import {
  requestChat,
  respondToChatRequest,
  reconnectWithPatient,
  getPendingChatRequests,
  getChatConnectionStatus,
  getMessages
} from '../controllers/chat.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = express.Router();

router.use(protect);

router.post('/request', authorize(UserRole.PATIENT), requestChat);
router.post('/respond', authorize(UserRole.DOCTOR), respondToChatRequest);
router.post('/reconnect', authorize(UserRole.DOCTOR), reconnectWithPatient);
router.get('/pending-requests', authorize(UserRole.DOCTOR), getPendingChatRequests);
router.get('/status', getChatConnectionStatus);
router.get('/conversations', getConversations);
router.post('/mark-read', markAsRead);
router.get('/:appointmentId/messages', getMessages);

export default router;
