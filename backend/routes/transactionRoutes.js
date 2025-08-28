const express = require("express");
const { body } = require("express-validator");
const Transaction = require("../models/Transaction");
const Category = require("../models/Category");

// @route   POST /api/transactions
// @desc    Create a new transaction
// @access  Private
const transactionController = require("../controllers/transactionController");
const transactionMiddleware = require("../middlewares/transactionMiddleware");

const router = express.Router();

// Validation arrays
const createTransactionValidation = [
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be a positive number"),
  body("type")
    .isIn(["income", "expense"])
    .withMessage("Type must be either income or expense"),
  body("category").isMongoId().withMessage("Valid category ID is required"),
  body("description")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Description is required"),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date"),
];

const updateTransactionValidation = [
  body("amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be a positive number"),
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
    .isLength({ min: 1 })
    .withMessage("Description cannot be empty"),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date"),
];

// @route   POST /api/transactions
router.post(
  "/",
  transactionMiddleware,
  createTransactionValidation,
  (req, res, next) =>
    transactionController.createTransaction(req, res, next, {
      Transaction,
      Category,
    })
);

// @route   GET /api/transactions
router.get("/", transactionMiddleware, (req, res, next) =>
  transactionController.getTransactions(req, res, next, {
    Transaction,
    Category,
  })
);

// @route   GET /api/transactions/:id
router.get("/:id", transactionMiddleware, (req, res, next) =>
  transactionController.getTransaction(req, res, next, {
    Transaction,
    Category,
  })
);

// @route   PUT /api/transactions/:id
router.put(
  "/:id",
  transactionMiddleware,
  updateTransactionValidation,
  (req, res, next) =>
    transactionController.updateTransaction(req, res, next, {
      Transaction,
      Category,
    })
);

// @route   DELETE /api/transactions/:id
router.delete("/:id", transactionMiddleware, (req, res, next) =>
  transactionController.deleteTransaction(req, res, next, {
    Transaction,
    Category,
  })
);

// @route   GET /api/transactions/summary
router.get("/summary", transactionMiddleware, (req, res, next) =>
  transactionController.getSummary(req, res, next, { Transaction, Category })
);

// @route   POST /api/transactions/bulk
router.post("/bulk", transactionMiddleware, (req, res, next) =>
  transactionController.bulkCreateTransactions(req, res, next, {
    Transaction,
    Category,
  })
);

// @route   GET /api/transactions/export
router.get("/export", transactionMiddleware, (req, res, next) =>
  transactionController.exportTransactions(req, res, next, {
    Transaction,
    Category,
  })
);

module.exports = router;