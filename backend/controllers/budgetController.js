const Budget = require("../models/Budget");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");

class BudgetController {
  // Create a new budget
  async createBudget(req, res) {
    try {
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
        const categoryExists = await this._verifyCategoryExists(
          category,
          req.user.id
        );
        if (!categoryExists) {
          return res.status(404).json({
            success: false,
            message: "Category not found",
          });
        }
      }

      // Check for overlapping budgets
      const hasOverlap = await this._checkBudgetOverlap(
        req.user.id,
        category,
        start,
        end
      );

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message:
            "A budget already exists for this category in the specified time period",
        });
      }

      // Create budget
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

  // Get user budgets
  async getBudgets(req, res) {
    try {
      const { active, period, category } = req.query;
      const currentDate = new Date();

      // Build query
      const query = this._buildBudgetQuery(
        req.user.id,
        { active, period, category },
        currentDate
      );

      const budgets = await Budget.find(query)
        .populate("category", "name color icon")
        .sort({ startDate: -1 });

      // Calculate spent amount and progress for each budget
      const budgetsWithProgress = await Promise.all(
        budgets.map((budget) =>
          this._calculateBudgetProgress(budget, req.user.id, currentDate)
        )
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
  }

  // Get single budget with detailed analytics
  async getBudgetById(req, res) {
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

      // Get detailed budget analytics
      const budgetAnalytics = await this._getBudgetDetailedAnalytics(
        budget,
        req.user.id
      );

      res.json({
        success: true,
        budget: budgetAnalytics,
      });
    } catch (error) {
      console.error("Get budget error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  // Update budget
  async updateBudget(req, res) {
    try {
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
        const categoryExists = await this._verifyCategoryExists(
          category,
          req.user.id
        );
        if (!categoryExists) {
          return res.status(404).json({
            success: false,
            message: "Category not found",
          });
        }
      }

      // Update budget fields
      this._updateBudgetFields(budget, {
        name,
        amount,
        category,
        period,
        startDate: newStartDate,
        endDate: newEndDate,
        alertThreshold,
      });

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

  // Delete budget
  async deleteBudget(req, res) {
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
  }

  // Get budget analytics overview
  async getBudgetAnalyticsOverview(req, res) {
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
        activeBudgets.map((budget) =>
          this._calculateBudgetAnalytics(budget, userId)
        )
      );

      // Calculate overall statistics
      const overviewStats = this._calculateOverviewStats(
        budgetAnalytics,
        activeBudgets
      );

      res.json({
        success: true,
        data: {
          overview: overviewStats,
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
  }

  // Duplicate a budget for next period
  async duplicateBudget(req, res) {
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
      const { nextStartDate, nextEndDate } =
        this._calculateNextPeriodDates(originalBudget);

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
  }

  // Private helper methods
  async _verifyCategoryExists(categoryId, userId) {
    const categoryDoc = await Category.findOne({
      _id: categoryId,
      $or: [{ userId }, { isDefault: true }],
    });
    return !!categoryDoc;
  }

  async _checkBudgetOverlap(userId, category, startDate, endDate) {
    const overlappingBudget = await Budget.findOne({
      userId,
      category: category || null,
      $or: [
        { startDate: { $lte: startDate }, endDate: { $gte: startDate } },
        { startDate: { $lte: endDate }, endDate: { $gte: endDate } },
        { startDate: { $gte: startDate }, endDate: { $lte: endDate } },
      ],
    });
    return !!overlappingBudget;
  }

  _buildBudgetQuery(userId, filters, currentDate) {
    const query = { userId };

    if (filters.active === "true") {
      query.startDate = { $lte: currentDate };
      query.endDate = { $gte: currentDate };
    }

    if (filters.period) {
      query.period = filters.period;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    return query;
  }

  async _calculateBudgetProgress(budget, userId, currentDate) {
    const transactionQuery = {
      userId,
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
  }

  async _getBudgetDetailedAnalytics(budget, userId) {
    // Get transactions for this budget
    const transactionQuery = {
      userId,
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
    const dailySpending = this._calculateDailySpending(transactions);

    // Calculate time-based metrics
    const timeMetrics = this._calculateTimeMetrics(budget, spent);

    return {
      ...budget.toObject(),
      spent,
      remaining: Math.max(0, remaining),
      progress: Math.min(100, progress),
      isOverBudget: spent > budget.amount,
      ...timeMetrics,
      transactions,
      dailySpending,
    };
  }

  _calculateDailySpending(transactions) {
    const dailySpending = {};
    transactions.forEach((transaction) => {
      const day = transaction.date.toISOString().split("T")[0];
      dailySpending[day] = (dailySpending[day] || 0) + transaction.amount;
    });
    return dailySpending;
  }

  _calculateTimeMetrics(budget, spent) {
    const currentDate = new Date();
    const daysPassed = Math.max(
      1,
      Math.ceil((currentDate - budget.startDate) / (1000 * 60 * 60 * 24))
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((budget.endDate - currentDate) / (1000 * 60 * 60 * 24))
    );

    const avgDailySpending = spent / daysPassed;
    const projectedSpending = spent + avgDailySpending * daysRemaining;

    return {
      daysRemaining,
      avgDailySpending,
      projectedSpending,
      willExceedBudget: projectedSpending > budget.amount,
    };
  }

  _updateBudgetFields(budget, updates) {
    if (updates.name) budget.name = updates.name;
    if (updates.amount) budget.amount = updates.amount;
    if (updates.category !== undefined)
      budget.category = updates.category || null;
    if (updates.period) budget.period = updates.period;
    if (updates.startDate) budget.startDate = updates.startDate;
    if (updates.endDate) budget.endDate = updates.endDate;
    if (updates.alertThreshold !== undefined)
      budget.alertThreshold = updates.alertThreshold;
  }

  async _calculateBudgetAnalytics(budget, userId) {
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
  }

  _calculateOverviewStats(budgetAnalytics, activeBudgets) {
    const totalBudgeted = budgetAnalytics.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgetAnalytics.reduce((sum, b) => sum + b.spent, 0);
    const overBudgetCount = budgetAnalytics.filter(
      (b) => b.isOverBudget
    ).length;
    const alertCount = budgetAnalytics.filter((b) => b.shouldAlert).length;

    return {
      totalBudgets: activeBudgets.length,
      totalBudgeted,
      totalSpent,
      totalRemaining: Math.max(0, totalBudgeted - totalSpent),
      overBudgetCount,
      alertCount,
      averageProgress:
        activeBudgets.length > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
    };
  }

  _calculateNextPeriodDates(originalBudget) {
    const duration = originalBudget.endDate - originalBudget.startDate;
    const nextStartDate = new Date(originalBudget.endDate.getTime() + 1);
    const nextEndDate = new Date(nextStartDate.getTime() + duration);

    return { nextStartDate, nextEndDate };
  }

  // Additional utility methods for budget management
  async getBudgetStatus(budgetId, userId) {
    try {
      const budget = await Budget.findOne({ _id: budgetId, userId });
      if (!budget) return null;

      const currentDate = new Date();

      if (currentDate < budget.startDate) return "upcoming";
      if (currentDate > budget.endDate) return "expired";
      return "active";
    } catch (error) {
      console.error("Get budget status error:", error);
      return null;
    }
  }

  async getBudgetsNeedingAlert(userId) {
    try {
      const currentDate = new Date();
      const activeBudgets = await Budget.find({
        userId,
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate },
      }).populate("category", "name");

      const alertBudgets = [];

      for (const budget of activeBudgets) {
        const transactionQuery = {
          userId,
          type: "expense",
          date: { $gte: budget.startDate, $lte: budget.endDate },
        };

        if (budget.category) {
          transactionQuery.category = budget.category._id;
        }

        const transactions = await Transaction.find(transactionQuery);
        const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
        const progress = (spent / budget.amount) * 100;

        if (progress >= budget.alertThreshold) {
          alertBudgets.push({
            budget,
            spent,
            progress,
            isOverBudget: spent > budget.amount,
          });
        }
      }

      return alertBudgets;
    } catch (error) {
      console.error("Get budgets needing alert error:", error);
      return [];
    }
  }
}

module.exports = new BudgetController();
