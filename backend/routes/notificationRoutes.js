const express = require("express");
const Notification = require("../models/Notification");
const notificationController = require("../controllers/notificationController");
const { auth } = require("../middlewares/authMiddleware");
const { body } = require("express-validator");

// @route   POST /api/notification
// @desc    Create a new notification
// @access  Private
const router = express.Router();

// Validation array for creating notifications
const createNotificationValidation = [
  body("title")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Notification title is required"),
  body("message")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Notification message is required"),
  body("type")
    .optional()
    .isIn(["info", "success", "warning", "error"])
    .withMessage("Type must be info, success, warning, or error"),
  body("category")
    .optional()
    .isIn([
      "transaction",
      "budget",
      "alert",
      "system",
      "reminder",
      "security",
      "update",
    ])
    .withMessage("Invalid category"),
];

// @route   POST /api/notification
router.post("/", auth, createNotificationValidation, (req, res, next) =>
  notificationController.createNotification(req, res, next, Notification)
);

// @route   GET /api/notification
router.get("/", auth, (req, res, next) =>
  notificationController.getNotifications(req, res, next, Notification)
);

// @route   GET /api/notification/recent
router.get("/recent", auth, (req, res, next) =>
  notificationController.getRecentNotifications(req, res, next, Notification)
);

// @route   GET /api/notification/:id
router.get("/:id", auth, (req, res, next) =>
  notificationController.getNotification(req, res, next, Notification)
);

// @route   PUT /api/notification/:id/read
router.put("/:id/read", auth, (req, res, next) =>
  notificationController.markAsRead(req, res, next, Notification)
);

// @route   PUT /api/notification/:id/unread
router.put("/:id/unread", auth, (req, res, next) =>
  notificationController.markAsUnread(req, res, next, Notification)
);

// @route   PUT /api/notification/read-all
router.put("/read-all", auth, (req, res, next) =>
  notificationController.markAllAsRead(req, res, next, Notification)
);

// @route   DELETE /api/notification/:id
router.delete("/:id", auth, (req, res, next) =>
  notificationController.deleteNotification(req, res, next, Notification)
);

// @route   DELETE /api/notification/clear-read
router.delete("/clear-read", auth, (req, res, next) =>
  notificationController.clearReadNotifications(req, res, next, Notification)
);

// @route   DELETE /api/notification/clear-all
router.delete("/clear-all", auth, (req, res, next) =>
  notificationController.clearAllNotifications(req, res, next, Notification)
);

// @route   POST /api/notification/bulk
router.post("/bulk", auth, (req, res, next) =>
  notificationController.bulkCreateNotifications(req, res, next, Notification)
);

// @route   GET /api/notification/statistics
router.get("/statistics", auth, (req, res, next) =>
  notificationController.getNotificationStatistics(req, res, next, Notification)
);

// @route   POST /api/notification/preferences
router.post("/preferences", auth, (req, res, next) =>
  notificationController.updatePreferences(req, res, next, Notification)
);

module.exports = router;
