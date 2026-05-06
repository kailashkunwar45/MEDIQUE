import express from 'express';
import { getMe, updateMe } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

export default router;

