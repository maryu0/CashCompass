const express = require("express");
const { body } = require("express-validator");
const Notification = require("../models/Notification");
const alertController = require("../controllers/alertController");
const alertMiddleware = require("../middlewares/alertMiddleware");

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

// @route   POST /api/alert
router.post(
  "/",
  alertMiddleware,
  createNotificationValidation,
  (req, res, next) =>
    alertController.createNotification(req, res, next, Notification)
);

// @route   GET /api/alert
router.get("/", alertMiddleware, (req, res, next) =>
  alertController.getNotifications(req, res, next, Notification)
);

// @route   GET /api/alert/recent
router.get("/recent", alertMiddleware, (req, res, next) =>
  alertController.getRecentNotifications(req, res, next, Notification)
);

// @route   GET /api/alert/:id
router.get("/:id", alertMiddleware, (req, res, next) =>
  alertController.getNotification(req, res, next, Notification)
);

// @route   PUT /api/alert/:id/read
router.put("/:id/read", alertMiddleware, (req, res, next) =>
  alertController.markAsRead(req, res, next, Notification)
);

// @route   PUT /api/alert/:id/unread
router.put("/:id/unread", alertMiddleware, (req, res, next) =>
  alertController.markAsUnread(req, res, next, Notification)
);

// @route   PUT /api/alert/read-all
router.put("/read-all", alertMiddleware, (req, res, next) =>
  alertController.markAllAsRead(req, res, next, Notification)
);

// @route   DELETE /api/alert/:id
router.delete("/:id", alertMiddleware, (req, res, next) =>
  alertController.deleteNotification(req, res, next, Notification)
);

// @route   DELETE /api/alert/clear-read
router.delete("/clear-read", alertMiddleware, (req, res, next) =>
  alertController.clearReadNotifications(req, res, next, Notification)
);

// @route   DELETE /api/alert/clear-all
router.delete("/clear-all", alertMiddleware, (req, res, next) =>
  alertController.clearAllNotifications(req, res, next, Notification)
);

// @route   POST /api/alert/bulk
router.post("/bulk", alertMiddleware, (req, res, next) =>
  alertController.bulkCreateNotifications(req, res, next, Notification)
);

// @route   GET /api/alert/statistics
router.get("/statistics", alertMiddleware, (req, res, next) =>
  alertController.getNotificationStatistics(req, res, next, Notification)
);

// @route   POST /api/alert/preferences
router.post("/preferences", alertMiddleware, (req, res, next) =>
  alertController.updatePreferences(req, res, next, Notification)
);

module.exports = router;
