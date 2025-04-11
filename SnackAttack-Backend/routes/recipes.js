import express from 'express';
import auth from '../middleware/auth.js';
import Recipe from '../models/Recipe.js';
import asyncHandler from 'express-async-handler';
import { generateRecipePDF } from '../utils/pdfGenerator.js';

const router = express.Router();

// --- CRUD Operations ---
// Create Recipe
router.post('/', auth, asyncHandler(async (req, res) => {
  const { title, ingredients, directions, category, nutritionalInfo } = req.body;
  
  const newRecipe = new Recipe({
    title,
    ingredients,
    directions,
    category,
    nutritionalInfo: {
      calories: nutritionalInfo?.calories || 0,
      protein: nutritionalInfo?.protein || 0,
      carbs: nutritionalInfo?.carbs || 0,
      fat: nutritionalInfo?.fat || 0
    },
    createdBy: req.user.id
  });

  const savedRecipe = await newRecipe.save();
  res.status(201).json(savedRecipe);
}));

// Get All Recipes with Search/Filters
router.get('/', asyncHandler(async (req, res) => {
  const { 
    search, 
    category, 
    state,
    minCalories, 
    maxCalories,
    page = 1, 
    limit = 10, 
    sort = '-createdAt'
  } = req.query;

  const query = {};

  // Search
  if (search) {
    const searchTerms = search.split(' ');
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { ingredients: { $in: searchTerms.map(term => new RegExp(term, 'i')) } }
    ];
  }

  // Filters
  if (category) query.category = category;
  if (state) query.state = state;
  if (minCalories || maxCalories) {
    query['nutritionalInfo.calories'] = {};
    if (minCalories) query['nutritionalInfo.calories'].$gte = Number(minCalories);
    if (maxCalories) query['nutritionalInfo.calories'].$lte = Number(maxCalories);
  }

  const recipes = await Recipe.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('createdBy', 'username')
    .select('title ingredients directions category nutritionalInfo createdAt');

  const total = await Recipe.countDocuments(query);
  res.json({ total, page: parseInt(page), limit: parseInt(limit), recipes });
}));

// Update Recipe
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) return res.status(404).json({ msg: 'Recipe not found' });

  if (req.user.role !== 'admin' && recipe.createdBy.toString() !== req.user.id) {
    return res.status(403).json({ msg: 'Not authorized' });
  }

  const updatedRecipe = await Recipe.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  res.json(updatedRecipe);
}));

// Delete Recipe
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) return res.status(404).json({ msg: 'Recipe not found' });

  if (req.user.role !== 'admin' && recipe.createdBy.toString() !== req.user.id) {
    return res.status(403).json({ msg: 'Not authorized' });
  }

  await recipe.deleteOne();
  res.json({ msg: 'Recipe removed' });
}));






export default router;