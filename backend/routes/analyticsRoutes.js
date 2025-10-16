const { query, validationResult } = require("express-validator");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Category = require("../models/Category");
const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const { auth } = require("../middlewares/authMiddleware");

const router = express.Router();

// @route   GET /api/analytics/overview
router.get("/overview", auth, (req, res, next) =>
  analyticsController.getOverview(req, res, next, {
    Transaction,
    Budget,
    Category,
  })
);

// @route   GET /api/analytics/spending-trends
router.get("/spending-trends", auth, (req, res, next) =>
  analyticsController.getSpendingTrends(req, res, next, {
    Transaction,
    Budget,
    Category,
  })
);

// @route   GET /api/analytics/category-breakdown
router.get("/category-breakdown", auth, (req, res, next) =>
  analyticsController.getCategoryBreakdown(req, res, next, {
    Transaction,
    Budget,
    Category,
  })
);

// @route   GET /api/analytics/budget-performance
router.get("/budget-performance", auth, (req, res, next) =>
  analyticsController.getBudgetPerformance(req, res, next, {
    Transaction,
    Budget,
    Category,
  })
);

// @route   GET /api/analytics/insights
router.get("/insights", auth, (req, res, next) =>
  analyticsController.getInsights(req, res, next, {
    Transaction,
    Budget,
    Category,
  })
);

// @route   GET /api/analytics/export
router.get("/export", auth, (req, res, next) =>
  analyticsController.exportAnalytics(req, res, next, {
    Transaction,
    Budget,
    Category,
  })
);

module.exports = router;
