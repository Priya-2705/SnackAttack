import express from 'express';
import auth from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

const router = express.Router();

// Get all users (Admin only)
router.get('/', auth, admin, asyncHandler(async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
}));

// Delete user (Admin only)
router.delete('/:id', auth, admin, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ msg: 'User not found' });

  await user.deleteOne();
  res.json({ msg: 'User removed' });
}));

// Update user role (Admin only) - CORRECTED ROUTE
router.patch('/:id/role', auth, admin, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
  
    user.role = req.body.role;
    await user.save();
  
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  }));  

export default router;