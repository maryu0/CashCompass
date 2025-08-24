const express = require("express");
const { body, validationResult } = require("express-validator");
const Notification = require("../models/Notification");
// const auth = require("../middleware/auth");
const notificationMiddleware = require("../middlewares/notificationMiddleware");

const router = express.Router();

// @route   POST /api/notification
// @desc    Create a new notification
// @access  Private
router.post(
  "/",
  notificationMiddleware,
  [
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
      .isIn(["transaction", "budget", "alert", "system", "reminder"])
      .withMessage("Invalid category"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { title, message, type, category, actionUrl, metadata } = req.body;

      const notification = new Notification({
        userId: req.user.id,
        title,
        message,
        type: type || "info",
        category: category || "system",
        actionUrl,
        metadata: metadata || {},
      });

      await notification.save();

      res.status(201).json({
        success: true,
        message: "Notification created successfully",
        notification,
      });
    } catch (error) {
      console.error("Create notification error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   GET /api/notification
// @desc    Get user notifications
// @access  Private
router.get("/", notificationMiddleware, async (req, res) => {
  try {
    const {
      read,
      type,
      category,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { userId: req.user.id };

    if (read !== undefined) {
      query.isRead = read === "true";
    }

    if (type) {
      query.type = type;
    }

    if (category) {
      query.category = category;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: req.user.id, isRead: false }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current: pageNum,
          pages: totalPages,
          total,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/notification/recent
// @desc    Get recent notifications (last 24 hours)
// @access  Private
router.get("/recent", notificationMiddleware, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const notifications = await Notification.find({
      userId: req.user.id,
      createdAt: { $gte: twentyFourHoursAgo },
    }).sort({ createdAt: -1 });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        total: notifications.length,
      },
    });
  } catch (error) {
    console.error("Get recent notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/notification/:id
// @desc    Get single notification
// @access  Private
router.get("/:id", notificationMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Mark as read when viewed
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Get notification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/notification/:id/read
// @desc    Mark notification as read
// @access  Private
router.put("/:id/read", notificationMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/notification/:id/unread
// @desc    Mark notification as unread
// @access  Private
router.put("/:id/unread", notificationMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.isRead = false;
    notification.readAt = null;
    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as unread",
      notification,
    });
  } catch (error) {
    console.error("Mark notification as unread error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/notification/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put("/read-all", notificationMiddleware, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   DELETE /api/notification/:id
// @desc    Delete notification
// @access  Private
router.delete("/:id", notificationMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   DELETE /api/notification/clear-read
// @desc    Delete all read notifications
// @access  Private
router.delete("/clear-read", notificationMiddleware, async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user.id,
      isRead: true,
    });

    res.json({
      success: true,
      message: `${result.deletedCount} read notifications cleared`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Clear read notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   DELETE /api/notification/clear-all
// @desc    Delete all notifications
// @access  Private
router.delete("/clear-all", notificationMiddleware, async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user.id,
    });

    res.json({
      success: true,
      message: `${result.deletedCount} notifications cleared`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Clear all notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/notification/bulk
// @desc    Create multiple notifications
// @access  Private
router.post("/bulk", notificationMiddleware, async (req, res) => {
  try {
    const { notifications } = req.body;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Notifications array is required",
      });
    }

    // Validate and format notifications
    const validatedNotifications = [];
    const errors = [];

    for (let i = 0; i < notifications.length; i++) {
      const notif = notifications[i];

      if (!notif.title || notif.title.trim().length === 0) {
        errors.push(`Notification ${i + 1}: Title is required`);
        continue;
      }

      if (!notif.message || notif.message.trim().length === 0) {
        errors.push(`Notification ${i + 1}: Message is required`);
        continue;
      }

      if (
        notif.type &&
        !["info", "success", "warning", "error"].includes(notif.type)
      ) {
        errors.push(`Notification ${i + 1}: Invalid type`);
        continue;
      }

      if (
        notif.category &&
        !["transaction", "budget", "alert", "system", "reminder"].includes(
          notif.category
        )
      ) {
        errors.push(`Notification ${i + 1}: Invalid category`);
        continue;
      }

      validatedNotifications.push({
        userId: req.user.id,
        title: notif.title.trim(),
        message: notif.message.trim(),
        type: notif.type || "info",
        category: notif.category || "system",
        actionUrl: notif.actionUrl,
        metadata: notif.metadata || {},
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors,
      });
    }

    // Create all notifications
    const createdNotifications = await Notification.insertMany(
      validatedNotifications
    );

    res.status(201).json({
      success: true,
      message: `${createdNotifications.length} notifications created successfully`,
      notifications: createdNotifications,
    });
  } catch (error) {
    console.error("Bulk create notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/notification/statistics
// @desc    Get notification statistics
// @access  Private
router.get("/statistics", notificationMiddleware, async (req, res) => {
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
      default:
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
    }

    const [
      totalNotifications,
      unreadNotifications,
      notificationsByType,
      notificationsByCategory,
      recentNotifications,
    ] = await Promise.all([
      Notification.countDocuments({ userId, createdAt: { $gte: startDate } }),
      Notification.countDocuments({ userId, isRead: false }),
      Notification.aggregate([
        { $match: { userId, createdAt: { $gte: startDate } } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Notification.aggregate([
        { $match: { userId, createdAt: { $gte: startDate } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title type category createdAt isRead"),
    ]);

    // Format type breakdown
    const typeBreakdown = {};
    notificationsByType.forEach((item) => {
      typeBreakdown[item._id] = item.count;
    });

    // Format category breakdown
    const categoryBreakdown = {};
    notificationsByCategory.forEach((item) => {
      categoryBreakdown[item._id] = item.count;
    });

    res.json({
      success: true,
      data: {
        summary: {
          total: totalNotifications,
          unread: unreadNotifications,
          read: totalNotifications - unreadNotifications,
          readPercentage:
            totalNotifications > 0
              ? (
                  ((totalNotifications - unreadNotifications) /
                    totalNotifications) *
                  100
                ).toFixed(1)
              : 0,
        },
        breakdown: {
          byType: typeBreakdown,
          byCategory: categoryBreakdown,
        },
        recentNotifications,
        period,
      },
    });
  } catch (error) {
    console.error("Get notification statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/notification/preferences
// @desc    Update notification preferences
// @access  Private
router.post("/preferences", notificationMiddleware, async (req, res) => {
  try {
    const {
      emailNotifications,
      pushNotifications,
      smsNotifications,
      categories,
    } = req.body;

    // In a real app, you would update user preferences in the User model
    // For now, we'll just return success
    const preferences = {
      emailNotifications:
        emailNotifications !== undefined ? emailNotifications : true,
      pushNotifications:
        pushNotifications !== undefined ? pushNotifications : true,
      smsNotifications:
        smsNotifications !== undefined ? smsNotifications : false,
      categories: categories || {
        transaction: true,
        budget: true,
        alert: true,
        system: true,
        reminder: true,
      },
    };

    res.json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences,
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
