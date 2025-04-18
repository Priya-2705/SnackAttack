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

// --- Special Features ---
// Trending Recipes
router.get('/trending', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  const trendingRecipes = await Recipe.aggregate([
    {
      $lookup: {
        from: 'favorites',
        localField: '_id',
        foreignField: 'recipe',
        as: 'favorites'
      }
    },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'recipe',
        as: 'reviews'
      }
    },
    {
      $addFields: {
        favoritesCount: { $size: "$favorites" },
        reviewsCount: { $size: "$reviews" },
        avgRating: { $ifNull: [{ $avg: "$reviews.rating" }, 0] }
      }
    },
    {
      $addFields: {
        popularityScore: {
          $round: [
            {
              $add: [
                { $multiply: ["$favoritesCount", 0.3] },
                { $multiply: ["$reviewsCount", 0.2] },
                { $multiply: ["$avgRating", 0.5] }
              ]
            },
            2
          ]
        }
      }
    },
    { $sort: { popularityScore: -1 } },
    { $limit: limit }
  ]);

  res.json(trendingRecipes);
}));

// Calorie Calculator
router.post('/calculate-calories', asyncHandler(async (req, res) => {
  const { recipeIds } = req.body;
  if (!recipeIds?.length) return res.status(400).json({ msg: 'Invalid recipe IDs' });

  const recipes = await Recipe.find({ _id: { $in: recipeIds } })
    .select('title nutritionalInfo');

  const total = recipes.reduce((sum, recipe) => sum + (recipe.nutritionalInfo?.calories || 0), 0);
  
  res.json({
    totalCalories: total,
    mealCount: recipes.length,
    breakdown: recipes.map(r => ({
      title: r.title,
      calories: r.nutritionalInfo?.calories || 0
    }))
  });
}));

// Render Calorie Calculator page (GET)
router.get('/calorie-calculator', (req, res) => {
  res.render('pages/calorie-calculator');
});
// Download Recipes
router.get('/:id/download/pdf', asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) return res.status(404).json({ msg: 'Recipe not found' });

  const doc = generateRecipePDF(recipe);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${recipe.title}.pdf"`);
  doc.pipe(res);
  doc.end();
}));

router.get('/:id/download/text', asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) return res.status(404).json({ msg: 'Recipe not found' });

  const text = [
    recipe.title,
    '\n\nINGREDIENTS:',
    ...recipe.ingredients.map(i => `• ${i}`),
    '\n\nDIRECTIONS:',
    ...recipe.directions.map((d, i) => `${i+1}. ${d}`),
    `\n\nCALORIES: ${recipe.nutritionalInfo?.calories || 'N/A'}`
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${recipe.title}.txt"`);
  res.send(text);
}));

export default router;