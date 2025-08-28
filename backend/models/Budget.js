const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    // User reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Budget identification
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Budget period
    period: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      default: "monthly",
      required: true,
    },

    // Date range
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    // Budget amounts
    totalBudget: {
      type: Number,
      required: true,
      min: 0,
    },

    spent: {
      type: Number,
      default: 0,
      min: 0,
    },

    remaining: {
      type: Number,
      default: function () {
        return this.totalBudget - this.spent;
      },
    },

    // Category-wise budget breakdown
    categories: [
      {
        categoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        budgetAmount: {
          type: Number,
          required: true,
          min: 0,
        },
        spent: {
          type: Number,
          default: 0,
          min: 0,
        },
        remaining: {
          type: Number,
          default: function () {
            return this.budgetAmount - this.spent;
          },
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
        },
      },
    ],

    // Budget status and tracking
    status: {
      type: String,
      enum: ["active", "inactive", "completed", "exceeded"],
      default: "active",
    },

    // Alert settings
    alerts: {
      enabled: {
        type: Boolean,
        default: true,
      },
      thresholds: {
        warning: {
          type: Number,
          default: 80, // 80% of budget
          min: 0,
          max: 100,
        },
        critical: {
          type: Number,
          default: 95, // 95% of budget
          min: 0,
          max: 100,
        },
      },
      lastAlertSent: {
        type: Date,
      },
    },

    // Performance metrics (for analytics)
    performance: {
      utilizationRate: {
        type: Number,
        default: 0,
        min: 0,
      },
      variance: {
        type: Number,
        default: 0,
      },
      averageDailySpend: {
        type: Number,
        default: 0,
        min: 0,
      },
      projectedTotal: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Recurring budget settings
    isRecurring: {
      type: Boolean,
      default: false,
    },

    recurringSettings: {
      frequency: {
        type: String,
        enum: ["weekly", "monthly", "quarterly", "yearly"],
      },
      autoRenew: {
        type: Boolean,
        default: false,
      },
      nextRenewal: {
        type: Date,
      },
    },

    // Audit fields
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    lastCalculated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
budgetSchema.index({ userId: 1, status: 1 });
budgetSchema.index({ startDate: 1, endDate: 1 });
budgetSchema.index({ period: 1, status: 1 });
budgetSchema.index({ "categories.categoryId": 1 });

// Virtual for budget utilization percentage
budgetSchema.virtual("utilizationPercentage").get(function () {
  return this.totalBudget > 0 ? (this.spent / this.totalBudget) * 100 : 0;
});

// Virtual for remaining days
budgetSchema.virtual("remainingDays").get(function () {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days elapsed
budgetSchema.virtual("daysElapsed").get(function () {
  const now = new Date();
  const start = new Date(this.startDate);
  const diffTime = now - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for total budget period days
budgetSchema.virtual("totalDays").get(function () {
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const diffTime = end - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update calculated fields
budgetSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Calculate remaining amount
  this.remaining = this.totalBudget - this.spent;

  // Update performance metrics
  if (this.totalBudget > 0) {
    this.performance.utilizationRate = (this.spent / this.totalBudget) * 100;
    this.performance.variance = this.spent - this.totalBudget;
  }

  // Calculate average daily spend
  const daysElapsed = this.daysElapsed || 1;
  this.performance.averageDailySpend = this.spent / daysElapsed;

  // Project total spending
  const totalDays = this.totalDays || 1;
  this.performance.projectedTotal =
    this.performance.averageDailySpend * totalDays;

  // Update status based on spending
  if (this.spent >= this.totalBudget) {
    this.status = "exceeded";
  } else if (new Date() > this.endDate) {
    this.status = "completed";
  } else if (this.status !== "inactive") {
    this.status = "active";
  }

  // Update category calculations
  this.categories.forEach((category) => {
    category.remaining = category.budgetAmount - category.spent;
    if (this.totalBudget > 0) {
      category.percentage = (category.budgetAmount / this.totalBudget) * 100;
    }
  });

  next();
});

// Static methods for analytics queries
budgetSchema.statics.getBudgetPerformance = function (userId, options = {}) {
  const match = { userId: new mongoose.Types.ObjectId(userId) };

  if (options.period) {
    match.period = options.period;
  }

  if (options.startDate && options.endDate) {
    match.startDate = { $gte: new Date(options.startDate) };
    match.endDate = { $lte: new Date(options.endDate) };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$period",
        totalBudgets: { $sum: 1 },
        totalBudgeted: { $sum: "$totalBudget" },
        totalSpent: { $sum: "$spent" },
        avgUtilization: { $avg: "$performance.utilizationRate" },
        exceededCount: {
          $sum: { $cond: [{ $eq: ["$status", "exceeded"] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

budgetSchema.statics.getActiveUserBudgets = function (userId) {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    status: "active",
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
  }).populate("categories.categoryId");
};

budgetSchema.statics.getBudgetTrends = function (userId, months = 6) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        budgetCount: { $sum: 1 },
        totalBudgeted: { $sum: "$totalBudget" },
        totalSpent: { $sum: "$spent" },
        avgUtilization: { $avg: "$performance.utilizationRate" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
};

// Instance methods
budgetSchema.methods.updateSpentAmount = function () {
  // This would be called after transactions are updated
  // Implementation would aggregate transactions for this budget period
  return this.save();
};

budgetSchema.methods.checkAlerts = function () {
  if (!this.alerts.enabled) return false;

  const utilizationRate = this.performance.utilizationRate;
  const { warning, critical } = this.alerts.thresholds;

  if (utilizationRate >= critical) {
    return { level: "critical", message: "Budget critically exceeded!" };
  } else if (utilizationRate >= warning) {
    return { level: "warning", message: "Budget warning threshold reached!" };
  }

  return false;
};

budgetSchema.methods.getCategoryPerformance = function () {
  return this.categories.map((category) => ({
    categoryId: category.categoryId,
    budgetAmount: category.budgetAmount,
    spent: category.spent,
    remaining: category.remaining,
    utilizationRate:
      category.budgetAmount > 0
        ? (category.spent / category.budgetAmount) * 100
        : 0,
    status: category.spent > category.budgetAmount ? "exceeded" : "on-track",
  }));
};

const Budget = mongoose.model("Budget", budgetSchema);

module.exports = Budget;
