const User = require("../models/User");
const bcrypt = require("bcryptjs");

/**
 * Middleware to validate profile update data
 */
const validateProfileUpdate = (req, res, next) => {
  try {
    const { name, email, phoneNumber, dateOfBirth, bio, avatar } = req.body;

    // Validate name length
    if (name && (name.trim().length < 2 || name.trim().length > 50)) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters",
      });
    }

    // Validate email format (basic validation, express-validator handles detailed)
    if (email && !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate date of birth
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const currentDate = new Date();
      const age = currentDate.getFullYear() - birthDate.getFullYear();

      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date of birth format",
        });
      }

      if (age < 13 || age > 150) {
        return res.status(400).json({
          success: false,
          message: "Age must be between 13 and 150 years",
        });
      }
    }

    // Validate bio length
    if (bio && bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Bio must be less than 500 characters",
      });
    }

    // Validate avatar URL
    if (avatar) {
      try {
        new URL(avatar);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid avatar URL format",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Profile validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during profile validation",
    });
  }
};

/**
 * Middleware to validate password change requirements
 */
const validatePasswordChange = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Check if all required fields are present
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Check if confirmation password matches (if provided)
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation password don't match",
      });
    }

    // Password strength validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    // Check if new password is same as current (will be checked in controller too)
    const user = await User.findById(req.user.id).select("+password");
    if (user) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: "New password must be different from current password",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Password validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password validation",
    });
  }
};

/**
 * Middleware to validate user preferences
 */
const validatePreferences = (req, res, next) => {
  try {
    const { currency, language, timezone, theme, dateFormat, notifications } =
      req.body;

    // Validate currency
    if (currency) {
      const validCurrencies = [
        "USD",
        "EUR",
        "GBP",
        "JPY",
        "CAD",
        "AUD",
        "CHF",
        "CNY",
        "INR",
        "BTC",
        "ETH",
      ];
      if (!validCurrencies.includes(currency.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid currency. Valid options: ${validCurrencies.join(
            ", "
          )}`,
        });
      }
    }

    // Validate language
    if (language) {
      const validLanguages = [
        "en",
        "es",
        "fr",
        "de",
        "it",
        "pt",
        "ru",
        "zh",
        "ja",
        "ko",
        "ar",
        "hi",
      ];
      if (!validLanguages.includes(language.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid language. Valid options: ${validLanguages.join(
            ", "
          )}`,
        });
      }
    }

    // Validate timezone
    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid timezone",
        });
      }
    }

    // Validate theme
    if (theme) {
      const validThemes = ["light", "dark", "auto", "high-contrast"];
      if (!validThemes.includes(theme)) {
        return res.status(400).json({
          success: false,
          message: `Invalid theme. Valid options: ${validThemes.join(", ")}`,
        });
      }
    }

    // Validate date format
    if (dateFormat) {
      const validDateFormats = [
        "MM/DD/YYYY",
        "DD/MM/YYYY",
        "YYYY-MM-DD",
        "DD-MM-YYYY",
      ];
      if (!validDateFormats.includes(dateFormat)) {
        return res.status(400).json({
          success: false,
          message: `Invalid date format. Valid options: ${validDateFormats.join(
            ", "
          )}`,
        });
      }
    }

    // Validate notifications object
    if (notifications && typeof notifications === "object") {
      const validNotificationTypes = ["email", "push", "sms", "browser"];
      const validNotificationCategories = [
        "transactions",
        "budgets",
        "bills",
        "goals",
        "security",
      ];

      for (const type of validNotificationTypes) {
        if (
          notifications[type] !== undefined &&
          typeof notifications[type] !== "boolean"
        ) {
          return res.status(400).json({
            success: false,
            message: `Notification preference '${type}' must be boolean`,
          });
        }
      }

      if (notifications.categories) {
        for (const category of validNotificationCategories) {
          if (
            notifications.categories[category] !== undefined &&
            typeof notifications.categories[category] !== "boolean"
          ) {
            return res.status(400).json({
              success: false,
              message: `Notification category '${category}' must be boolean`,
            });
          }
        }
      }
    }

    next();
  } catch (error) {
    console.error("Preferences validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during preferences validation",
    });
  }
};

/**
 * Middleware to validate account deletion requirements
 */
const validateAccountDeletion = async (req, res, next) => {
  try {
    const { password, confirmDeletion, reason } = req.body;

    // Require password verification
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password verification is required for account deletion",
      });
    }

    // Require explicit confirmation
    if (confirmDeletion !== "DELETE_MY_ACCOUNT") {
      return res.status(400).json({
        success: false,
        message: "Please type 'DELETE_MY_ACCOUNT' to confirm account deletion",
      });
    }

    // Optional: Log deletion reason for analytics
    if (reason) {
      console.log(`Account deletion reason for user ${req.user.id}: ${reason}`);
    }

    next();
  } catch (error) {
    console.error("Account deletion validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during account deletion validation",
    });
  }
};

/**
 * Middleware to validate statistics period
 */
const validateStatsPeriod = (req, res, next) => {
  try {
    const { period } = req.query;

    if (period) {
      const validPeriods = ["week", "month", "quarter", "year", "all"];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: `Invalid period. Valid options: ${validPeriods.join(", ")}`,
        });
      }
    }

    next();
  } catch (error) {
    console.error("Stats period validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during period validation",
    });
  }
};

/**
 * Middleware to validate dashboard timeframe
 */
