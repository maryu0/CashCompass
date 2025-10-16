const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const asyncHandler = require("express-async-handler");

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private
const createCategory = asyncHandler(async (req, res) => {
  const { name, type, icon, color, description } = req.body;

  // Check if category with same name already exists for this user
  const existingCategory = await Category.findOne({
    user: req.user._id,
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  if (existingCategory) {
    res.status(400);
    throw new Error("Category with this name already exists");
  }

  const category = await Category.create({
    user: req.user._id,
    name,
    type,
    icon,
    color,
    description,
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

// @desc    Get all categories for authenticated user
// @route   GET /api/categories
// @access  Private
const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ user: req.user._id }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

// @desc    Get categories by type
// @route   GET /api/categories/type/:type
// @access  Private
const getCategoriesByType = asyncHandler(async (req, res) => {
  const { type } = req.params;

  if (!["income", "expense"].includes(type)) {
    res.status(400);
    throw new Error('Invalid category type. Must be "income" or "expense"');
  }

  const categories = await Category.find({
    user: req.user._id,
    type,
  }).sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

// @desc    Get single category by ID
// @route   GET /api/categories/:id
// @access  Private
const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Verify ownership
  if (category.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to access this category");
  }

  res.status(200).json({
    success: true,
    data: category,
  });
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = asyncHandler(async (req, res) => {
  let category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Verify ownership
  if (category.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to update this category");
  }

  // If name is being updated, check for duplicates
  if (req.body.name && req.body.name !== category.name) {
    const existingCategory = await Category.findOne({
      user: req.user._id,
      name: { $regex: new RegExp(`^${req.body.name}$`, "i") },
      _id: { $ne: req.params.id },
    });

    if (existingCategory) {
      res.status(400);
      throw new Error("Category with this name already exists");
    }
  }

  // Update category
  category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: category,
  });
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Verify ownership
  if (category.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to delete this category");
  }

  // Check if category is being used in any transactions
  const transactionCount = await Transaction.countDocuments({
    category: req.params.id,
  });

  if (transactionCount > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete category. It is being used in ${transactionCount} transaction(s)`
    );
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
    data: {},
  });
});

module.exports = {
  createCategory,
  getAllCategories,
  getCategoriesByType,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
