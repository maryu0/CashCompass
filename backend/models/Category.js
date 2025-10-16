const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Please add a category name"],
      trim: true,
      maxlength: [50, "Category name cannot be more than 50 characters"],
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: [true, "Please specify category type"],
    },
    icon: {
      type: String,
      default: "📁",
    },
    color: {
      type: String,
      default: "#6B7280",
      match: [
        /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        "Please provide a valid hex color code",
      ],
    },
    description: {
      type: String,
      maxlength: [200, "Description cannot be more than 200 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for user and name to ensure unique category names per user
categorySchema.index({ user: 1, name: 1 }, { unique: true });

// Index for filtering by type
categorySchema.index({ user: 1, type: 1 });

module.exports = mongoose.model("Category", categorySchema);
