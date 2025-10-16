const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [50, "Category name must not exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description must not exceed 200 characters"],
    },
    color: {
      type: String,
      required: [true, "Category color is required"],
      match: [
        /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        "Please provide a valid hex color code",
      ],
      default: "#666666",
    },
    icon: {
      type: String,
      trim: true,
      maxlength: [50, "Icon name must not exceed 50 characters"],
    },
    type: {
      type: String,
      enum: ["income", "expense", "both"],
      default: "both",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    isSystem: {
      type: Boolean,
      default: false, // System categories vs user-created categories
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    budget: {
      monthly: {
        type: Number,
        min: 0,
        default: 0,
      },
      yearly: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    statistics: {
      totalTransactions: {
        type: Number,
        default: 0,
      },
      totalAmount: {
        type: Number,
        default: 0,
      },
      lastTransactionDate: {
        type: Date,
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

// Compound indexes for better performance
categorySchema.index({ userId: 1, isActive: 1 });
categorySchema.index({ userId: 1, type: 1 });
categorySchema.index({ userId: 1, name: 1 }, { unique: true });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isSystem: 1 });

// Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory",
});

// Virtual for transaction count
categorySchema.virtual("transactionCount").get(function () {
  return this.statistics.totalTransactions;
});

// Static method to get default system categories
categorySchema.statics.getDefaultCategories = function () {
  return [
    // Income Categories
    {
      name: "Salary",
      type: "income",
      color: "#4CAF50",
      icon: "💼",
      isSystem: true,
    },
    {
      name: "Business",
      type: "income",
      color: "#2196F3",
      icon: "🏢",
      isSystem: true,
    },
    {
      name: "Investment",
      type: "income",
      color: "#FF9800",
      icon: "📈",
      isSystem: true,
    },
    {
      name: "Freelance",
      type: "income",
      color: "#9C27B0",
      icon: "💻",
      isSystem: true,
    },
    {
      name: "Other Income",
      type: "income",
      color: "#607D8B",
      icon: "💰",
      isSystem: true,
    },

    // Expense Categories
    {
      name: "Food & Dining",
      type: "expense",
      color: "#F44336",
      icon: "🍽️",
      isSystem: true,
    },
    {
      name: "Transportation",
      type: "expense",
      color: "#FF5722",
      icon: "🚗",
      isSystem: true,
    },
    {
      name: "Shopping",
      type: "expense",
      color: "#E91E63",
      icon: "🛍️",
      isSystem: true,
    },
    {
      name: "Entertainment",
      type: "expense",
      color: "#9C27B0",
      icon: "🎬",
      isSystem: true,
    },
    {
      name: "Bills & Utilities",
      type: "expense",
      color: "#3F51B5",
      icon: "💡",
      isSystem: true,
    },
    {
      name: "Healthcare",
      type: "expense",
      color: "#009688",
      icon: "🏥",
      isSystem: true,
    },
    {
      name: "Education",
      type: "expense",
      color: "#4CAF50",
      icon: "📚",
      isSystem: true,
    },
    {
      name: "Travel",
      type: "expense",
      color: "#FF9800",
      icon: "✈️",
      isSystem: true,
    },
    {
      name: "Personal Care",
      type: "expense",
      color: "#795548",
      icon: "💅",
      isSystem: true,
    },
    {
      name: "Other Expenses",
      type: "expense",
      color: "#607D8B",
      icon: "📊",
      isSystem: true,
    },
  ];
};

// Static method to create default categories for a user
categorySchema.statics.createDefaultCategories = async function (userId) {
  const defaultCategories = this.getDefaultCategories();
  const userCategories = defaultCategories.map((cat) => ({
    ...cat,
    userId,
  }));

  try {
    return await this.insertMany(userCategories);
  } catch (error) {
    throw new Error(`Failed to create default categories: ${error.message}`);
  }
};

// Instance method to update statistics
categorySchema.methods.updateStatistics = async function () {
  const Transaction = mongoose.model("Transaction");

  const stats = await Transaction.aggregate([
    { $match: { category: this._id } },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        lastTransactionDate: { $max: "$date" },
      },
    },
  ]);

  if (stats.length > 0) {
    this.statistics = stats[0];
    delete this.statistics._id;
    await this.save();
  }
};

// Pre-save middleware
categorySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-remove middleware to prevent deletion if there are associated transactions
categorySchema.pre("remove", async function (next) {
  const Transaction = mongoose.model("Transaction");
  const transactionCount = await Transaction.countDocuments({
    category: this._id,
  });

  if (transactionCount > 0) {
    throw new Error("Cannot delete category with associated transactions");
  }
  next();
});

module.exports = mongoose.model("Category", categorySchema);
