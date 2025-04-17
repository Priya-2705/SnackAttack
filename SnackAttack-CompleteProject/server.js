import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';

import connectDB from './config/db.js';

// Models
import Recipe from './models/Recipe.js';
import Favorite from './models/Favorite.js';
import User from './models/User.js';
import Review from './models/Review.js';


// Routes
import authRoutes from './routes/auth.js';
import recipeRoutes from './routes/recipes.js';
import userRoutes from './routes/users.js';
import favoriteRoutes from './routes/favorites.js';
import reviewRoutes from './routes/reviews.js';

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// EJS & Static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// 🔐 JWT Middleware: Set req.user if token exists
app.use(async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
  } catch (err) {
    req.user = null;
  }

  next();
});

// 🔒 Protect route helper
const requireLogin = (req, res, next) => {
  if (!req.user) return res.redirect('/login');
  next();
};

// =======================
// 📄 View Routes (EJS)
// =======================

app.get('/', async (req, res) => {
  const trendingRecipes = await Recipe.aggregate([
    {
      $lookup: {
        from: 'favorites',
        localField: '_id',
        foreignField: 'recipe',
        as: 'favorites',
      },
    },
    {
      $addFields: {
        favoritesCount: { $size: '$favorites' },
      },
    },
    { $sort: { favoritesCount: -1 } },
    { $limit: 6 },
  ]);

  res.render('pages/home', { trendingRecipes, user: req.user });
});

app.get('/login', (req, res) => res.render('pages/login', { user: req.user }));
app.get('/register', (req, res) => res.render('pages/register', { user: req.user }));

app.get('/dashboard', requireLogin, (req, res) => {
  res.render('pages/dashboard', { user: req.user });
});

app.get('/recipes', requireLogin, async (req, res) => {
  const { search, category, state, minCalories, maxCalories } = req.query;
  const page = parseInt(req.query.page) || 1; // Current page (default: 1)
  const limit = 10; // Recipes per page
  const skip = (page - 1) * limit;

  try {
    // Build the query object based on filters
    const query = {};

    if (search) {
      const searchTerms = search.split(' ');
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { ingredients: { $in: searchTerms.map(term => new RegExp(term, 'i')) } }
      ];
    }

    if (category) query.category = category;
    if (state) query.state = state;

    if (minCalories || maxCalories) {
      query['nutritionalInfo.calories'] = {};
      if (minCalories) query['nutritionalInfo.calories'].$gte = Number(minCalories);
      if (maxCalories) query['nutritionalInfo.calories'].$lte = Number(maxCalories);
    }

    // Get total number of recipes matching the query
    const totalRecipes = await Recipe.countDocuments(query);

    // Calculate total pages
    const totalPages = Math.ceil(totalRecipes / limit);

    // Fetch recipes for the current page
    const recipes = await Recipe.find(query).skip(skip).limit(limit);

    // Render the recipes page with pagination data
    res.render('pages/recipes', {
      recipes,
      user: req.user,
      totalPages,
      currentPage: page,
      query: req.query // Pass query parameters to retain filters in pagination links
    });
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).render('pages/404', { user: req.user });
  }
});

app.get('/recipes/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).render('pages/404', { user: req.user });

    const reviews = await Review.find({ recipe: recipe._id }).populate('user', 'username');

    res.render('pages/recipe-detail', {
      recipe,
      reviews,
      user: req.user
    });
  } catch (err) {
    res.status(500).render('pages/404', { user: req.user });
  }
});




app.get('/favorites', requireLogin,async (req, res) => {
  const favorites = await Favorite.find({ user: req.user._id }).populate('recipe');
  res.render('pages/favorites', { favorites, user: req.user });
});

app.post('/favorites', requireLogin, async (req, res) => {
  const { recipeId } = req.body;

  try {
    // Check if the recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ msg: 'Recipe not found' });
    }

    // Create a new favorite entry
    const favorite = new Favorite({
      user: req.user._id,
      recipe: recipeId,
    });

    await favorite.save();
    res.redirect('/favorites');
  } catch (err) {
    console.error('Error saving favorite:', err);
    res.status(500).render('pages/404', { user: req.user });
  }
});

app.delete('/favorites/:id', async (req, res) => {
  if (!req.user) return res.redirect('/login');

  try {
    await Favorite.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.redirect('/favorites');
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).render('pages/404', { user: req.user });
  }
});


app.get('/trending', async (req, res) => {
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
    { $limit: 10 }
  ]);

  res.render('pages/trending', { trendingRecipes, user: req.user });
});

app.get('/calorie-calculator', requireLogin, async (req, res) => {
  const recipes = await Recipe.find().select('title');
  res.render('pages/calorie-calculator', { user: req.user, recipes });
});





// 🔁 Logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// 🔎 Debug route (optional)
app.get('/whoami', (req, res) => {
  res.json({ user: req.user || 'Not logged in' });
});

// =======================
// 🔗 API Routes
// =======================
app.use('/auth', authRoutes); // For form-based login/register
app.use('/api/auth', authRoutes); // For API
app.use('/api/recipes', recipeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).render('pages/404', { user: req.user });
});

// =======================
// 🚀 Start Server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
