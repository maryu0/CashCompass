const { body, query, param } = require("express-validator");
const Notification = require("../models/Notification");

// Validation middleware for creating notifications
const validateCreateNotification = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage(
      "Notification title is required and must be less than 200 characters"
    ),
  body("message")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage(
      "Notification message is required and must be less than 1000 characters"
    ),
  body("type")
    .optional()
    .isIn(["info", "success", "warning", "error"])
    .withMessage("Type must be info, success, warning, or error"),
  body("category")
    .optional()
    .isIn(["transaction", "budget", "alert", "system", "reminder"])
    .withMessage("Invalid category"),
  body("actionUrl")
    .optional()
    .isURL()
    .withMessage("Action URL must be a valid URL"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
];

// Validation middleware for query parameters
const validateNotificationQuery = [
  query("read")
    .optional()
    .isBoolean()
    .withMessage("Read parameter must be boolean"),
  query("type")
    .optional()
    .isIn(["info", "success", "warning", "error"])
    .withMessage("Invalid type parameter"),
  query("category")
    .optional()
    .isIn(["transaction", "budget", "alert", "system", "reminder"])
    .withMessage("Invalid category parameter"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "title", "type", "category", "isRead"])
    .withMessage("Invalid sortBy parameter"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
];

// Validation middleware for notification ID parameter
const validateNotificationId = [
  param("id").isMongoId().withMessage("Invalid notification ID"),
];

// Validation middleware for statistics query
const validateStatisticsQuery = [
  query("period")
    .optional()
    .isIn(["week", "month", "year"])
    .withMessage("Period must be week, month, or year"),
];

// Validation middleware for bulk notifications
const validateBulkNotifications = [
  body("notifications")
    .isArray({ min: 1, max: 50 })
    .withMessage("Notifications must be an array with 1-50 items"),
  body("notifications.*.title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage(
      "Each notification title is required and must be less than 200 characters"
    ),
  body("notifications.*.message")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage(
      "Each notification message is required and must be less than 1000 characters"
    ),
  body("notifications.*.type")
    .optional()
    .isIn(["info", "success", "warning", "error"])
    .withMessage(
      "Each notification type must be info, success, warning, or error"
    ),
  body("notifications.*.category")
    .optional()
    .isIn(["transaction", "budget", "alert", "system", "reminder"])
    .withMessage("Each notification category must be valid"),
];

// Validation middleware for notification preferences
const validateNotificationPreferences = [
  body("emailNotifications")
    .optional()
    .isBoolean()
    .withMessage("Email notifications must be boolean"),
  body("pushNotifications")
    .optional()
    .isBoolean()
    .withMessage("Push notifications must be boolean"),
  body("smsNotifications")
    .optional()
    .isBoolean()
    .withMessage("SMS notifications must be boolean"),
  body("categories")
    .optional()
    .isObject()
    .withMessage("Categories must be an object"),
  body("categories.transaction")
    .optional()
    .isBoolean()
    .withMessage("Transaction category preference must be boolean"),
  body("categories.budget")
    .optional()
    .isBoolean()
    .withMessage("Budget category preference must be boolean"),
  body("categories.alert")
    .optional()
    .isBoolean()
    .withMessage("Alert category preference must be boolean"),
  body("categories.system")
    .optional()
    .isBoolean()
    .withMessage("System category preference must be boolean"),
  body("categories.reminder")
    .optional()
    .isBoolean()
    .withMessage("Reminder category preference must be boolean"),
];

// Middleware to check if notification exists and belongs to user
const checkNotificationOwnership = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Notification belongs to another user",
      });
    }

    req.notification = notification;
    next();
  } catch (error) {
    console.error("Check notification ownership error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Middleware to log notification activities
const logNotificationActivity = (action) => {
  return (req, res, next) => {
    const startTime = Date.now();

    // Log the request
    console.log(`[${new Date().toISOString()}] Notification ${action}:`, {
      userId: req.user?.id,
      notificationId: req.params?.id,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function (body) {
      const duration = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] Notification ${action} completed:`,
        {
          userId: req.user?.id,
          success: body.success,
          duration: `${duration}ms`,
        }
      );
      return originalJson.call(this, body);
    };

    next();
  };
};

// Middleware to add cache headers for frequently accessed endpoints
const addCacheHeaders = (req, res, next) => {
  // Set cache headers for GET requests
  if (req.method === "GET") {
    res.set("Cache-Control", "private, max-age=300"); // 5 minutes cache
  }
  next();
};

// Middleware to sanitize notification data
const sanitizeNotificationData = (req, res, next) => {
  if (req.body.title) {
    req.body.title = req.body.title.trim();
  }

  if (req.body.message) {
    req.body.message = req.body.message.trim();
  }

  // Remove any undefined or null values from metadata
  if (req.body.metadata) {
    req.body.metadata = Object.fromEntries(
      Object.entries(req.body.metadata).filter(([_, value]) => value != null)
    );
  }

  next();
};

// Rate limiting middleware for notification creation
const rateLimitNotificationCreation = (req, res, next) => {
  // This is a simple in-memory rate limiter
  // In production, use Redis or a proper rate limiting library
  if (!req.user.notificationRateLimit) {
    req.user.notificationRateLimit = {
      count: 0,
      resetTime: Date.now() + 60 * 60 * 1000, // 1 hour
    };
  }

  const now = Date.now();
  if (now > req.user.notificationRateLimit.resetTime) {
    req.user.notificationRateLimit = {
      count: 0,
      resetTime: now + 60 * 60 * 1000,
    };
  }

  const maxNotificationsPerHour = 100;
  if (req.user.notificationRateLimit.count >= maxNotificationsPerHour) {
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded. Maximum 100 notifications per hour.",
      resetTime: new Date(
        req.user.notificationRateLimit.resetTime
      ).toISOString(),
    });
  }

  req.user.notificationRateLimit.count++;
  next();
};

module.exports = {
  validateCreateNotification,
  validateNotificationQuery,
  validateNotificationId,
  validateStatisticsQuery,
  validateBulkNotifications,
  validateNotificationPreferences,
  checkNotificationOwnership,
  logNotificationActivity,
  addCacheHeaders,
  sanitizeNotificationData,
  rateLimitNotificationCreation,
};
