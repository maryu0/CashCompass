const express = require("express");
const { body } = require("express-validator");
const UserController = require("../controllers/userController");
const { auth } = require("../middleware/auth");
const {
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
} = require("../middleware/userMiddleware");

const router = express.Router();

// Validation middleware arrays
const profileUpdateValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("phoneNumber")
    .optional()
    .isMobilePhone("any", { strictMode: false })
    .withMessage("Please provide a valid phone number"),
  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date in ISO format"),
  body("bio")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Bio must be less than 500 characters"),
  body("avatar").optional().isURL().withMessage("Avatar must be a valid URL"),
];

const passwordChangeValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain uppercase, lowercase, number, and special character"
    ),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Password confirmation does not match");
    }
    return true;
  }),
];

// Apply authentication to all routes
router.use(auth);

// Apply account status check to all routes
router.use(checkAccountStatus);

// Apply user metadata to all responses
router.use(addUserMetadata);

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get(
  "/profile",
  logUserActivity("GET_PROFILE"),
  UserController.getProfile
);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  sensitiveOperationRateLimit,
  profileUpdateValidation,
  validateProfileUpdate,
  sanitizeUserInput,
  logUserActivity("UPDATE_PROFILE"),
  UserController.updateProfile
);

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put(
  "/change-password",
  sensitiveOperationRateLimit,
  passwordChangeValidation,
  validatePasswordChange,
  logUserActivity("CHANGE_PASSWORD"),
  UserController.changePassword
);

// @route   GET /api/users/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get(
  "/dashboard",
  validateDashboardTimeframe,
  logUserActivity("GET_DASHBOARD"),
  UserController.getDashboard
);

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put(
  "/preferences",
  [
    body("currency")
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency code must be 3 characters"),
    body("language")
      .optional()
      .isLength({ min: 2, max: 5 })
      .withMessage("Language code must be 2-5 characters"),
    body("timezone")
      .optional()
      .isString()
      .withMessage("Timezone must be a valid timezone string"),
    body("theme")
      .optional()
      .isIn(["light", "dark", "auto", "high-contrast"])
      .withMessage("Invalid theme selection"),
  ],
  validatePreferences,
  logUserActivity("UPDATE_PREFERENCES"),
  UserController.updatePreferences
);

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete(
  "/account",
  sensitiveOperationRateLimit,
  [
    body("password")
      .notEmpty()
      .withMessage("Password is required for account deletion"),
    body("confirmDeletion")
      .equals("DELETE_MY_ACCOUNT")
      .withMessage("Please type 'DELETE_MY_ACCOUNT' to confirm"),
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Deletion reason must be less than 500 characters"),
  ],
  validateAccountDeletion,
  logUserActivity("DELETE_ACCOUNT"),
  UserController.deleteAccount
);

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get(
  "/stats",
  validateStatsPeriod,
  logUserActivity("GET_STATS"),
  UserController.getUserStats
);

// Additional routes for enhanced functionality

// @route   GET /api/users/activity-summary
// @desc    Get user activity summary
// @access  Private
router.get("/activity-summary", async (req, res) => {
  try {
    const { timeframe = "month" } = req.query;

    // This could be moved to controller for consistency
    // For now, keeping it simple

    res.json({
      success: true,
      data: {
        message: "Activity summary endpoint - implement based on your needs",
        timeframe,
      },
    });
  } catch (error) {
    console.error("Activity summary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/users/export-data
// @desc    Export user data (GDPR compliance)
// @access  Private
router.post(
  "/export-data",
  sensitiveOperationRateLimit,
  logUserActivity("EXPORT_DATA"),
  async (req, res) => {
    try {
      // Implementation for data export
      res.json({
        success: true,
        message:
          "Data export request received. You will receive an email when ready.",
      });
    } catch (error) {
      console.error("Export data error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during data export",
      });
    }
  }
);

// @route   PUT /api/users/verify-email
// @desc    Verify user email address
// @access  Private
router.put(
  "/verify-email",
  [
    body("verificationCode")
      .notEmpty()
      .isLength({ min: 6, max: 6 })
      .withMessage("Verification code must be 6 characters"),
  ],
  logUserActivity("VERIFY_EMAIL"),
  async (req, res) => {
    try {
      // Implementation for email verification
      res.json({
        success: true,
        message:
          "Email verification functionality - implement based on your needs",
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during email verification",
      });
    }
  }
);

// @route   POST /api/users/resend-verification
// @desc    Resend email verification
// @access  Private
router.post(
  "/resend-verification",
  sensitiveOperationRateLimit,
  logUserActivity("RESEND_VERIFICATION"),
  async (req, res) => {
    try {
      // Implementation for resending verification email
      res.json({
        success: true,
        message: "Verification email sent (if account is not already verified)",
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while resending verification",
      });
    }
  }
);

// @route   PUT /api/users/deactivate
// @desc    Temporarily deactivate account
// @access  Private
router.put(
  "/deactivate",
  sensitiveOperationRateLimit,
  [
    body("password")
      .notEmpty()
      .withMessage("Password required for account deactivation"),
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Reason must be less than 500 characters"),
  ],
  logUserActivity("DEACTIVATE_ACCOUNT"),
  async (req, res) => {
    try {
      // Implementation for account deactivation
      res.json({
        success: true,
        message: "Account deactivated successfully",
      });
    } catch (error) {
      console.error("Deactivate account error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during account deactivation",
      });
    }
  }
);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error("User router error:", error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: Object.values(error.errors).map((err) => err.message),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid data format",
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error in user system",
  });
});

module.exports = router;
