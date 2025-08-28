const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    amount: {
      type: Number,
      required: [true, "Transaction amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: [true, "Transaction type is required"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description must not exceed 500 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes must not exceed 1000 characters"],
    },
    date: {
      type: Date,
      required: [true, "Transaction date is required"],
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "credit_card",
        "debit_card",
        "bank_transfer",
        "digital_wallet",
        "check",
        "other",
      ],
      default: "cash",
    },
    account: {
      type: String,
      trim: true,
      maxlength: [100, "Account name must not exceed 100 characters"],
    },
    reference: {
      type: String,
      trim: true,
      maxlength: [100, "Reference must not exceed 100 characters"],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, "Location must not exceed 200 characters"],
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Tag must not exceed 50 characters"],
      },
    ],
    attachments: [
      {
        filename: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        uploadDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    recurring: {
      isRecurring: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"],
        required: function () {
          return this.recurring.isRecurring;
        },
      },
      interval: {
        type: Number,
        default: 1,
        min: 1,
      },
      endDate: {
        type: Date,
      },
      nextDue: {
        type: Date,
      },
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "completed",
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0,
    },
    originalAmount: {
      type: Number,
      min: 0,
    },
    originalCurrency: {
      type: String,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    budget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Budget",
      default: null,
    },
    isTransfer: {
      type: Boolean,
      default: false,
    },
    transferTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    metadata: {
      source: {
        type: String,
        enum: ["manual", "import", "api", "recurring"],
        default: "manual",
      },
      importBatch: {
        type: String,
      },
      lastModified: {
        type: Date,
        default: Date.now,
      },
      modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
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

// Indexes for better performance
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ date: -1 });
transactionSchema.index({ "recurring.isRecurring": 1, "recurring.nextDue": 1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ tags: 1 });

// Virtual for formatted amount
transactionSchema.virtual("formattedAmount").get(function () {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: this.currency,
  }).format(this.amount);
});

// Virtual for age of transaction
transactionSchema.virtual("age").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Static method to get transactions by date range
transactionSchema.statics.getByDateRange = function (
  userId,
  startDate,
  endDate,
  options = {}
) {
  const query = {
    userId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (options.type) {
    query.type = options.type;
  }

  if (options.category) {
    query.category = options.category;
  }

  if (options.status) {
    query.status = options.status;
  }

  return this.find(query)
    .populate("category", "name color icon")
    .populate("subcategory", "name color icon")
    .sort({ date: -1 });
};

// Static method to get spending by category
transactionSchema.statics.getSpendingByCategory = function (
  userId,
  startDate,
  endDate
) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: "expense",
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryInfo",
      },
    },
    {
      $unwind: "$categoryInfo",
    },
    {
      $group: {
        _id: "$category",
        categoryName: { $first: "$categoryInfo.name" },
        categoryColor: { $first: "$categoryInfo.color" },
        totalAmount: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
        avgAmount: { $avg: "$amount" },
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ]);
};

// Static method to get monthly trends
transactionSchema.statics.getMonthlyTrends = function (userId, months = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          type: "$type",
        },
        totalAmount: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
  ]);
};

// Instance method to create next recurring transaction
transactionSchema.methods.createNextRecurring = async function () {
  if (!this.recurring.isRecurring || !this.recurring.nextDue) {
    return null;
  }

  const nextTransaction = new this.constructor({
    userId: this.userId,
    amount: this.amount,
    type: this.type,
    category: this.category,
    subcategory: this.subcategory,
    description: this.description,
    notes: this.notes,
    date: this.recurring.nextDue,
    paymentMethod: this.paymentMethod,
    account: this.account,
    currency: this.currency,
    recurring: {
      isRecurring: true,
      frequency: this.recurring.frequency,
      interval: this.recurring.interval,
      endDate: this.recurring.endDate,
      nextDue: this.calculateNextDueDate(this.recurring.nextDue),
    },
    metadata: {
      source: "recurring",
    },
  });

  // Update current transaction's next due date
  this.recurring.nextDue = nextTransaction.recurring.nextDue;
  await this.save();

  return nextTransaction.save();
};

// Helper method to calculate next due date
transactionSchema.methods.calculateNextDueDate = function (currentDate) {
  const nextDate = new Date(currentDate);
  const interval = this.recurring.interval;

  switch (this.recurring.frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + interval * 7);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
  }

  return nextDate;
};

// Pre-save middleware
transactionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  this.metadata.lastModified = Date.now();

  // Set next due date for recurring transactions
  if (this.recurring.isRecurring && !this.recurring.nextDue) {
    this.recurring.nextDue = this.calculateNextDueDate(this.date);
  }

  next();
});

// Post-save middleware to update category statistics
transactionSchema.post("save", async function () {
  const Category = mongoose.model("Category");
  const category = await Category.findById(this.category);
  if (category) {
    await category.updateStatistics();
  }
});

module.exports = mongoose.model("Transaction", transactionSchema);
