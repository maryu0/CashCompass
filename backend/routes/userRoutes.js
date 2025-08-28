const express = require("express");
const UserController = require("../controllers/userRoutesController");
const userRouteMiddleware = require("../middlewares/userRoutesMiddleware");
const { body } = require("express-validator");

const router = express.Router();

// Validation middleware arrays
const profileValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("phoneNumber")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),
  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date"),
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
];

const passwordValidation = [
  body("currentPassword")
    .exists()
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6, max: 128 })
    .withMessage("New password must be between 6 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("New password must contain at least one lowercase letter, one uppercase letter, and one number"),
];

const preferencesValidation = [
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
];

// Stats query validation middleware
const validateStatsQuery = (req, res, next) => {
  const { period } = req.query;
  if (period && !["week", "month", "year"].includes(period)) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: [{
        param: "period",
        msg: "Period must be one of: week, month, year",
        location: "query"
      }]
    });
  }
  next();
};

// Account deletion confirmation middleware
const validateAccountDeletion = (req, res, next) => {
  const { confirmation } = req.body;
  if (!confirmation || confirmation !== "DELETE") {
    return res.status(400).json({
      success: false,
      message: "Account deletion requires confirmation. Please send 'DELETE' in the confirmation field.",
    });
  }
  next();
};

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", userRouteMiddleware, UserController.getProfile);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  userRouteMiddleware,
  profileValidation,
  UserController.updateProfile
);

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put(
  "/change-password",
  userRouteMiddleware,
  passwordValidation,
  UserController.changePassword
);

// @route   GET /api/users/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get("/dashboard", userRouteMiddleware, UserController.getDashboard);

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put(
  "/preferences",
  userRouteMiddleware,
  preferencesValidation,
  UserController.updatePreferences
);

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete(
  "/account",
  userRouteMiddleware,
  validateAccountDeletion,
  UserController.deleteAccount
);

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get(
  "/stats",
  userRouteMiddleware,
  validateStatsQuery,
  UserController.getStats
);

module.exports = router;