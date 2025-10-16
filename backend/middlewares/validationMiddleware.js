const { body, validationResult } = require("express-validator");

// Validation middleware for category creation/update
const validateCategory = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category name must be between 1 and 50 characters"),

  body("type")
    .optional()
    .isIn(["income", "expense"])
    .withMessage('Category type must be either "income" or "expense"'),

  body("icon")
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage("Icon must not exceed 10 characters"),

  body("color")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Color must be a valid hex code (e.g., #FF5733 or #F57)"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description must not exceed 200 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }
    next();
  },
];

// Validation for transaction creation/update
const validateTransaction = [
  body("type")
    .optional()
    .isIn(["income", "expense", "transfer"])
    .withMessage('Transaction type must be "income", "expense", or "transfer"'),

  body("amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be a positive number"),

  body("category").optional().isMongoId().withMessage("Invalid category ID"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),

  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be in valid ISO 8601 format"),

  body("paymentMethod")
    .optional()
    .isIn([
      "cash",
      "credit_card",
      "debit_card",
      "bank_transfer",
      "digital_wallet",
      "other",
    ])
    .withMessage("Invalid payment method"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Each tag must not exceed 30 characters"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }
    next();
  },
];

// Validation for budget creation/update
const validateBudget = [
  body("category").optional().isMongoId().withMessage("Invalid category ID"),

  body("amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Budget amount must be a positive number"),

  body("period")
    .optional()
    .isIn(["daily", "weekly", "monthly", "yearly"])
    .withMessage('Period must be "daily", "weekly", "monthly", or "yearly"'),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be in valid ISO 8601 format"),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be in valid ISO 8601 format"),

  body("alertThreshold")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Alert threshold must be between 0 and 100"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }
    next();
  },
];

module.exports = {
  validateCategory,
  validateTransaction,
  validateBudget,
};
