import express from 'express';
import auth from '../middleware/auth.js';
import Recipe from '../models/Recipe.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();

// Create Recipe with Nutrition
router.post('/', auth, async (req, res) => {
    try {
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
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

// Get All Recipes with Nutrition
router.get('/', async (req, res) => {
    try {
      const recipes = await Recipe.find()
        .populate('createdBy', 'username')
        .select('title ingredients directions category nutritionalInfo');
        
      res.json(recipes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });  

// Delete Recipe (Admin OR Creator)
router.delete('/:id', auth, async (req, res) => {
    try {
      const recipe = await Recipe.findById(req.params.id);
      
      if (!recipe) {
        return res.status(404).json({ msg: 'Recipe not found' });
      }
  
      // Allow deletion if admin OR creator
      if (req.user.role !== 'admin' && recipe.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ msg: 'Not authorized' });
      }
  
      await recipe.deleteOne();
      res.json({ msg: 'Recipe removed' });
      
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

// Update Recipe (Owner or Admin)
router.put('/:id', auth, asyncHandler(async (req, res) => {
    const { title, ingredients, directions, category, nutritionalInfo } = req.body;
    
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }
  
    // Verify ownership/admin rights
    if (req.user.role !== 'admin' && recipe.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to update this recipe' });
    }
  
    const updatedRecipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      {
        title: title || recipe.title,
        ingredients: ingredients || recipe.ingredients,
        directions: directions || recipe.directions,
        category: category || recipe.category,
        nutritionalInfo: nutritionalInfo || recipe.nutritionalInfo
      },
      { new: true, runValidators: true }
    );
  
    res.json(updatedRecipe);
  }));

export default router;