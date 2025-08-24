const { validationResult } = require("express-validator");
const Notification = require("../models/Notification");

class AlertController {
  // Create a new notification/alert
  static async createAlert(req, res) {
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
        message: "Alert created successfully",
        notification,
      });
    } catch (error) {
      console.error("Create alert error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while creating alert",
      });
    }
  }

  // Get user notifications with filtering and pagination
  static async getAlerts(req, res) {
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
      console.error("Get alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching alerts",
      });
    }
  }

  // Get recent notifications (last 24 hours)
  static async getRecentAlerts(req, res) {
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
      console.error("Get recent alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching recent alerts",
      });
    }
  }

  // Get single notification
  static async getAlert(req, res) {
    try {
      const notification = await Notification.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Alert not found",
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
      console.error("Get alert error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching alert",
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    try {
      const notification = await Notification.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Alert not found",
        });
      }

      if (notification.isRead) {
        return res.json({
          success: true,
          message: "Alert was already marked as read",
          notification,
        });
      }

      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      res.json({
        success: true,
        message: "Alert marked as read",
        notification,
      });
    } catch (error) {
      console.error("Mark alert as read error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while marking alert as read",
      });
    }
  }

  // Mark notification as unread
  static async markAsUnread(req, res) {
    try {
      const notification = await Notification.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Alert not found",
        });
      }

      if (!notification.isRead) {
        return res.json({
          success: true,
          message: "Alert was already marked as unread",
          notification,
        });
      }

      notification.isRead = false;
      notification.readAt = null;
      await notification.save();

      res.json({
        success: true,
        message: "Alert marked as unread",
        notification,
      });
    } catch (error) {
      console.error("Mark alert as unread error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while marking alert as unread",
      });
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(req, res) {
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
        message: `${result.modifiedCount} alerts marked as read`,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Mark all alerts as read error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while marking all alerts as read",
      });
    }
  }

  // Delete notification
  static async deleteAlert(req, res) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Alert not found",
        });
      }

      res.json({
        success: true,
        message: "Alert deleted successfully",
      });
    } catch (error) {
      console.error("Delete alert error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while deleting alert",
      });
    }
  }

  // Delete all read notifications
  static async clearReadAlerts(req, res) {
    try {
      const result = await Notification.deleteMany({
        userId: req.user.id,
        isRead: true,
      });

      res.json({
        success: true,
        message: `${result.deletedCount} read alerts cleared`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error("Clear read alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while clearing read alerts",
      });
    }
  }

  // Delete all notifications
  static async clearAllAlerts(req, res) {
    try {
      const result = await Notification.deleteMany({
        userId: req.user.id,
      });

      res.json({
        success: true,
        message: `${result.deletedCount} alerts cleared`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error("Clear all alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while clearing all alerts",
      });
    }
  }

  // Create multiple notifications
  static async createBulkAlerts(req, res) {
    try {
      const { notifications } = req.body;

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Notifications array is required and cannot be empty",
        });
      }

      if (notifications.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Cannot create more than 100 notifications at once",
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
        message: `${createdNotifications.length} alerts created successfully`,
        notifications: createdNotifications,
      });
    } catch (error) {
      console.error("Bulk create alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while creating bulk alerts",
      });
    }
  }

  // Get notification statistics
  static async getAlertStatistics(req, res) {
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
        case "all":
          startDate = new Date(0); // Beginning of time
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
        dailyStats,
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
        Notification.aggregate([
          { $match: { userId, createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
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
          dailyStats,
          recentNotifications,
          period,
        },
      });
    } catch (error) {
      console.error("Get alert statistics error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching alert statistics",
      });
    }
  }

  // Update notification preferences
  static async updateAlertPreferences(req, res) {
    try {
      const {
        emailNotifications,
        pushNotifications,
        smsNotifications,
        categories,
        frequency,
        quietHours,
      } = req.body;

      // In a real app, you would update user preferences in the User model
      // For now, we'll validate and return the preferences
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
        frequency: frequency || "instant", // instant, hourly, daily
        quietHours: quietHours || {
          enabled: false,
          start: "22:00",
          end: "08:00",
        },
        updatedAt: new Date(),
      };

      // TODO: Update user preferences in database
      // await User.findByIdAndUpdate(req.user.id, { notificationPreferences: preferences });

      res.json({
        success: true,
        message: "Alert preferences updated successfully",
        preferences,
      });
    } catch (error) {
      console.error("Update alert preferences error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating alert preferences",
      });
    }
  }

  // Helper method to create system notification
  static async createSystemAlert(userId, title, message, options = {}) {
    try {
      const notification = new Notification({
        userId,
        title,
        message,
        type: options.type || "system",
        category: options.category || "system",
        actionUrl: options.actionUrl,
        metadata: options.metadata || {},
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error("Create system alert error:", error);
      throw error;
    }
  }

  // Helper method to get unread count for a user
  static async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        userId,
        isRead: false,
      });
    } catch (error) {
      console.error("Get unread count error:", error);
      return 0;
    }
  }
}

module.exports = AlertController;
