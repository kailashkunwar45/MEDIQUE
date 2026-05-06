import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { User } from '../models/user.model';

export const getMe = async (req: AuthRequest, res: Response) => {
  res.json(req.user);
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { name, phone } = req.body;

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        ...(typeof name === 'string' ? { name } : {}),
        ...(typeof phone === 'string' ? { phone } : {}),
      },
      { new: true }
    ).select('-password');

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

