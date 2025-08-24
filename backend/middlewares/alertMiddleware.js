const Notification = require("../models/Notification");

/**
 * Middleware to validate notification ownership
 * Ensures user can only access their own notifications
 */
const validateNotificationOwnership = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (notification.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - notification belongs to another user",
      });
    }

    // Attach notification to request for use in controller
    req.notification = notification;
    next();
  } catch (error) {
    console.error("Validate notification ownership error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating notification access",
    });
  }
};

/**
 * Middleware to validate bulk operations
 * Ensures bulk operations don't exceed limits
 */
const validateBulkOperation = (maxLimit = 100) => {
  return (req, res, next) => {
    try {
      const { notifications, ids } = req.body;

      // For bulk creation
      if (notifications) {
        if (!Array.isArray(notifications)) {
          return res.status(400).json({
            success: false,
            message: "Notifications must be an array",
          });
        }

        if (notifications.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Notifications array cannot be empty",
          });
        }

        if (notifications.length > maxLimit) {
          return res.status(400).json({
            success: false,
            message: `Cannot process more than ${maxLimit} notifications at once`,
          });
        }
      }

      // For bulk operations on existing notifications
      if (ids) {
        if (!Array.isArray(ids)) {
          return res.status(400).json({
            success: false,
            message: "IDs must be an array",
          });
        }

        if (ids.length === 0) {
          return res.status(400).json({
            success: false,
            message: "IDs array cannot be empty",
          });
        }

        if (ids.length > maxLimit) {
          return res.status(400).json({
            success: false,
            message: `Cannot process more than ${maxLimit} IDs at once`,
          });
        }
      }

      next();
    } catch (error) {
      console.error("Validate bulk operation error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while validating bulk operation",
      });
    }
  };
};

/**
 * Middleware to validate notification type and category
 */
const validateNotificationData = (req, res, next) => {
  try {
    const { type, category } = req.body;

    const validTypes = ["info", "success", "warning", "error"];
    const validCategories = [
      "transaction",
      "budget",
      "alert",
      "system",
      "reminder",
    ];

    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid notification type. Valid types are: ${validTypes.join(
          ", "
        )}`,
      });
    }

    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid notification category. Valid categories are: ${validCategories.join(
          ", "
        )}`,
      });
    }

    next();
  } catch (error) {
    console.error("Validate notification data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating notification data",
    });
  }
};

/**
 * Middleware to add unread count to response
 */
const addUnreadCount = async (req, res, next) => {
  try {
    const originalSend = res.json;

    res.json = async function (data) {
      if (data && data.success && req.user) {
        try {
          const unreadCount = await Notification.countDocuments({
            userId: req.user.id,
            isRead: false,
          });

          if (data.data) {
            data.data.unreadCount = unreadCount;
          } else {
            data.unreadCount = unreadCount;
          }
        } catch (error) {
          console.error("Add unread count error:", error);
          // Don't fail the request if unread count fails
        }
      }

      return originalSend.call(this, data);
    };

    next();
  } catch (error) {
    console.error("Add unread count middleware error:", error);
    next(); // Continue without adding unread count
  }
};

/**
 * Rate limiting middleware specifically for notification creation
 */
const notificationRateLimit = (() => {
  const userLimits = new Map();
  const WINDOW_SIZE = 60 * 1000; // 1 minute
  const MAX_NOTIFICATIONS = 10; // 10 notifications per minute per user

  return (req, res, next) => {
    try {
      const userId = req.user.id;
      const now = Date.now();

      // Clean up old entries
      for (const [id, data] of userLimits.entries()) {
        if (now - data.windowStart > WINDOW_SIZE) {
          userLimits.delete(id);
        }
      }

      const userLimit = userLimits.get(userId);

      if (!userLimit) {
        userLimits.set(userId, { count: 1, windowStart: now });
        return next();
      }

      if (now - userLimit.windowStart > WINDOW_SIZE) {
        userLimits.set(userId, { count: 1, windowStart: now });
        return next();
      }

      if (userLimit.count >= MAX_NOTIFICATIONS) {
        return res.status(429).json({
          success: false,
          message: "Rate limit exceeded. Maximum 10 notifications per minute.",
        });
      }

      userLimit.count++;
      next();
    } catch (error) {
      console.error("Notification rate limit error:", error);
      next(); // Continue on error
    }
  };
})();

