const express = require("express");
const { body, validationResult, query } = require("express-validator");
const Transaction = require("../models/Transaction");
const Category = require("../models/Category");
// const auth = require("../middleware/auth");
const transactionMiddleware = require("../middlewares/transactionMiddleware");

const router = express.Router();

// @route   POST /api/transactions
// @desc    Create a new transaction
// @access  Private
router.post(
  "/",
  transactionMiddleware,
  [
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
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const {
        amount,
        type,
        category,
        description,
        date,
        tags,
        location,
        receipt,
      } = req.body;

      // Verify category exists and belongs to user
      const categoryDoc = await Category.findOne({
        _id: category,
        $or: [{ userId: req.user.id }, { isDefault: true }],
      });

      if (!categoryDoc) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      const transaction = new Transaction({
        userId: req.user.id,
        amount,
        type,
        category,
        description,
        date: date ? new Date(date) : new Date(),
        tags: tags || [],
        location,
        receipt,
      });

      await transaction.save();
      await transaction.populate("category", "name color icon");

      res.status(201).json({
        success: true,
        message: "Transaction created successfully",
        transaction,
      });
    } catch (error) {
      console.error("Create transaction error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   GET /api/transactions
// @desc    Get user transactions with filtering and pagination
// @access  Private
router.get("/", transactionMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      category,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { userId: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate("category", "name color icon")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Transaction.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          current: pageNum,
          pages: totalPages,
          total,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get("/:id", transactionMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("category", "name color icon");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put(
  "/:id",
  transactionMiddleware,
  [
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
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const {
        amount,
        type,
        category,
        description,
        date,
        tags,
        location,
        receipt,
      } = req.body;

      const transaction = await Transaction.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      // Verify category if provided
      if (category) {
        const categoryDoc = await Category.findOne({
          _id: category,
          $or: [{ userId: req.user.id }, { isDefault: true }],
        });

        if (!categoryDoc) {
          return res.status(404).json({
            success: false,
            message: "Category not found",
          });
        }
      }

      // Update fields
      if (amount !== undefined) transaction.amount = amount;
      if (type) transaction.type = type;
      if (category) transaction.category = category;
      if (description) transaction.description = description;
      if (date) transaction.date = new Date(date);
      if (tags !== undefined) transaction.tags = tags;
      if (location !== undefined) transaction.location = location;
      if (receipt !== undefined) transaction.receipt = receipt;

      transaction.updatedAt = new Date();
      await transaction.save();
      await transaction.populate("category", "name color icon");

      res.json({
        success: true,
        message: "Transaction updated successfully",
        transaction,
      });
    } catch (error) {
      console.error("Update transaction error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private
router.delete("/:id", transactionMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/transactions/summary
// @desc    Get transaction summary with analytics
// @access  Private
router.get("/summary", transactionMiddleware, async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const userId = req.user.id;
    const currentDate = new Date();

    let startDate;
    switch (period) {
      case "week":
        startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        break;
      case "year":
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
    }

    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate },
    }).populate("category", "name color");

    // Calculate totals
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Category breakdown
    const categoryBreakdown = {};
    transactions.forEach((transaction) => {
      const categoryName = transaction.category?.name || "Uncategorized";
      if (!categoryBreakdown[categoryName]) {
        categoryBreakdown[categoryName] = {
          total: 0,
          count: 0,
          type: transaction.type,
          color: transaction.category?.color || "#666666",
        };
      }
      categoryBreakdown[categoryName].total += transaction.amount;
      categoryBreakdown[categoryName].count += 1;
    });

    // Daily breakdown for charts
    const dailyBreakdown = {};
    transactions.forEach((transaction) => {
      const day = transaction.date.toISOString().split("T")[0];
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { income: 0, expenses: 0 };
      }
      dailyBreakdown[day][
        transaction.type === "income" ? "income" : "expenses"
      ] += transaction.amount;
    });

    res.json({
      success: true,
      data: {
        period,
        summary: {
          totalIncome: income,
          totalExpenses: expenses,
          balance: income - expenses,
          transactionCount: transactions.length,
        },
        categoryBreakdown,
        dailyBreakdown,
        recentTransactions: transactions
          .sort((a, b) => b.date - a.date)
          .slice(0, 5),
      },
    });
  } catch (error) {
    console.error("Get summary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/transactions/bulk
// @desc    Create multiple transactions
// @access  Private
router.post("/bulk", transactionMiddleware, async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Transactions array is required",
      });
    }

    // Validate each transaction
    const validatedTransactions = [];
    const errors = [];

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];

      if (!txn.amount || txn.amount <= 0) {
        errors.push(`Transaction ${i + 1}: Amount must be a positive number`);
        continue;
      }

      if (!["income", "expense"].includes(txn.type)) {
        errors.push(
          `Transaction ${i + 1}: Type must be either income or expense`
        );
        continue;
      }

      if (!txn.category) {
        errors.push(`Transaction ${i + 1}: Category is required`);
        continue;
      }

      if (!txn.description || txn.description.trim().length === 0) {
        errors.push(`Transaction ${i + 1}: Description is required`);
        continue;
      }

      // Verify category exists
      const categoryDoc = await Category.findOne({
        _id: txn.category,
        $or: [{ userId: req.user.id }, { isDefault: true }],
      });

      if (!categoryDoc) {
        errors.push(`Transaction ${i + 1}: Category not found`);
        continue;
      }

      validatedTransactions.push({
        userId: req.user.id,
        amount: txn.amount,
        type: txn.type,
        category: txn.category,
        description: txn.description.trim(),
        date: txn.date ? new Date(txn.date) : new Date(),
        tags: txn.tags || [],
        location: txn.location,
        receipt: txn.receipt,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors,
      });
    }

    // Create all transactions
    const createdTransactions = await Transaction.insertMany(
      validatedTransactions
    );

    // Populate categories for response
    await Transaction.populate(createdTransactions, {
      path: "category",
      select: "name color icon",
    });

    res.status(201).json({
      success: true,
      message: `${createdTransactions.length} transactions created successfully`,
      transactions: createdTransactions,
    });
  } catch (error) {
    console.error("Bulk create transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/transactions/export
// @desc    Export transactions as CSV
// @access  Private
router.get("/export", transactionMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, format = "csv" } = req.query;

    const query = { userId: req.user.id };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate("category", "name")
      .sort({ date: -1 });

    if (format === "csv") {
      const csvHeader = "Date,Type,Amount,Category,Description,Tags\n";
      const csvData = transactions
        .map((t) => {
          return [
            t.date.toISOString().split("T")[0],
            t.type,
            t.amount,
            t.category?.name || "Uncategorized",
            `"${t.description.replace(/"/g, '""')}"`,
            `"${t.tags.join(", ")}"`,
          ].join(",");
        })
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=transactions.csv"
      );
      res.send(csvHeader + csvData);
    } else {
      res.json({
        success: true,
        data: transactions,
      });
    }
  } catch (error) {
    console.error("Export transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
