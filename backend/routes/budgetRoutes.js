const express = require("express");
const { body } = require("express-validator");
const Budget = require("../models/Budget");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const { auth } = require("../middlewares/authMiddleware");
const budgetController = require("../controllers/budgetController");

// @route   POST /api/budgets
// @desc    Create a new budget
// @access  Private

const router = express.Router();

// Validation arrays
const createBudgetValidation = [
  body("name")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Budget name is required"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Budget amount must be a positive number"),
  body("category")
    .optional()
    .isMongoId()
    .withMessage("Valid category ID is required"),
  body("period")
    .isIn(["weekly", "monthly", "yearly"])
    .withMessage("Period must be weekly, monthly, or yearly"),
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("endDate").isISO8601().withMessage("Valid end date is required"),
];

const updateBudgetValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Budget name cannot be empty"),
  body("amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Budget amount must be a positive number"),
  body("category")
    .optional()
    .isMongoId()
    .withMessage("Valid category ID is required"),
  body("period")
    .optional()
    .isIn(["weekly", "monthly", "yearly"])
    .withMessage("Period must be weekly, monthly, or yearly"),
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Valid start date is required"),
  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("Valid end date is required"),
];

// @route   POST /api/budgets
router.post("/", auth, createBudgetValidation, (req, res, next) =>
  budgetController.createBudget(req, res, next, {
    Budget,
    Category,
    Transaction,
  })
);

// @route   GET /api/budgets
router.get("/", auth, (req, res, next) =>
  budgetController.getBudgets(req, res, next, { Budget, Category, Transaction })
);

// @route   GET /api/budgets/:id
router.get("/:id", auth, (req, res, next) =>
  budgetController.getBudget(req, res, next, { Budget, Category, Transaction })
);

// @route   PUT /api/budgets/:id
router.put("/:id", auth, updateBudgetValidation, (req, res, next) =>
  budgetController.updateBudget(req, res, next, {
    Budget,
    Category,
    Transaction,
  })
);

// @route   DELETE /api/budgets/:id
router.delete("/:id", auth, (req, res, next) =>
  budgetController.deleteBudget(req, res, next, {
    Budget,
    Category,
    Transaction,
  })
);

// @route   GET /api/budgets/analytics/overview
router.get("/analytics/overview", auth, (req, res, next) =>
  budgetController.getBudgetAnalyticsOverview(req, res, next, {
    Budget,
    Category,
    Transaction,
  })
);

// @route   POST /api/budgets/:id/duplicate
router.post("/:id/duplicate", auth, (req, res, next) =>
  budgetController.duplicateBudget(req, res, next, {
    Budget,
    Category,
    Transaction,
  })
);

module.exports = router;
