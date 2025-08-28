const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");

class UserController {
  // Get user profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User profile not found",
        });
      }

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching profile",
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
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
        email,
        phoneNumber,
        dateOfBirth,
        currency,
        language,
        timezone,
        avatar,
        bio,
      } = req.body;

      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if email is already taken by another user
      if (email && email !== user.email) {
        const emailExists = await User.findOne({
          email,
          _id: { $ne: req.user.id },
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: "Email is already taken by another user",
          });
        }

        // If email is changed, mark as unverified
        if (user.isVerified) {
          user.isVerified = false;
          user.emailVerificationToken =
            UserController.generateVerificationToken();
        }
      }

      // Update fields if provided
      if (name) user.name = name;
      if (email) user.email = email;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
      if (avatar) user.avatar = avatar;
      if (bio) user.bio = bio;
      if (currency) user.preferences.currency = currency;
      if (language) user.preferences.language = language;
      if (timezone) user.preferences.timezone = timezone;

      user.updatedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: "Profile updated successfully",
        user: UserController.sanitizeUser(user),
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating profile",
      });
    }
  }

  // Change user password
  static async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user.id).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Check if new password is different from current
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: "New password must be different from current password",
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.updatedAt = new Date();
      user.passwordChangedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while changing password",
      });
    }
  }

  // Get user dashboard data
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const { timeframe = "month" } = req.query;

      const currentDate = new Date();
      let startOfPeriod;

      switch (timeframe) {
        case "week":
          startOfPeriod = new Date(
            currentDate.getTime() - 7 * 24 * 60 * 60 * 1000
          );
          break;
        case "month":
          startOfPeriod = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
          );
          break;
        case "year":
          startOfPeriod = new Date(currentDate.getFullYear(), 0, 1);
          break;
        default:
          startOfPeriod = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
          );
      }

      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

      // Parallel data fetching for better performance
      const [
        recentTransactions,
        periodTransactions,
        yearlyTransactions,
        activeBudgets,
        totalIncomeData,
        totalExpensesData,
        user,
      ] = await Promise.all([
        Transaction.find({ userId })
          .sort({ date: -1 })
          .limit(5)
          .populate("category", "name color icon"),
        Transaction.find({
          userId,
          date: { $gte: startOfPeriod },
        }),
        Transaction.find({
          userId,
          date: { $gte: startOfYear },
        }),
        Budget.find({
          userId,
          startDate: { $lte: currentDate },
          endDate: { $gte: currentDate },
        }).populate("category", "name color icon"),
        Transaction.aggregate([
          { $match: { userId, type: "income" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Transaction.aggregate([
          { $match: { userId, type: "expense" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        User.findById(userId).select("name preferences"),
      ]);

      // Calculate period stats
      const periodIncome = periodTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const periodExpenses = periodTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate yearly stats
      const yearlyIncome = yearlyTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const yearlyExpenses = yearlyTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      // Account balance (total income - total expenses)
      const totalBalance =
        (totalIncomeData[0]?.total || 0) - (totalExpensesData[0]?.total || 0);

      // Budget progress calculation
      const budgetsWithProgress = activeBudgets.map((budget) => {
        const spent = periodTransactions
          .filter(
            (t) =>
              t.type === "expense" &&
              t.category &&
              t.category._id.toString() === budget.category._id.toString()
          )
          .reduce((sum, t) => sum + t.amount, 0);

        const progress = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        return {
          ...budget.toObject(),
          spent,
          remaining: Math.max(0, budget.amount - spent),
          progress: Math.round(progress),
          status:
            progress >= 100
              ? "exceeded"
              : progress >= 80
              ? "warning"
              : "on-track",
        };
      });

      // Recent activity summary
      const activitySummary = {
        totalTransactions: periodTransactions.length,
        avgTransactionAmount:
          periodTransactions.length > 0
            ? periodTransactions.reduce((sum, t) => sum + t.amount, 0) /
              periodTransactions.length
            : 0,
        largestExpense: Math.max(
          0,
          ...periodTransactions
            .filter((t) => t.type === "expense")
            .map((t) => t.amount)
        ),
        largestIncome: Math.max(
          0,
          ...periodTransactions
            .filter((t) => t.type === "income")
            .map((t) => t.amount)
        ),
      };

      res.json({
        success: true,
        data: {
          user: {
            name: user.name,
            preferences: user.preferences,
          },
          timeframe,
          recentTransactions,
          periodStats: {
            income: periodIncome,
            expenses: periodExpenses,
            balance: periodIncome - periodExpenses,
            savingsRate:
              periodIncome > 0
                ? (
                    ((periodIncome - periodExpenses) / periodIncome) *
                    100
                  ).toFixed(2)
                : 0,
          },
          yearlyStats: {
            income: yearlyIncome,
            expenses: yearlyExpenses,
            balance: yearlyIncome - yearlyExpenses,
          },
          totalBalance,
          activeBudgets: budgetsWithProgress,
          activitySummary,
          insights: UserController.generateInsights(
            periodIncome,
            periodExpenses,
            budgetsWithProgress
          ),
        },
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching dashboard data",
      });
    }
  }

  // Update user preferences
  static async updatePreferences(req, res) {
    try {
      const {
        currency,
        language,
        timezone,
        notifications,
        theme,
        dateFormat,
        numberFormat,
      } = req.body;
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Validate preferences
      if (currency && !UserController.isValidCurrency(currency)) {
        return res.status(400).json({
          success: false,
          message: "Invalid currency code",
        });
      }

      if (language && !UserController.isValidLanguage(language)) {
        return res.status(400).json({
          success: false,
          message: "Invalid language code",
        });
      }

      if (timezone && !UserController.isValidTimezone(timezone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid timezone",
        });
      }

      // Update preferences
      if (currency) user.preferences.currency = currency;
      if (language) user.preferences.language = language;
      if (timezone) user.preferences.timezone = timezone;
      if (theme) user.preferences.theme = theme;
      if (dateFormat) user.preferences.dateFormat = dateFormat;
      if (numberFormat) user.preferences.numberFormat = numberFormat;

      if (notifications !== undefined) {
        user.preferences.notifications = {
          ...user.preferences.notifications,
          ...notifications,
        };
      }

      user.updatedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: "Preferences updated successfully",
        preferences: user.preferences,
      });
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating preferences",
      });
    }
  }

  // Delete user account
  static async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { password, confirmDeletion } = req.body;

      // Verify password for security
      if (password) {
        const user = await User.findById(userId).select("+password");
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: "Password verification failed",
          });
        }
      }

      // Double confirmation check
      if (confirmDeletion !== "DELETE_MY_ACCOUNT") {
        return res.status(400).json({
          success: false,
          message: "Account deletion not confirmed properly",
        });
      }

      // Get counts before deletion for confirmation
      const [transactionCount, budgetCount] = await Promise.all([
        Transaction.countDocuments({ userId }),
        Budget.countDocuments({ userId }),
      ]);

      // Delete all user data in transaction-like manner
      await Promise.all([
        Transaction.deleteMany({ userId }),
        Budget.deleteMany({ userId }),
        // Add other related models here (Categories, Notifications, etc.)
        User.findByIdAndDelete(userId),
      ]);

      res.json({
        success: true,
        message: "Account and all associated data deleted successfully",
        deletedData: {
          transactions: transactionCount,
          budgets: budgetCount,
        },
      });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while deleting account",
      });
    }
  }

  // Get user statistics
  static async getUserStats(req, res) {
    try {
      const userId = req.user.id;
      const { period = "month" } = req.query;

      let startDate;
      const currentDate = new Date();

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
        case "all":
          startDate = new Date(0);
          break;
        default:
          startDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
          );
      }

      const [transactions, categoryStats, monthlyTrend, topExpenseCategories] =
        await Promise.all([
          Transaction.find({
            userId,
            date: { $gte: startDate },
          }).populate("category", "name color icon"),

          // Category breakdown
          Transaction.aggregate([
            { $match: { userId, date: { $gte: startDate } } },
            {
              $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            {
              $group: {
                _id: {
                  categoryId: "$category",
                  type: "$type",
                  categoryName: { $arrayElemAt: ["$categoryInfo.name", 0] },
                  categoryColor: { $arrayElemAt: ["$categoryInfo.color", 0] },
                },
                count: { $sum: 1 },
                total: { $sum: "$amount" },
              },
            },
          ]),

          // Monthly trend (last 12 months)
          Transaction.aggregate([
            {
              $match: {
                userId,
                date: {
                  $gte: new Date(
                    currentDate.getFullYear() - 1,
                    currentDate.getMonth(),
                    1
                  ),
                },
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: "$date" },
                  month: { $month: "$date" },
                  type: "$type",
                },
                total: { $sum: "$amount" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ]),

          // Top expense categories
          Transaction.aggregate([
            { $match: { userId, type: "expense", date: { $gte: startDate } } },
            {
              $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            {
              $group: {
                _id: "$category",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
                categoryName: {
                  $first: { $arrayElemAt: ["$categoryInfo.name", 0] },
                },
                categoryColor: {
                  $first: { $arrayElemAt: ["$categoryInfo.color", 0] },
                },
              },
            },
            { $sort: { total: -1 } },
            { $limit: 10 },
          ]),
        ]);

      // Calculate basic stats
      const totalIncome = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      // Format category breakdown
      const categoryBreakdown = {};
      categoryStats.forEach((stat) => {
        const categoryName = stat._id.categoryName || "Uncategorized";
        if (!categoryBreakdown[categoryName]) {
          categoryBreakdown[categoryName] = {
            income: 0,
            expenses: 0,
            color: stat._id.categoryColor || "#666666",
            transactionCount: 0,
          };
        }
        categoryBreakdown[categoryName][
          stat._id.type === "income" ? "income" : "expenses"
        ] = stat.total;
        categoryBreakdown[categoryName].transactionCount += stat.count;
      });

      // Format monthly trend
      const trendData = {};
      monthlyTrend.forEach((item) => {
        const key = `${item._id.year}-${String(item._id.month).padStart(
          2,
          "0"
        )}`;
        if (!trendData[key]) {
          trendData[key] = { income: 0, expenses: 0 };
        }
        trendData[key][item._id.type === "income" ? "income" : "expenses"] =
          item.total;
      });

      res.json({
        success: true,
        data: {
          period,
          summary: {
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            transactionCount: transactions.length,
            savingsRate:
              totalIncome > 0
                ? (((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(
                    2
                  )
                : 0,
          },
          categoryBreakdown,
          monthlyTrend: trendData,
          topExpenseCategories,
          recentTransactions: transactions.slice(-10).reverse(),
          insights: UserController.generateStatsInsights(
            totalIncome,
            totalExpenses,
            categoryBreakdown
          ),
        },
      });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching statistics",
      });
    }
  }

  // Helper Methods
  static sanitizeUser(user) {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
      avatar: user.avatar,
      bio: user.bio,
      preferences: user.preferences,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static generateVerificationToken() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  static isValidCurrency(currency) {
    const validCurrencies = [
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "CAD",
      "AUD",
      "CHF",
      "CNY",
      "INR",
    ];
    return validCurrencies.includes(currency.toUpperCase());
  }

  static isValidLanguage(language) {
    const validLanguages = [
      "en",
      "es",
      "fr",
      "de",
      "it",
      "pt",
      "ru",
      "zh",
      "ja",
      "ko",
    ];
    return validLanguages.includes(language.toLowerCase());
  }

  static isValidTimezone(timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  static generateInsights(income, expenses, budgets) {
    const insights = [];

    if (income > expenses) {
      const savingsRate = (((income - expenses) / income) * 100).toFixed(1);
      insights.push({
        type: "positive",
        message: `Great! You saved ${savingsRate}% of your income this period.`,
      });
    } else if (expenses > income) {
      const deficit = expenses - income;
      insights.push({
        type: "warning",
        message: `You spent $${deficit.toFixed(
          2
        )} more than you earned this period.`,
      });
    }

    const exceededBudgets = budgets.filter((b) => b.progress >= 100);
    if (exceededBudgets.length > 0) {
      insights.push({
        type: "warning",
        message: `You've exceeded ${exceededBudgets.length} budget(s) this period.`,
      });
    }

    return insights;
  }

  static generateStatsInsights(income, expenses, categoryBreakdown) {
    const insights = [];

    // Find highest expense category
    const expenseCategories = Object.entries(categoryBreakdown)
      .filter(([_, data]) => data.expenses > 0)
      .sort(([_, a], [__, b]) => b.expenses - a.expenses);

    if (expenseCategories.length > 0) {
      const [topCategory, data] = expenseCategories[0];
      const percentage = ((data.expenses / expenses) * 100).toFixed(1);
      insights.push({
        type: "info",
        message: `${topCategory} accounts for ${percentage}% of your expenses.`,
      });
    }

    return insights;
  }
}

module.exports = UserController;