/**
 * Middleware to validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer",
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100",
      });
    }

    // Attach validated values to request
    req.pagination = {
      page: pageNum,
      limit: limitNum,
      skip: (pageNum - 1) * limitNum,
    };

    next();
  } catch (error) {
    console.error("Validate pagination error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating pagination",
    });
  }
};

/**
 * Middleware to validate sort parameters
 */
const validateSorting = (req, res, next) => {
  try {
    const { sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const validSortFields = [
      "createdAt",
      "readAt",
      "title",
      "type",
      "category",
    ];
    const validSortOrders = ["asc", "desc"];

    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sort field. Valid fields are: ${validSortFields.join(
          ", "
        )}`,
      });
    }

    if (!validSortOrders.includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: "Sort order must be 'asc' or 'desc'",
      });
    }

    // Attach validated values to request
    req.sorting = {
      sortBy,
      sortOrder,
      sortOptions: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    };

    next();
  } catch (error) {
    console.error("Validate sorting error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating sorting",
    });
  }
};

/**
 * Middleware to validate filter parameters
 */
const validateFilters = (req, res, next) => {
  try {
    const { type, category, read } = req.query;

    const validTypes = ["info", "success", "warning", "error"];
    const validCategories = [
      "transaction",
      "budget",
      "alert",
      "system",
      "reminder",
    ];

    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type filter. Valid types are: ${validTypes.join(
          ", "
        )}`,
      });
    }

    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category filter. Valid categories are: ${validCategories.join(
          ", "
        )}`,
      });
    }

    if (read !== undefined && !["true", "false"].includes(read)) {
      return res.status(400).json({
        success: false,
        message: "Read filter must be 'true' or 'false'",
      });
    }

    next();
  } catch (error) {
    console.error("Validate filters error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating filters",
    });
  }
};

/**
 * Middleware to log notification activities
 */
const logNotificationActivity = (action) => {
  return (req, res, next) => {
    try {
      const originalSend = res.json;

      res.json = function (data) {
        if (data && data.success) {
          console.log(
            `[NOTIFICATION] User ${req.user.id} performed ${action}`,
            {
              userId: req.user.id,
              action,
              timestamp: new Date().toISOString(),
              notificationId: req.params.id,
              metadata: {
                userAgent: req.get("User-Agent"),
                ip: req.ip,
              },
            }
          );
        }

        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error("Log notification activity error:", error);
      next(); // Continue on error
    }
  };
};

/**
 * Middleware to check notification preferences
 * (In a real app, this would check user's notification preferences)
 */
const checkNotificationPreferences = async (req, res, next) => {
  try {
    // In a real app, you would fetch user preferences from database
    // For now, we'll assume all notifications are allowed

    const { type, category } = req.body;

    // TODO: Implement actual preference checking
    // const user = await User.findById(req.user.id);
    // if (user.notificationPreferences) {
    //   // Check if this type/category is enabled for the user
    // }

    next();
  } catch (error) {
    console.error("Check notification preferences error:", error);
    next(); // Continue on error
  }
};

/**
 * Middleware to sanitize notification data
 */
const sanitizeNotificationData = (req, res, next) => {
  try {
    if (req.body.title) {
      req.body.title = req.body.title.trim().substring(0, 200); // Limit title length
    }

    if (req.body.message) {
      req.body.message = req.body.message.trim().substring(0, 1000); // Limit message length
    }

    if (req.body.actionUrl) {
      // Basic URL validation
      try {
        new URL(req.body.actionUrl);
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          message: "Invalid action URL format",
        });
      }
    }

    // Sanitize metadata
    if (req.body.metadata && typeof req.body.metadata === "object") {
      // Remove any potentially dangerous keys and limit size
      const sanitizedMetadata = {};
      const allowedKeys = [
        "transactionId",
        "budgetId",
        "amount",
        "category",
        "tags",
        "priority",
      ];

      for (const key of allowedKeys) {
        if (req.body.metadata[key] !== undefined) {
          sanitizedMetadata[key] = req.body.metadata[key];
        }
      }

      req.body.metadata = sanitizedMetadata;
    }

    next();
  } catch (error) {
    console.error("Sanitize notification data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while sanitizing notification data",
    });
  }
};

/**
 * Middleware to prevent notification spam
 * Checks for duplicate notifications in the last few minutes
 */
const preventNotificationSpam = async (req, res, next) => {
  try {
    const { title, message } = req.body;
    const userId = req.user.id;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Check for duplicate notifications in the last 5 minutes
    const duplicateNotification = await Notification.findOne({
      userId,
      title,
      message,
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (duplicateNotification) {
      return res.status(409).json({
        success: false,
        message:
          "Duplicate notification detected. Please wait before sending the same notification again.",
        existingNotification: duplicateNotification,
      });
    }

    next();
  } catch (error) {
    console.error("Prevent notification spam error:", error);
    next(); // Continue on error to not block legitimate requests
  }
};

/**
 * Middleware to validate statistics period
 */
const validateStatisticsPeriod = (req, res, next) => {
  try {
    const { period = "month" } = req.query;
    const validPeriods = ["week", "month", "year", "all"];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: `Invalid period. Valid periods are: ${validPeriods.join(
          ", "
        )}`,
      });
    }

    req.statisticsPeriod = period;
    next();
  } catch (error) {
    console.error("Validate statistics period error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating statistics period",
    });
  }
};

/**
 * Middleware to check if user has exceeded their notification quota
 * (Useful for preventing abuse in multi-tenant applications)
 */
const checkNotificationQuota = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyCount = await Notification.countDocuments({
      userId,
      createdAt: { $gte: today },
    });

    const DAILY_LIMIT = 100; // Configurable limit

    if (dailyCount >= DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        message: `Daily notification limit exceeded. Maximum ${DAILY_LIMIT} notifications per day.`,
        dailyCount,
        limit: DAILY_LIMIT,
      });
    }

    // Add quota info to request for potential use in controller
    req.notificationQuota = {
      used: dailyCount,
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT - dailyCount,
    };

    next();
  } catch (error) {
    console.error("Check notification quota error:", error);
    next(); // Continue on error
  }
};

/**
 * Middleware to validate notification preferences update
 */
const validatePreferencesUpdate = (req, res, next) => {
  try {
    const {
      emailNotifications,
      pushNotifications,
      smsNotifications,
      categories,
      frequency,
      quietHours,
    } = req.body;

    // Validate boolean fields
    if (
      emailNotifications !== undefined &&
      typeof emailNotifications !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "emailNotifications must be a boolean",
      });
    }

    if (
      pushNotifications !== undefined &&
      typeof pushNotifications !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "pushNotifications must be a boolean",
      });
    }

    if (
      smsNotifications !== undefined &&
      typeof smsNotifications !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "smsNotifications must be a boolean",
      });
    }

    // Validate frequency
    if (
      frequency &&
      !["instant", "hourly", "daily", "weekly"].includes(frequency)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid frequency. Valid options are: instant, hourly, daily, weekly",
      });
    }

    // Validate categories
    if (categories && typeof categories === "object") {
      const validCategories = [
        "transaction",
        "budget",
        "alert",
        "system",
        "reminder",
      ];
      for (const category of Object.keys(categories)) {
        if (!validCategories.includes(category)) {
          return res.status(400).json({
            success: false,
            message: `Invalid category: ${category}`,
          });
        }
        if (typeof categories[category] !== "boolean") {
          return res.status(400).json({
            success: false,
            message: `Category ${category} must be a boolean`,
          });
        }
      }
    }

    // Validate quiet hours
    if (quietHours && typeof quietHours === "object") {
      if (
        quietHours.enabled !== undefined &&
        typeof quietHours.enabled !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message: "quietHours.enabled must be a boolean",
        });
      }

      if (
        quietHours.start &&
        !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(quietHours.start)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid quiet hours start time format. Use HH:MM",
        });
      }

      if (
        quietHours.end &&
        !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(quietHours.end)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid quiet hours end time format. Use HH:MM",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Validate preferences update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating preferences",
    });
  }
};

module.exports = {
  validateNotificationOwnership,
  validateBulkOperation,
  validateNotificationData,
  addUnreadCount,
  notificationRateLimit,
  validatePagination,
  validateSorting,
  validateFilters,
  logNotificationActivity,
  checkNotificationPreferences,
  sanitizeNotificationData,
  preventNotificationSpam,
  validateStatisticsPeriod,
  checkNotificationQuota,
  validatePreferencesUpdate,
};
