const express = require("express");
const { query, validationResult } = require("express-validator");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Category = require("../models/Category");
// const auth = require("../middleware/auth");
const analyticsMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// @route   GET /api/analytics/overview
// @desc    Get financial overview analytics
// @access  Private
router.get("/overview", analyticsMiddleware, async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const userId = req.user.id;
    const currentDate = new Date();

    let startDate, previousPeriodStart;

    switch (period) {
      case "week":
        startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(
          startDate.getTime() - 7 * 24 * 60 * 60 * 1000
        );
        break;
      case "month":
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        previousPeriodStart = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 1,
          1
        );
        break;
      case "year":
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        previousPeriodStart = new Date(currentDate.getFullYear() - 1, 0, 1);
        break;
      default:
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        previousPeriodStart = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 1,
          1
        );
    }

    // Get current period transactions
    const currentTransactions = await Transaction.find({
      userId,
      date: { $gte: startDate },
    });

    // Get previous period transactions for comparison
    const previousTransactions = await Transaction.find({
      userId,
      date: { $gte: previousPeriodStart, $lt: startDate },
    });

    // Calculate current period metrics
    const currentIncome = currentTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const currentExpenses = currentTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate previous period metrics
    const previousIncome = previousTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const previousExpenses = previousTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate percentage changes
    const incomeChange =
      previousIncome > 0
        ? ((currentIncome - previousIncome) / previousIncome) * 100
        : 0;
    const expenseChange =
      previousExpenses > 0
        ? ((currentExpenses - previousExpenses) / previousExpenses) * 100
        : 0;

    // Get total balance (all-time)
    const allTransactions = await Transaction.find({ userId });
    const totalIncome = allTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = allTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalBalance = totalIncome - totalExpenses;

    // Get active budgets
    const activeBudgets = await Budget.find({
      userId,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    });

    // Calculate budget utilization
    let totalBudgeted = 0;
    let totalBudgetSpent = 0;

    for (const budget of activeBudgets) {
      totalBudgeted += budget.amount;

      const budgetQuery = {
        userId,
        type: "expense",
        date: { $gte: budget.startDate, $lte: budget.endDate },
      };

      if (budget.category) {
        budgetQuery.category = budget.category;
      }

      const budgetTransactions = await Transaction.find(budgetQuery);
      totalBudgetSpent += budgetTransactions.reduce(
        (sum, t) => sum + t.amount,
        0
      );
    }

    res.json({
      success: true,
      data: {
        overview: {
          currentPeriod: {
            income: currentIncome,
            expenses: currentExpenses,
            balance: currentIncome - currentExpenses,
            transactionCount: currentTransactions.length,
          },
          previousPeriod: {
            income: previousIncome,
            expenses: previousExpenses,
            balance: previousIncome - previousExpenses,
            transactionCount: previousTransactions.length,
          },
          changes: {
            income: incomeChange,
            expenses: expenseChange,
            balance:
              previousIncome - previousExpenses !== 0
                ? ((currentIncome -
                    currentExpenses -
                    (previousIncome - previousExpenses)) /
                    Math.abs(previousIncome - previousExpenses)) *
                  100
                : 0,
          },
          totals: {
            balance: totalBalance,
            income: totalIncome,
            expenses: totalExpenses,
          },
          budgets: {
            totalBudgeted,
            totalSpent: totalBudgetSpent,
            utilization:
              totalBudgeted > 0 ? (totalBudgetSpent / totalBudgeted) * 100 : 0,
            activeBudgetCount: activeBudgets.length,
          },
        },
        period,
      },
    });
  } catch (error) {
    console.error("Get analytics overview error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/analytics/spending-trends
// @desc    Get spending trends over time
// @access  Private
router.get("/spending-trends", analyticsMiddleware, async (req, res) => {
  try {
    const { period = "month", months = 6 } = req.query;
    const userId = req.user.id;
    const currentDate = new Date();
    const monthsBack = parseInt(months);

    const trendData = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      const endDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i + 1,
        0
      );

      const transactions = await Transaction.find({
        userId,
        date: { $gte: startDate, $lte: endDate },
      });

      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      trendData.push({
        period: startDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        month: startDate.getMonth() + 1,
        year: startDate.getFullYear(),
        income,
        expenses,
        balance: income - expenses,
        transactionCount: transactions.length,
      });
    }

    // Calculate trends
    const avgIncome =
      trendData.reduce((sum, d) => sum + d.income, 0) / trendData.length;
    const avgExpenses =
      trendData.reduce((sum, d) => sum + d.expenses, 0) / trendData.length;
    const avgBalance =
      trendData.reduce((sum, d) => sum + d.balance, 0) / trendData.length;

    // Calculate growth rates (comparing first and last month)
    const firstMonth = trendData[0];
    const lastMonth = trendData[trendData.length - 1];

    const incomeGrowth =
      firstMonth.income > 0
        ? ((lastMonth.income - firstMonth.income) / firstMonth.income) * 100
        : 0;
    const expenseGrowth =
      firstMonth.expenses > 0
        ? ((lastMonth.expenses - firstMonth.expenses) / firstMonth.expenses) *
          100
        : 0;

    res.json({
      success: true,
      data: {
        trends: trendData,
        summary: {
          avgIncome,
          avgExpenses,
          avgBalance,
          incomeGrowth,
          expenseGrowth,
          totalMonths: monthsBack,
        },
      },
    });
  } catch (error) {
    console.error("Get spending trends error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/analytics/category-breakdown
// @desc    Get spending breakdown by category
// @access  Private
router.get("/category-breakdown", analyticsMiddleware, async (req, res) => {
  try {
    const { period = "month", type = "expense" } = req.query;
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
      type,
      date: { $gte: startDate },
    }).populate("category", "name color icon");

    // Group by category
    const categoryBreakdown = {};
    let totalAmount = 0;

    transactions.forEach((transaction) => {
      const categoryName = transaction.category?.name || "Uncategorized";
      const categoryColor = transaction.category?.color || "#666666";
      const categoryIcon = transaction.category?.icon || "📊";

      if (!categoryBreakdown[categoryName]) {
        categoryBreakdown[categoryName] = {
          name: categoryName,
          color: categoryColor,
          icon: categoryIcon,
          amount: 0,
          count: 0,
          transactions: [],
        };
      }

      categoryBreakdown[categoryName].amount += transaction.amount;
      categoryBreakdown[categoryName].count += 1;
      categoryBreakdown[categoryName].transactions.push({
        id: transaction._id,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
      });

      totalAmount += transaction.amount;
    });

    // Convert to array and calculate percentages
    const categoryArray = Object.values(categoryBreakdown)
      .map((category) => ({
        ...category,
        percentage: totalAmount > 0 ? (category.amount / totalAmount) * 100 : 0,
        avgTransaction:
          category.count > 0 ? category.amount / category.count : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    res.json({
      success: true,
      data: {
        categories: categoryArray,
        summary: {
          totalAmount,
          categoryCount: categoryArray.length,
          transactionCount: transactions.length,
          topCategory: categoryArray[0]?.name || null,
          topCategoryAmount: categoryArray[0]?.amount || 0,
        },
        period,
        type,
      },
    });
  } catch (error) {
    console.error("Get category breakdown error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/analytics/budget-performance
// @desc    Get budget performance analytics
// @access  Private
router.get("/budget-performance", analyticsMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();

    // Get all budgets (active and completed)
    const budgets = await Budget.find({ userId })
      .populate("category", "name color icon")
      .sort({ startDate: -1 });

    const budgetPerformance = await Promise.all(
      budgets.map(async (budget) => {
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
        const remaining = budget.amount - spent;

        // Determine budget status
        let status;
        if (currentDate > budget.endDate) {
          status = spent > budget.amount ? "exceeded" : "completed";
        } else if (currentDate < budget.startDate) {
          status = "upcoming";
        } else {
          status = spent > budget.amount ? "exceeded" : "active";
        }

        // Calculate daily spending rate
        const totalDays = Math.ceil(
          (budget.endDate - budget.startDate) / (1000 * 60 * 60 * 24)
        );
        const daysPassed = Math.min(
          totalDays,
          Math.ceil((currentDate - budget.startDate) / (1000 * 60 * 60 * 24))
        );
        const avgDailySpending = daysPassed > 0 ? spent / daysPassed : 0;
        const targetDailySpending = budget.amount / totalDays;

        return {
          budget: {
            id: budget._id,
            name: budget.name,
            amount: budget.amount,
            category: budget.category,
            period: budget.period,
            startDate: budget.startDate,
            endDate: budget.endDate,
            alertThreshold: budget.alertThreshold,
          },
          performance: {
            spent,
            remaining: Math.max(0, remaining),
            progress: Math.min(100, progress),
            status,
            isOverBudget: spent > budget.amount,
            overageAmount: Math.max(0, spent - budget.amount),
          },
          timing: {
            totalDays,
            daysPassed: Math.max(0, daysPassed),
            daysRemaining: Math.max(0, totalDays - daysPassed),
            avgDailySpending,
            targetDailySpending,
            spendingRate:
              targetDailySpending > 0
                ? avgDailySpending / targetDailySpending
                : 0,
          },
          transactionCount: transactions.length,
        };
      })
    );

    // Calculate overall statistics
    const activeBudgets = budgetPerformance.filter(
      (bp) => bp.performance.status === "active"
    );
    const completedBudgets = budgetPerformance.filter(
      (bp) => bp.performance.status === "completed"
    );
    const exceededBudgets = budgetPerformance.filter(
      (bp) => bp.performance.status === "exceeded"
    );

    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgetPerformance.reduce(
      (sum, bp) => sum + bp.performance.spent,
      0
    );
    const avgProgress =
      budgets.length > 0
        ? budgetPerformance.reduce(
            (sum, bp) => sum + bp.performance.progress,
            0
          ) / budgets.length
        : 0;

    res.json({
      success: true,
      data: {
        budgets: budgetPerformance,
        summary: {
          totalBudgets: budgets.length,
          activeBudgets: activeBudgets.length,
          completedBudgets: completedBudgets.length,
          exceededBudgets: exceededBudgets.length,
          totalBudgeted,
          totalSpent,
          avgProgress,
          successRate:
            budgets.length > 0
              ? (completedBudgets.length / budgets.length) * 100
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Get budget performance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/analytics/insights
// @desc    Get financial insights and recommendations
// @access  Private
router.get("/insights", analyticsMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();
    const insights = [];

    // Get last 3 months of data
    const threeMonthsAgo = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 3,
      1
    );
    const transactions = await Transaction.find({
      userId,
      date: { $gte: threeMonthsAgo },
    }).populate("category", "name");

    if (transactions.length === 0) {
      return res.json({
        success: true,
        data: {
          insights: [
            {
              type: "info",
              title: "Get Started",
              message:
                "Start tracking your transactions to receive personalized insights!",
              priority: "low",
            },
          ],
          summary: {
            totalInsights: 1,
            categories: { info: 1 },
          },
        },
      });
    }

    // Insight 1: Spending patterns
    const monthlySpending = {};
    const expenseTransactions = transactions.filter(
      (t) => t.type === "expense"
    );

    expenseTransactions.forEach((t) => {
      const monthKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
      monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + t.amount;
    });

    const spendingValues = Object.values(monthlySpending);
    if (spendingValues.length >= 2) {
      const avgSpending =
        spendingValues.reduce((sum, val) => sum + val, 0) /
        spendingValues.length;
      const lastMonthSpending = spendingValues[spendingValues.length - 1];

      if (lastMonthSpending > avgSpending * 1.2) {
        insights.push({
          type: "warning",
          title: "Increased Spending",
          message: `Your spending last month was ${(
            (lastMonthSpending / avgSpending - 1) *
            100
          ).toFixed(1)}% higher than usual.`,
          priority: "medium",
          data: { lastMonth: lastMonthSpending, average: avgSpending },
        });
      } else if (lastMonthSpending < avgSpending * 0.8) {
        insights.push({
          type: "success",
          title: "Great Spending Control",
          message: `You spent ${(
            (1 - lastMonthSpending / avgSpending) *
            100
          ).toFixed(1)}% less than usual last month!`,
          priority: "low",
          data: { lastMonth: lastMonthSpending, average: avgSpending },
        });
      }
    }

    // Insight 2: Top spending category
    const categoryTotals = {};
    expenseTransactions.forEach((t) => {
      const category = t.category?.name || "Uncategorized";
      categoryTotals[category] = (categoryTotals[category] || 0) + t.amount;
    });

    const topCategory = Object.entries(categoryTotals).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (topCategory) {
      const [categoryName, amount] = topCategory;
      const totalExpenses = expenseTransactions.reduce(
        (sum, t) => sum + t.amount,
        0
      );
      const percentage = (amount / totalExpenses) * 100;

      if (percentage > 40) {
        insights.push({
          type: "info",
          title: "Top Spending Category",
          message: `${categoryName} accounts for ${percentage.toFixed(
            1
          )}% of your spending. Consider reviewing this category for savings opportunities.`,
          priority: "medium",
          data: { category: categoryName, amount, percentage },
        });
      }
    }

    // Insight 3: Budget performance
    const activeBudgets = await Budget.find({
      userId,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    });

    for (const budget of activeBudgets) {
      const budgetQuery = {
        userId,
        type: "expense",
        date: { $gte: budget.startDate, $lte: budget.endDate },
      };

      if (budget.category) {
        budgetQuery.category = budget.category;
      }

      const budgetTransactions = await Transaction.find(budgetQuery);
      const spent = budgetTransactions.reduce((sum, t) => sum + t.amount, 0);
      const progress = (spent / budget.amount) * 100;

      if (progress >= 90 && progress < 100) {
        insights.push({
          type: "warning",
          title: "Budget Almost Exceeded",
          message: `You've used ${progress.toFixed(1)}% of your "${
            budget.name
          }" budget.`,
          priority: "high",
          data: {
            budgetName: budget.name,
            spent,
            budgetAmount: budget.amount,
            progress,
          },
        });
      } else if (progress >= 100) {
        insights.push({
          type: "error",
          title: "Budget Exceeded",
          message: `You've exceeded your "${budget.name}" budget by $${(
            spent - budget.amount
          ).toFixed(2)}.`,
          priority: "high",
          data: {
            budgetName: budget.name,
            spent,
            budgetAmount: budget.amount,
            overage: spent - budget.amount,
          },
        });
      }
    }

    // Insight 4: Unusual transactions
    if (expenseTransactions.length > 0) {
      const amounts = expenseTransactions
        .map((t) => t.amount)
        .sort((a, b) => a - b);
      const q3Index = Math.floor(amounts.length * 0.75);
      const q3 = amounts[q3Index];
      const iqr = q3 - amounts[Math.floor(amounts.length * 0.25)];
      const upperOutlier = q3 + 1.5 * iqr;

      const unusualTransactions = expenseTransactions.filter(
        (t) => t.amount > upperOutlier
      );

      if (unusualTransactions.length > 0) {
        const total = unusualTransactions.reduce((sum, t) => sum + t.amount, 0);
        insights.push({
          type: "info",
          title: "Unusual Transactions",
          message: `${
            unusualTransactions.length
          } large transactions totaling $${total.toFixed(
            2
          )} detected this period.`,
          priority: "low",
          data: {
            count: unusualTransactions.length,
            total,
            threshold: upperOutlier,
          },
        });
      }
    }

    // Insight 5: Savings opportunity
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = expenseTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );
    const savingsRate =
      totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    if (savingsRate < 10 && totalIncome > 0) {
      insights.push({
        type: "warning",
        title: "Low Savings Rate",
        message: `Your savings rate is ${savingsRate.toFixed(
          1
        )}%. Financial experts recommend saving at least 20% of income.`,
        priority: "medium",
        data: { savingsRate, totalIncome, totalExpenses },
      });
    } else if (savingsRate > 20) {
      insights.push({
        type: "success",
        title: "Excellent Savings Rate",
        message: `Great job! You're saving ${savingsRate.toFixed(
          1
        )}% of your income.`,
        priority: "low",
        data: { savingsRate, totalIncome, totalExpenses },
      });
    }

    // Categorize insights
    const categories = {
      info: insights.filter((i) => i.type === "info").length,
      success: insights.filter((i) => i.type === "success").length,
      warning: insights.filter((i) => i.type === "warning").length,
      error: insights.filter((i) => i.type === "error").length,
    };

    res.json({
      success: true,
      data: {
        insights: insights.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }),
        summary: {
          totalInsights: insights.length,
          categories,
        },
      },
    });
  } catch (error) {
    console.error("Get insights error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private
router.get("/export", analyticsMiddleware, async (req, res) => {
  try {
    const { format = "json", period = "year" } = req.query;
    const userId = req.user.id;
    const currentDate = new Date();

    let startDate;
    switch (period) {
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
      case "all":
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), 0, 1);
    }

    const [transactions, budgets] = await Promise.all([
      Transaction.find({ userId, date: { $gte: startDate } })
        .populate("category", "name color")
        .sort({ date: -1 }),
      Budget.find({ userId, startDate: { $gte: startDate } }).populate(
        "category",
        "name color"
      ),
    ]);

    const analyticsData = {
      period,
      exportDate: currentDate.toISOString(),
      summary: {
        totalTransactions: transactions.length,
        totalBudgets: budgets.length,
        totalIncome: transactions
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0),
        totalExpenses: transactions
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0),
      },
      transactions,
      budgets,
    };

    if (format === "csv") {
      // Generate CSV format
      const csvHeader = "Date,Type,Amount,Category,Description,Tags\n";
      const csvData = transactions
        .map((t) =>
          [
            t.date.toISOString().split("T")[0],
            t.type,
            t.amount,
            t.category?.name || "Uncategorized",
            `"${t.description.replace(/"/g, '""')}"`,
            `"${t.tags.join(", ")}"`,
          ].join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=analytics-${period}.csv`
      );
      res.send(csvHeader + csvData);
    } else {
      // JSON format
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=analytics-${period}.json`
      );
      res.json(analyticsData);
    }
  } catch (error) {
    console.error("Export analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
