const express = require("express");
const { body, validationResult } = require("express-validator");
const Budget = require("../models/Budget");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const auth = require("../middleware/auth");
const budgetMiddleware = require("../middlewares/budgetMiddleware");

const router = express.Router();

// @route   POST /api/budgets
// @desc    Create a new budget
// @access  Private
router.post(
  "/",
  budgetMiddleware,
  [
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
        name,
        amount,
        category,
        period,
        startDate,
        endDate,
        alertThreshold,
      } = req.body;

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
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

      // Check for overlapping budgets
      const overlappingBudget = await Budget.findOne({
        userId: req.user.id,
        category: category || null,
        $or: [
          { startDate: { $lte: start }, endDate: { $gte: start } },
          { startDate: { $lte: end }, endDate: { $gte: end } },
          { startDate: { $gte: start }, endDate: { $lte: end } },
        ],
      });

      if (overlappingBudget) {
        return res.status(400).json({
          success: false,
          message:
            "A budget already exists for this category in the specified time period",
        });
      }

      const budget = new Budget({
        userId: req.user.id,
        name,
        amount,
        category: category || null,
        period,
        startDate: start,
        endDate: end,
        alertThreshold: alertThreshold || 80,
      });

      await budget.save();
      await budget.populate("category", "name color icon");

      res.status(201).json({
        success: true,
        message: "Budget created successfully",
        budget,
      });
    } catch (error) {
      console.error("Create budget error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   GET /api/budgets
// @desc    Get user budgets
// @access  Private
router.get("/", budgetMiddleware, async (req, res) => {
  try {
    const { active, period, category } = req.query;
    const currentDate = new Date();

    // Build query
    const query = { userId: req.user.id };

    if (active === "true") {
      query.startDate = { $lte: currentDate };
      query.endDate = { $gte: currentDate };
    }

    if (period) {
      query.period = period;
    }

    if (category) {
      query.category = category;
    }

    const budgets = await Budget.find(query)
      .populate("category", "name color icon")
      .sort({ startDate: -1 });

    // Calculate spent amount and progress for each budget
    const budgetsWithProgress = await Promise.all(
      budgets.map(async (budget) => {
        const transactionQuery = {
          userId: req.user.id,
          type: "expense",
          date: { $gte: budget.startDate, $lte: budget.endDate },
        };

        if (budget.category) {
          transactionQuery.category = budget.category._id;
        }

        const transactions = await Transaction.find(transactionQuery);
        const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
        const remaining = budget.amount - spent;
        const progress = (spent / budget.amount) * 100;

        return {
          ...budget.toObject(),
          spent,
          remaining: Math.max(0, remaining),
          progress: Math.min(100, progress),
          isOverBudget: spent > budget.amount,
          daysRemaining: Math.max(
            0,
            Math.ceil((budget.endDate - currentDate) / (1000 * 60 * 60 * 24))
          ),
        };
      })
    );

    res.json({
      success: true,
      budgets: budgetsWithProgress,
    });
  } catch (error) {
    console.error("Get budgets error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/budgets/:id
// @desc    Get single budget with detailed analytics
// @access  Private
router.get("/:id", budgetMiddleware, async (req, res) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("category", "name color icon");

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    // Get transactions for this budget
    const transactionQuery = {
      userId: req.user.id,
      type: "expense",
      date: { $gte: budget.startDate, $lte: budget.endDate },
    };

    if (budget.category) {
      transactionQuery.category = budget.category._id;
    }

    const transactions = await Transaction.find(transactionQuery)
      .populate("category", "name color")
      .sort({ date: -1 });

    const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const remaining = budget.amount - spent;
    const progress = (spent / budget.amount) * 100;

    // Daily spending breakdown
    const dailySpending = {};
    transactions.forEach((transaction) => {
      const day = transaction.date.toISOString().split("T")[0];
      dailySpending[day] = (dailySpending[day] || 0) + transaction.amount;
    });

    // Average daily spending
    const daysPassed = Math.ceil(
      (new Date() - budget.startDate) / (1000 * 60 * 60 * 24)
    );
    const avgDailySpending = daysPassed > 0 ? spent / daysPassed : 0;

    // Days remaining
    const daysRemaining = Math.max(
      0,
      Math.ceil((budget.endDate - new Date()) / (1000 * 60 * 60 * 24))
    );

    // Projected spending
    const projectedSpending = spent + avgDailySpending * daysRemaining;

    res.json({
      success: true,
      budget: {
        ...budget.toObject(),
        spent,
        remaining: Math.max(0, remaining),
        progress: Math.min(100, progress),
        isOverBudget: spent > budget.amount,
        daysRemaining,
        avgDailySpending,
        projectedSpending,
        willExceedBudget: projectedSpending > budget.amount,
        transactions,
        dailySpending,
      },
    });
  } catch (error) {
    console.error("Get budget error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/budgets/:id
// @desc    Update budget
// @access  Private
router.put(
  "/:id",
  budgetMiddleware,
  [
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
        name,
        amount,
        category,
        period,
        startDate,
        endDate,
        alertThreshold,
      } = req.body;

      const budget = await Budget.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: "Budget not found",
        });
      }

      // Validate dates if provided
      const newStartDate = startDate ? new Date(startDate) : budget.startDate;
      const newEndDate = endDate ? new Date(endDate) : budget.endDate;

      if (newEndDate <= newStartDate) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
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
      if (name) budget.name = name;
      if (amount) budget.amount = amount;
      if (category !== undefined) budget.category = category || null;
      if (period) budget.period = period;
      if (startDate) budget.startDate = newStartDate;
      if (endDate) budget.endDate = newEndDate;
      if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;

      budget.updatedAt = new Date();
      await budget.save();
      await budget.populate("category", "name color icon");

      res.json({
        success: true,
        message: "Budget updated successfully",
        budget,
      });
    } catch (error) {
      console.error("Update budget error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   DELETE /api/budgets/:id
// @desc    Delete budget
// @access  Private
router.delete("/:id", budgetMiddleware, async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    res.json({
      success: true,
      message: "Budget deleted successfully",
    });
  } catch (error) {
    console.error("Delete budget error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/budgets/analytics/overview
// @desc    Get budget analytics overview
// @access  Private
router.get("/analytics/overview", budgetMiddleware, async (req, res) => {
  try {
    const currentDate = new Date();
    const userId = req.user.id;

    // Get active budgets
    const activeBudgets = await Budget.find({
      userId,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    }).populate("category", "name color");

    // Calculate analytics for each budget
    const budgetAnalytics = await Promise.all(
      activeBudgets.map(async (budget) => {
        const transactionQuery = {
          userId,
          type: "expense",
          date: { $gte: budget.startDate, $lte: budget.endDate },
        };

        if (budget.category) {
          transactionQuery.category = budget.category._id;
        }

        const spent = await Transaction.aggregate([
          { $match: transactionQuery },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        const spentAmount = spent[0]?.total || 0;
        const progress = (spentAmount / budget.amount) * 100;

        return {
          budgetId: budget._id,
          name: budget.name,
          category: budget.category,
          amount: budget.amount,
          spent: spentAmount,
          remaining: Math.max(0, budget.amount - spentAmount),
          progress: Math.min(100, progress),
          isOverBudget: spentAmount > budget.amount,
          alertThreshold: budget.alertThreshold,
          shouldAlert: progress >= budget.alertThreshold,
        };
      })
    );

    // Overall statistics
    const totalBudgeted = budgetAnalytics.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgetAnalytics.reduce((sum, b) => sum + b.spent, 0);
    const overBudgetCount = budgetAnalytics.filter(
      (b) => b.isOverBudget
    ).length;
    const alertCount = budgetAnalytics.filter((b) => b.shouldAlert).length;

    res.json({
      success: true,
      data: {
        overview: {
          totalBudgets: activeBudgets.length,
          totalBudgeted,
          totalSpent,
          totalRemaining: Math.max(0, totalBudgeted - totalSpent),
          overBudgetCount,
          alertCount,
          averageProgress:
            activeBudgets.length > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
        },
        budgets: budgetAnalytics,
      },
    });
  } catch (error) {
    console.error("Get budget analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/budgets/:id/duplicate
// @desc    Duplicate a budget for next period
// @access  Private
router.post("/:id/duplicate", budgetMiddleware, async (req, res) => {
  try {
    const originalBudget = await Budget.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!originalBudget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    // Calculate next period dates
    let nextStartDate, nextEndDate;
    const duration = originalBudget.endDate - originalBudget.startDate;

    nextStartDate = new Date(originalBudget.endDate.getTime() + 1);
    nextEndDate = new Date(nextStartDate.getTime() + duration);

    // Create duplicate budget
    const duplicatedBudget = new Budget({
      userId: req.user.id,
      name: `${originalBudget.name} (Copy)`,
      amount: originalBudget.amount,
      category: originalBudget.category,
      period: originalBudget.period,
      startDate: nextStartDate,
      endDate: nextEndDate,
      alertThreshold: originalBudget.alertThreshold,
    });

    await duplicatedBudget.save();
    await duplicatedBudget.populate("category", "name color icon");

    res.status(201).json({
      success: true,
      message: "Budget duplicated successfully",
      budget: duplicatedBudget,
    });
  } catch (error) {
    console.error("Duplicate budget error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
