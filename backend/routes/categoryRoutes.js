const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { auth } = require("../middlewares/authMiddleware");
const { validateCategory } = require("../middlewares/validationMiddleware");

// Apply authentication middleware to all routes
router.use(auth);

// @route   POST /api/categories
// @desc    Create a new category
// @access  Private
router.post("/", validateCategory, categoryController.createCategory);

// @route   GET /api/categories
// @desc    Get all categories for the authenticated user
// @access  Private
router.get("/", categoryController.getAllCategories);

// @route   GET /api/categories/type/:type
// @desc    Get categories by type (income/expense)
// @access  Private
router.get("/type/:type", categoryController.getCategoriesByType);

// @route   GET /api/categories/:id
// @desc    Get a single category by ID
// @access  Private
router.get("/:id", categoryController.getCategoryById);

// @route   PUT /api/categories/:id
// @desc    Update a category
// @access  Private
router.put("/:id", validateCategory, categoryController.updateCategory);

// @route   DELETE /api/categories/:id
// @desc    Delete a category
// @access  Private
router.delete("/:id", categoryController.deleteCategory);

module.exports = router;