const validateDashboardTimeframe = (req, res, next) => {
  try {
    const { timeframe } = req.query;

    if (timeframe) {
      const validTimeframes = ["week", "month", "quarter", "year"];
      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({
          success: false,
          message: `Invalid timeframe. Valid options: ${validTimeframes.join(
            ", "
          )}`,
        });
      }
    }

    next();
  } catch (error) {
    console.error("Dashboard timeframe validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during timeframe validation",
    });
  }
};

/**
 * Middleware to sanitize user input
 */
const sanitizeUserInput = (req, res, next) => {
  try {
    // Sanitize string fields
    const stringFields = ["name", "bio", "avatar"];

    for (const field of stringFields) {
      if (req.body[field] && typeof req.body[field] === "string") {
        // Trim whitespace
        req.body[field] = req.body[field].trim();

        // Remove potentially dangerous characters
        req.body[field] = req.body[field].replace(/[<>]/g, "");
      }
    }

    // Sanitize email
    if (req.body.email) {
      req.body.email = req.body.email.trim().toLowerCase();
    }

    // Sanitize phone number (remove non-digit characters except +)
    if (req.body.phoneNumber) {
      req.body.phoneNumber = req.body.phoneNumber.replace(/[^\d+\-\s()]/g, "");
    }

    next();
  } catch (error) {
    console.error("Input sanitization error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during input sanitization",
    });
  }
};

/**
 * Middleware to check if user account is active
 */
const checkAccountStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "isActive isVerified accountStatus"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account is suspended. Please contact support.",
      });
    }

    // Attach user status to request
    req.userStatus = {
      isActive: user.isActive,
      isVerified: user.isVerified,
      accountStatus: user.accountStatus,
    };

    next();
  } catch (error) {
    console.error("Account status check error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during account status check",
    });
  }
};

/**
 * Middleware for user activity logging
 */
const logUserActivity = (action) => {
  return (req, res, next) => {
    try {
      const originalSend = res.json;

      res.json = function (data) {
        // Log successful operations
        if (data && data.success) {
          console.log(
            `[USER_ACTIVITY] User ${req.user.id} performed ${action}`,
            {
              userId: req.user.id,
              action,
              timestamp: new Date().toISOString(),
              ip: req.ip,
              userAgent: req.get("User-Agent"),
              success: data.success,
            }
          );

          // For sensitive operations, log additional details
          if (
            ["CHANGE_PASSWORD", "DELETE_ACCOUNT", "UPDATE_EMAIL"].includes(
              action
            )
          ) {
            console.log(
              `[SECURITY] Sensitive operation: ${action} by user ${req.user.id}`,
              {
                userId: req.user.id,
                action,
                timestamp: new Date().toISOString(),
                ip: req.ip,
              }
            );
          }
        }

        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error("Activity logging error:", error);
      next(); // Continue without logging
    }
  };
};

/**
 * Rate limiting middleware for sensitive operations
 */
const sensitiveOperationRateLimit = (() => {
  const userAttempts = new Map();
  const WINDOW_SIZE = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 3; // 3 attempts per 15 minutes

  return (req, res, next) => {
    try {
      const userId = req.user.id;
      const now = Date.now();

      // Clean up old entries
      for (const [id, data] of userAttempts.entries()) {
        if (now - data.firstAttempt > WINDOW_SIZE) {
          userAttempts.delete(id);
        }
      }

      const userLimit = userAttempts.get(userId);

      if (!userLimit) {
        userAttempts.set(userId, { count: 1, firstAttempt: now });
        return next();
      }

      if (now - userLimit.firstAttempt > WINDOW_SIZE) {
        userAttempts.set(userId, { count: 1, firstAttempt: now });
        return next();
      }

      if (userLimit.count >= MAX_ATTEMPTS) {
        return res.status(429).json({
          success: false,
          message:
            "Too many sensitive operations. Please try again in 15 minutes.",
        });
      }

      userLimit.count++;
      next();
    } catch (error) {
      console.error("Sensitive operation rate limit error:", error);
      next(); // Continue on error
    }
  };
})();

/**
 * Middleware to validate user data completeness for certain operations
 */
const requireCompleteProfile = (req, res, next) => {
  try {
    // This middleware can be used for operations that require complete profile
    // Implementation depends on what fields you consider "required"

    if (!req.userData) {
      return res.status(400).json({
        success: false,
        message: "User data not available",
      });
    }

    const requiredFields = ["name", "email"];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!req.userData[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please complete your profile. Missing fields: ${missingFields.join(
          ", "
        )}`,
        missingFields,
      });
    }

    next();
  } catch (error) {
    console.error("Complete profile check error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during profile completeness check",
    });
  }
};

/**
 * Middleware to add user metadata to responses
 */
const addUserMetadata = async (req, res, next) => {
  try {
    const originalSend = res.json;

    res.json = async function (data) {
      if (data && data.success && req.user) {
        try {
          const user = await User.findById(req.user.id).select(
            "preferences lastLogin timezone"
          );

          if (user && data.data) {
            data.userMetadata = {
              timezone: user.preferences?.timezone || "UTC",
              lastLogin: user.lastLogin,
              serverTime: new Date().toISOString(),
            };
          }
        } catch (error) {
          console.error("Add user metadata error:", error);
          // Don't fail the request if metadata fails
        }
      }

      return originalSend.call(this, data);
    };

    next();
  } catch (error) {
    console.error("User metadata middleware error:", error);
    next(); // Continue without adding metadata
  }
};

module.exports = {
  validateProfileUpdate,
  validatePasswordChange,
  validatePreferences,
  validateAccountDeletion,
  validateStatsPeriod,
  validateDashboardTimeframe,
  sanitizeUserInput,
  checkAccountStatus,
  logUserActivity,
  sensitiveOperationRateLimit,
  requireCompleteProfile,
  addUserMetadata,
};
