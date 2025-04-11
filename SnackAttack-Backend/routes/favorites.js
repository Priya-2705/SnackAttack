import express from 'express';
import auth from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import Favorite from '../models/Favorite.js';

const router = express.Router();

// Add to favorites
router.post('/', auth, asyncHandler(async (req, res) => {
  const { recipeId } = req.body;
  
  const favorite = new Favorite({
    user: req.user.id,
    recipe: recipeId
  });

  await favorite.save();
  res.status(201).json(favorite);
}));

// Get user favorites
router.get('/', auth, asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ user: req.user.id })
    .populate('recipe', 'title category');
  
  res.json(favorites);
}));

// Remove from favorites
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const favorite = await Favorite.findById(req.params.id);
  if (!favorite) return res.status(404).json({ msg: 'Favorite not found' });

  if (favorite.user.toString() !== req.user.id) {
    return res.status(401).json({ msg: 'Not authorized' });
  }

  await favorite.deleteOne();
  res.json({ msg: 'Removed from favorites' });
}));

export default router;