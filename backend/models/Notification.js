const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [200, "Title must not exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [1000, "Message must not exceed 1000 characters"],
    },
    type: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
      required: true,
    },
    category: {
      type: String,
      enum: [
        "transaction",
        "budget",
        "alert",
        "system",
        "reminder",
        "security",
        "update",
      ],
      default: "system",
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    data: {
      // Additional context data for the notification
      entityType: {
        type: String,
        enum: ["transaction", "budget", "category", "user", "system"],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      amount: {
        type: Number,
      },
      currency: {
        type: String,
        uppercase: true,
        minlength: 3,
        maxlength: 3,
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    actions: [
      {
        label: {
          type: String,
          required: true,
          maxlength: [50, "Action label must not exceed 50 characters"],
        },
        type: {
          type: String,
          enum: ["button", "link", "dismiss"],
          required: true,
        },
        url: {
          type: String,
          maxlength: [500, "URL must not exceed 500 characters"],
        },
        method: {
          type: String,
          enum: ["GET", "POST", "PUT", "DELETE"],
          default: "GET",
        },
        payload: {
          type: mongoose.Schema.Types.Mixed,
        },
      },
    ],
    channels: {
      inApp: {
        enabled: {
          type: Boolean,
          default: true,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
        },
      },
      email: {
        enabled: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
        },
        emailId: {
          type: String,
        },
      },
      push: {
        enabled: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
        },
        pushId: {
          type: String,
        },
      },
      sms: {
        enabled: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
        },
        smsId: {
          type: String,
        },
      },
    },
    scheduledFor: {
      type: Date,
      default: null, // null means send immediately
    },
    expiresAt: {
      type: Date,
      default: null, // null means never expires
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "cancelled", "expired"],
      default: "pending",
    },
    retryCount: {
      type: Number,
      default: 0,
      max: 3,
    },
    lastRetryAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
      maxlength: [500, "Error message must not exceed 500 characters"],
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [30, "Tag must not exceed 30 characters"],
      },
    ],
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
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, category: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ "data.entityType": 1, "data.entityId": 1 });

// Virtual for time since creation
notificationSchema.virtual("age").get(function () {
  const now = new Date();
  const diffTime = now - this.createdAt;
  const diffMinutes = Math.floor(diffTime / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
});

// Virtual for delivery status
notificationSchema.virtual("deliveryStatus").get(function () {
  const channels = this.channels;
  return {
    inApp: channels.inApp.delivered,
    email: channels.email.delivered,
    push: channels.push.delivered,
    sms: channels.sms.delivered,
    anyDelivered:
      channels.inApp.delivered ||
      channels.email.delivered ||
      channels.push.delivered ||
      channels.sms.delivered,
  };
});

// Static method to get recent notifications
notificationSchema.statics.getRecent = function (userId, limit = 10) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
};

// Static method to get unread notifications
notificationSchema.statics.getUnread = function (userId) {
  return this.find({ userId, isRead: false }).sort({ createdAt: -1 }).lean();
};

// Static method to get notification statistics
notificationSchema.statics.getStatistics = async function (userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
        byType: {
          $push: {
            type: "$type",
            category: "$category",
          },
        },
      },
    },
  ]);

  // Count by type and category
  const typeCount = {};
  const categoryCount = {};

  if (stats[0]?.byType) {
    stats[0].byType.forEach((item) => {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    });
  }

  return {
    total: stats[0]?.total || 0,
    unread: stats[0]?.unread || 0,
    read: (stats[0]?.total || 0) - (stats[0]?.unread || 0),
    typeBreakdown: typeCount,
    categoryBreakdown: categoryCount,
  };
};

// Static method to create bulk notifications
notificationSchema.statics.createBulk = async function (notifications) {
  const validNotifications = notifications.filter(
    (notif) => notif.userId && notif.title && notif.message
  );

  return await this.insertMany(validNotifications, { ordered: false });
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function (userId) {
  const result = await this.updateMany(
    { userId, isRead: false },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  return result;
};

// Static method to clear read notifications
notificationSchema.statics.clearRead = async function (userId) {
  return await this.deleteMany({ userId, isRead: true });
};

// Static method to clear all notifications
notificationSchema.statics.clearAll = async function (userId) {
  return await this.deleteMany({ userId });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to mark as unread
notificationSchema.methods.markAsUnread = function () {
  this.isRead = false;
  this.readAt = null;
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to check if notification is expired
notificationSchema.methods.isExpired = function () {
  return this.expiresAt && this.expiresAt < new Date();
};

// Instance method to check if ready to send
notificationSchema.methods.isReadyToSend = function () {
  const now = new Date();
  return (
    this.status === "pending" &&
    (!this.scheduledFor || this.scheduledFor <= now) &&
    !this.isExpired()
  );
};

// Pre-save middleware
notificationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Auto-expire old notifications if not set
  if (!this.expiresAt && this.category !== "system") {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30); // Default 30 days
    this.expiresAt = expireDate;
  }

  // Set delivery status for in-app notifications
  if (this.channels.inApp.enabled && !this.channels.inApp.delivered) {
    this.channels.inApp.delivered = true;
    this.channels.inApp.deliveredAt = new Date();
  }

  next();
});

// Index for TTL (Time To Live) - auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notification", notificationSchema);
