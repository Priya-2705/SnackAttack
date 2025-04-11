import express from 'express';
import auth from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import Review from '../models/Review.js';
import Recipe from '../models/Recipe.js';
import mongoose from 'mongoose';

const router = express.Router();

// Submit review (fixed version)
router.post('/', auth, asyncHandler(async (req, res) => {
  const { recipeId, rating, comment } = req.body;

  // Validate recipe exists
  const recipe = await Recipe.findById(recipeId);
  if (!recipe) {
    return res.status(404).json({ msg: 'Recipe not found' });
  }

  // Create review
  const review = new Review({
    user: req.user.id,
    recipe: recipeId,
    rating,
    comment
  });

  await review.save();
  
  // Recalculate average rating
  const reviews = await Review.find({ recipe: recipeId });
  const totalRating = reviews.reduce((acc, item) => item.rating + acc, 0);
  recipe.rating = totalRating / reviews.length;
  
  await recipe.save();
  res.status(201).json(review);
}));

// Get reviews for a recipe
router.get('/recipe/:id', asyncHandler(async (req, res) => {
    // Validate recipe ID format first
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ msg: 'Invalid recipe ID' });
    }
  
    const reviews = await Review.find({ recipe: req.params.id })
      .populate('user', 'username')
      .select('-__v');
  
    res.json(reviews);
  }));

// Delete review (owner or admin)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ msg: 'Review not found' });
    }
  
    // Check ownership
    if (req.user.role !== 'admin' && review.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
  
    await review.deleteOne();
    res.json({ msg: 'Review deleted' });
  }));
 
// Update review
router.put('/:id', auth, asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ msg: 'Review not found' });
    }
  
    // Verify ownership
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }
  
    // Validate rating
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ msg: 'Rating must be between 1-5' });
    }
  
    // Update fields
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    
    await review.save();
    
    // Update recipe rating
    const recipe = await Recipe.findById(review.recipe);
    const reviews = await Review.find({ recipe: review.recipe });
    recipe.rating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    await recipe.save();
  
    res.json(review);
  }));
  
export default router;