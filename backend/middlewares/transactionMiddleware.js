const { body, query, param } = require("express-validator");
const Transaction = require("../models/Transaction");
const Category = require("../models/Category");

// Validation middleware for creating transactions
const validateCreateTransaction = [
  body("amount")
    .isFloat({ min: 0.01, max: 999999999 })
    .withMessage("Amount must be a positive number and less than 1 billion"),
  body("type")
    .isIn(["income", "expense"])
    .withMessage("Type must be either income or expense"),
  body("category").isMongoId().withMessage("Valid category ID is required"),
  body("description")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage(
      "Description is required and must be less than 500 characters"
    ),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date")
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const oneYearAgo = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate()
      );
      const oneYearFromNow = new Date(
        now.getFullYear() + 1,
        now.getMonth(),
        now.getDate()
      );

      if (date < oneYearAgo || date > oneYearFromNow) {
        throw new Error("Date must be within one year of today");
      }
      return true;
    }),
  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Tags must be an array with maximum 10 items"),
  body("tags.*")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be a string with 1-50 characters"),
  body("location")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Location must be less than 200 characters"),
  body("receipt").optional().isURL().withMessage("Receipt must be a valid URL"),
];

// Validation middleware for updating transactions
const validateUpdateTransaction = [
  body("amount")
    .optional()
    .isFloat({ min: 0.01, max: 999999999 })
    .withMessage("Amount must be a positive number and less than 1 billion"),
  body("type")
    .optional()
    .isIn(["income", "expense"])
    .withMessage("Type must be either income or expense"),
  body("category")
    .optional()
    .isMongoId()
    .withMessage("Valid category ID is required"),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage(
      "Description cannot be empty and must be less than 500 characters"
    ),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date")
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const oneYearAgo = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate()
      );
      const oneYearFromNow = new Date(
        now.getFullYear() + 1,
        now.getMonth(),
        now.getDate()
      );

      if (date < oneYearAgo || date > oneYearFromNow) {
        throw new Error("Date must be within one year of today");
      }
      return true;
    }),
  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Tags must be an array with maximum 10 items"),
  body("tags.*")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be a string with 1-50 characters"),
  body("location")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Location must be less than 200 characters"),
  body("receipt").optional().isURL().withMessage("Receipt must be a valid URL"),
];

// Validation middleware for transaction query parameters
const validateTransactionQuery = [
  query("page")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Page must be between 1 and 1000"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("type")
    .optional()
    .isIn(["income", "expense"])
    .withMessage("Type must be income or expense"),
  query("category")
    .optional()
    .isMongoId()
    .withMessage("Category must be a valid ID"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be valid"),
  query("endDate").optional().isISO8601().withMessage("End date must be valid"),
  query("minAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum amount must be a positive number"),
  query("maxAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum amount must be a positive number"),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be 1-100 characters"),
  query("sortBy")
    .optional()
    .isIn(["date", "amount", "type", "description", "createdAt"])
    .withMessage("Invalid sortBy parameter"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
];

// Validation middleware for transaction ID parameter
const validateTransactionId = [
  param("id").isMongoId().withMessage("Invalid transaction ID"),
];

// Validation middleware for summary query
const validateSummaryQuery = [
  query("period")
    .optional()
    .isIn(["week", "month", "year"])
    .withMessage("Period must be week, month, or year"),
];

// Validation middleware for export query
const validateExportQuery = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be valid"),
  query("endDate").optional().isISO8601().withMessage("End date must be valid"),
  query("format")
    .optional()
    .isIn(["csv", "json"])
    .withMessage("Format must be csv or json"),
];

// Validation middleware for bulk transactions
const validateBulkTransactions = [
  body("transactions")
    .isArray({ min: 1, max: 100 })
    .withMessage("Transactions must be an array with 1-100 items"),
  body("transactions.*.amount")
    .isFloat({ min: 0.01, max: 999999999 })
    .withMessage("Each transaction amount must be a positive number"),
  body("transactions.*.type")
    .isIn(["income", "expense"])
    .withMessage("Each transaction type must be income or expense"),
  body("transactions.*.category")
    .isMongoId()
    .withMessage("Each transaction must have a valid category ID"),
  body("transactions.*.description")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage(
      "Each transaction description is required and must be less than 500 characters"
    ),
  body("transactions.*.date")
    .optional()
    .isISO8601()
    .withMessage("Each transaction date must be valid"),
];

// Validation middleware for trends query
const validateTrendsQuery = [
  query("period")
    .optional()
    .isIn(["week", "month", "year"])
    .withMessage("Period must be week, month, or year"),
  query("type")
    .optional()
    .isIn(["income", "expense"])
    .withMessage("Type must be income or expense"),
];

// Middleware to check if transaction exists and belongs to user
const checkTransactionOwnership = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Transaction belongs to another user",
      });
    }

    req.transaction = transaction;
    next();
  } catch (error) {
    console.error("Check transaction ownership error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Middleware to validate category ownership
const validateCategoryOwnership = async (req, res, next) => {
  try {
    const categoryId = req.body.category;

    if (!categoryId) {
      return next();
    }

    const category = await Category.findOne({
      _id: categoryId,
      $or: [{ userId: req.user.id }, { isDefault: true }],
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or access denied",
      });
    }

    req.category = category;
    next();
  } catch (error) {
    console.error("Validate category ownership error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  validateCreateTransaction,
  validateUpdateTransaction,
  validateTransactionQuery,
  validateTransactionId,
  validateSummaryQuery,
  validateExportQuery,
  validateBulkTransactions,
  validateTrendsQuery,
  checkTransactionOwnership,
  validateCategoryOwnership,
};
