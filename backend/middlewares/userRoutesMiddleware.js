const { body } = require("express-validator");

class UserValidation {
  // Validation rules for updating profile
  static updateProfile() {
    return [
      body("name")
        .optional()
        .trim()
        .isLength({ min: 2 })
        .withMessage("Name must be at least 2 characters")
        .isLength({ max: 50 })
        .withMessage("Name must not exceed 50 characters"),

      body("email")
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email")
        .isLength({ max: 100 })
        .withMessage("Email must not exceed 100 characters"),

      body("phoneNumber")
        .optional()
        .isMobilePhone()
        .withMessage("Please provide a valid phone number"),

      body("dateOfBirth")
        .optional()
        .isISO8601()
        .withMessage("Please provide a valid date")
        .custom((value) => {
          const date = new Date(value);
          const now = new Date();
          const age = now.getFullYear() - date.getFullYear();
          if (age < 13 || age > 120) {
            throw new Error("Age must be between 13 and 120 years");
          }
          return true;
        }),

      body("currency")
        .optional()
        .isAlpha()
        .isLength({ min: 3, max: 3 })
        .withMessage("Currency must be a valid 3-letter code (e.g., USD, EUR)"),

      body("language")
        .optional()
        .isAlpha()
        .isLength({ min: 2, max: 5 })
        .withMessage("Language must be a valid language code"),

      body("timezone")
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage("Please provide a valid timezone"),
    ];
  }

  // Validation rules for changing password
  static changePassword() {
    return [
      body("currentPassword")
        .exists()
        .withMessage("Current password is required")
        .notEmpty()
        .withMessage("Current password cannot be empty"),

      body("newPassword")
        .isLength({ min: 6 })
        .withMessage("New password must be at least 6 characters")
        .isLength({ max: 128 })
        .withMessage("New password must not exceed 128 characters")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage(
          "New password must contain at least one lowercase letter, one uppercase letter, and one number"
        ),

      body("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error("Password confirmation does not match new password");
        }
        return true;
      }),
    ];
  }

  // Validation rules for updating preferences
  static updatePreferences() {
    return [
      body("currency")
        .optional()
        .isAlpha()
        .isLength({ min: 3, max: 3 })
        .withMessage("Currency must be a valid 3-letter code"),

      body("language")
        .optional()
        .isAlpha()
        .isLength({ min: 2, max: 5 })
        .withMessage("Language must be a valid language code"),

      body("timezone")
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage("Please provide a valid timezone"),

      body("theme")
        .optional()
        .isIn(["light", "dark", "system"])
        .withMessage("Theme must be one of: light, dark, system"),

      body("notifications")
        .optional()
        .isObject()
        .withMessage("Notifications must be an object"),

      body("notifications.email")
        .optional()
        .isBoolean()
        .withMessage("Email notification setting must be a boolean"),

      body("notifications.push")
        .optional()
        .isBoolean()
        .withMessage("Push notification setting must be a boolean"),

      body("notifications.sms")
        .optional()
        .isBoolean()
        .withMessage("SMS notification setting must be a boolean"),

      body("notifications.budgetAlerts")
        .optional()
        .isBoolean()
        .withMessage("Budget alerts setting must be a boolean"),

      body("notifications.transactionAlerts")
        .optional()
        .isBoolean()
        .withMessage("Transaction alerts setting must be a boolean"),
    ];
  }

  // Validation rules for stats query parameters
  static getStats() {
    return [
      // Using query validation for GET request
      body("period")
        .optional()
        .isIn(["week", "month", "year"])
        .withMessage("Period must be one of: week, month, year"),
    ];
  }

  // Custom middleware to validate query parameters for stats
  static validateStatsQuery(req, res, next) {
    const { period } = req.query;

    if (period && !["week", "month", "year"].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: [
          {
            param: "period",
            msg: "Period must be one of: week, month, year",
            location: "query",
          },
        ],
      });
    }

    next();
  }

  // Custom middleware to validate account deletion
  static validateAccountDeletion(req, res, next) {
    const { confirmation } = req.body;

    if (!confirmation || confirmation !== "DELETE") {
      return res.status(400).json({
        success: false,
        message:
          "Account deletion requires confirmation. Please send 'DELETE' in the confirmation field.",
      });
    }

    next();
  }

  // Sanitize user input
  static sanitizeUserInput(req, res, next) {
    // Remove any potential XSS or injection attempts from string fields
    const sanitizeString = (str) => {
      if (typeof str !== "string") return str;
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "")
        .trim();
    };

    // Sanitize common fields
    if (req.body.name) req.body.name = sanitizeString(req.body.name);
    if (req.body.phoneNumber)
      req.body.phoneNumber = sanitizeString(req.body.phoneNumber);
    if (req.body.timezone)
      req.body.timezone = sanitizeString(req.body.timezone);
    if (req.body.language)
      req.body.language = sanitizeString(req.body.language);
    if (req.body.currency)
      req.body.currency = sanitizeString(req.body.currency);

    next();
  }
}

module.exports = UserValidation;
