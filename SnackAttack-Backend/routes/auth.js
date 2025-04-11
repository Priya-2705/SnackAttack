import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user
router.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  let user = await User.findOne({ email });
  if (user) {
    return res.status(400).json({ msg: 'User already exists' });
  }

  user = new User({ username, email, password });
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);
  await user.save();

  const payload = { id: user.id };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

  res.json({ token });
}));

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ msg: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ msg: 'Invalid credentials' });
  }

  const payload = { id: user.id };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

  res.json({ token });
}));

// Temporary admin creation route (remove after first admin is created)
router.post('/register-admin', asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({ msg: 'Admin already exists' });
    }
  
    // Create admin user
    const adminUser = new User({
      username,
      email,
      password,
      role: 'admin'
    });
  
    // Hash password
    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(password, salt);
  
    await adminUser.save();
    
    res.status(201).json({
      _id: adminUser._id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role
    });
  }));
  
export default router;