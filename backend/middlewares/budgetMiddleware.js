const { body, param, query, validationResult } = require("express-validator");
const Budget = require("../models/Budget");

class BudgetMiddleware {
  // Validation middleware for creating budget
  static validateCreateBudget() {
    return [
      body("name")
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage(
          "Budget name is required and must be between 1-100 characters"
        ),
      body("amount")
        .isFloat({ min: 0.01 })
        .withMessage("Budget amount must be a positive number"),
      body("category")
        .optional()
        .isMongoId()
        .withMessage("Valid category ID is required"),
      body("period")
        .isIn(["weekly", "monthly", "yearly"])
        .withMessage("Period must be weekly, monthly, or yearly"),
      body("startDate")
        .isISO8601()
        .withMessage("Valid start date is required")
        .custom((value, { req }) => {
          const startDate = new Date(value);
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          if (startDate < now) {
            throw new Error("Start date cannot be in the past");
          }
          return true;
        }),
      body("endDate").isISO8601().withMessage("Valid end date is required"),
      body("alertThreshold")
        .optional()
        .isFloat({ min: 1, max: 100 })
        .withMessage("Alert threshold must be between 1-100"),
      this.handleValidationErrors,
    ];
  }

  // Validation middleware for updating budget
  static validateUpdateBudget() {
    return [
      param("id").isMongoId().withMessage("Valid budget ID is required"),
      body("name")
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Budget name must be between 1-100 characters"),
      body("amount")
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage("Budget amount must be a positive number"),
      body("category")
        .optional()
        .isMongoId()
        .withMessage("Valid category ID is required"),
      body("period")
        .optional()
        .isIn(["weekly", "monthly", "yearly"])
        .withMessage("Period must be weekly, monthly, or yearly"),
      body("startDate")
        .optional()
        .isISO8601()
        .withMessage("Valid start date is required"),
      body("endDate")
        .optional()
        .isISO8601()
        .withMessage("Valid end date is required"),
      body("alertThreshold")
        .optional()
        .isFloat({ min: 1, max: 100 })
        .withMessage("Alert threshold must be between 1-100"),
      this.handleValidationErrors,
    ];
  }

  // Validation middleware for budget queries
  static validateBudgetQuery() {
    return [
      query("active")
        .optional()
        .isIn(["true", "false"])
        .withMessage("Active filter must be true or false"),
      query("period")
        .optional()
        .isIn(["weekly", "monthly", "yearly"])
        .withMessage("Period must be weekly, monthly, or yearly"),
      query("category")
        .optional()
        .isMongoId()
        .withMessage("Valid category ID is required"),
      query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1-100"),
      query("offset")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Offset must be a non-negative number"),
      this.handleValidationErrors,
    ];
  }

  // Validation middleware for budget ID parameter
  static validateBudgetId() {
    return [
      param("id").isMongoId().withMessage("Valid budget ID is required"),
      this.handleValidationErrors,
    ];
  }

  // Rate limiting middleware for budget operations
  static rateLimit() {
    const rateLimitMap = new Map();

    return (req, res, next) => {
      const userId = req.user?.id;
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute
      const maxRequests = 50; // 50 requests per minute per user

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const userKey = `budget_${userId}`;
      const userRequests = rateLimitMap.get(userKey) || [];

      // Remove old requests outside the window
      const validRequests = userRequests.filter(
        (timestamp) => now - timestamp < windowMs
      );

      if (validRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000),
        });
      }

      // Add current request
      validRequests.push(now);
      rateLimitMap.set(userKey, validRequests);

      // Clean up old entries periodically
      if (Math.random() < 0.01) {
        this.cleanupRateLimit(rateLimitMap, windowMs);
      }

      next();
    };
  }

  // Cache middleware for budget data
  static cache(duration = 3 * 60 * 1000) {
    // 3 minutes default
    const cache = new Map();

    return (req, res, next) => {
      const userId = req.user?.id;
      const method = req.method;

      // Only cache GET requests
      if (method !== "GET") {
        return next();
      }

      const cacheKey = `${req.originalUrl}_${userId}`;
      const now = Date.now();

      const cached = cache.get(cacheKey);
      if (cached && now - cached.timestamp < duration) {
        return res.json(cached.data);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function (data) {
        if (res.statusCode === 200 && data.success) {
          cache.set(cacheKey, {
            data,
            timestamp: now,
          });
        }
        return originalJson.call(this, data);
      };

      // Clean up expired cache entries periodically
      if (Math.random() < 0.01) {
        this.cleanupCache(cache, duration);
      }

      next();
    };
  }

  // Security middleware to ensure budget ownership
  static ensureBudgetOwnership() {
    return async (req, res, next) => {
      try {
        const budgetId = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            success: false,
            message: "Authentication required",
          });
        }

        if (!budgetId) {
          return next();
        }

        const budget = await Budget.findOne({ _id: budgetId, userId });

        if (!budget) {
          return res.status(404).json({
            success: false,
            message: "Budget not found or access denied",
          });
        }

        // Add budget to request for use in controller
        req.budget = budget;
        next();
      } catch (error) {
        console.error("Budget ownership check error:", error);
        res.status(500).json({
          success: false,
          message: "Server error",
        });
      }
    };
  }

  // Logging middleware for budget operations
  static logRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      const userId = req.user?.id;
      const method = req.method;
      const endpoint = req.route?.path || req.path;
      const budgetId = req.params.id;

      // Log request start
      console.log(
        `[Budget] ${new Date().toISOString()} - User ${userId} ${method} ${endpoint}${
          budgetId ? ` (Budget: ${budgetId})` : ""
        }`
      );

      // Override res.json to log response
      const originalJson = res.json;
      res.json = function (data) {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        console.log(
          `[Budget] ${new Date().toISOString()} - User ${userId} ${method} ${endpoint} - ${status} - ${duration}ms`
        );

        if (status >= 400) {
          console.error(
            `[Budget Error] User ${userId} ${method} ${endpoint}:`,
            data.message || "Unknown error"
          );
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  // Budget data sanitization middleware
  static sanitizeBudgetData() {
    return (req, res, next) => {
      // Sanitize numeric fields
      if (req.body.amount) {
        req.body.amount = parseFloat(req.body.amount);
        if (isNaN(req.body.amount) || req.body.amount <= 0) {
          delete req.body.amount;
        }
      }

      if (req.body.alertThreshold) {
        req.body.alertThreshold = parseInt(req.body.alertThreshold);
        if (
          isNaN(req.body.alertThreshold) ||
          req.body.alertThreshold < 1 ||
          req.body.alertThreshold > 100
        ) {
          req.body.alertThreshold = 80; // Default value
        }
      }

      // Sanitize string fields
      if (req.body.name) {
        req.body.name = req.body.name.trim().substring(0, 100);
      }

      // Sanitize dates
      if (req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        if (isNaN(startDate.getTime())) {
          delete req.body.startDate;
        }
      }

      if (req.body.endDate) {
        const endDate = new Date(req.body.endDate);
        if (isNaN(endDate.getTime())) {
          delete req.body.endDate;
        }
      }

      // Sanitize query parameters
      if (req.query.limit) {
        req.query.limit = Math.min(
          Math.max(parseInt(req.query.limit) || 20, 1),
          100
        );
      }

      if (req.query.offset) {
        req.query.offset = Math.max(parseInt(req.query.offset) || 0, 0);
      }

      next();
    };
  }

  // Performance monitoring middleware
  static monitorPerformance() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      res.on("finish", () => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000;
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

        // Log slow requests (> 500ms for budgets)
        if (duration > 500) {
          console.warn(
            `[Budget Performance] Slow request: ${
              req.originalUrl
            } - ${duration.toFixed(2)}ms - Memory: ${(
              memoryDelta /
              1024 /
              1024
            ).toFixed(2)}MB`
          );
        }

        // Log high memory usage (> 25MB)
        if (Math.abs(memoryDelta) > 25 * 1024 * 1024) {
          console.warn(
            `[Budget Memory] High memory usage: ${req.originalUrl} - ${(
              memoryDelta /
              1024 /
              1024
            ).toFixed(2)}MB`
          );
        }
      });

      next();
    };
  }

  // Budget validation middleware for business rules
  static validateBudgetBusinessRules() {
    return async (req, res, next) => {
      try {
        const { startDate, endDate, amount, period } = req.body;

        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const diffTime = end - start;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Validate budget duration based on period
          switch (period) {
            case "weekly":
              if (diffDays < 7 || diffDays > 14) {
                return res.status(400).json({
                  success: false,
                  message: "Weekly budget duration should be between 7-14 days",
                });
              }
              break;
            case "monthly":
              if (diffDays < 28 || diffDays > 31) {
                return res.status(400).json({
                  success: false,
                  message:
                    "Monthly budget duration should be between 28-31 days",
                });
              }
              break;
            case "yearly":
              if (diffDays < 365 || diffDays > 366) {
                return res.status(400).json({
                  success: false,
                  message: "Yearly budget duration should be 365-366 days",
                });
              }
              break;
          }

          // Validate budget amount is reasonable for the period
          if (amount && period) {
            const dailyAmount = amount / diffDays;
            if (dailyAmount < 0.01) {
              return res.status(400).json({
                success: false,
                message: "Budget amount too small for the specified period",
              });
            }
            if (dailyAmount > 10000) {
              return res.status(400).json({
                success: false,
                message: "Budget amount seems unusually high. Please verify.",
              });
            }
          }
        }

        next();
      } catch (error) {
        console.error("Budget business rules validation error:", error);
        res.status(500).json({
          success: false,
          message: "Server error during validation",
        });
      }
    };
  }

  // Middleware to check budget limits per user
  static checkBudgetLimits() {
    return async (req, res, next) => {
      try {
        const userId = req.user.id;
        const method = req.method;

        // Only check on creation
        if (method !== "POST") {
          return next();
        }

        const userBudgetCount = await Budget.countDocuments({ userId });
        const maxBudgets = 50; // Maximum budgets per user

        if (userBudgetCount >= maxBudgets) {
          return res.status(400).json({
            success: false,
            message: `Maximum budget limit (${maxBudgets}) reached. Please delete some budgets before creating new ones.`,
          });
        }

        next();
      } catch (error) {
        console.error("Budget limits check error:", error);
        next(); // Continue on error to avoid blocking legitimate requests
      }
    };
  }

  // Middleware for budget analytics access control
  static validateAnalyticsAccess() {
    return (req, res, next) => {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required for analytics access",
        });
      }

      // Add analytics context
      req.analytics = {
        userId,
        requestTime: new Date(),
        endpoint: req.originalUrl,
      };

      next();
    };
  }

  // Error handling middleware
  static handleErrors() {
    return (error, req, res, next) => {
      console.error("[Budget Error]", error);

      // Mongoose validation errors
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
          value: err.value,
        }));

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }

      // MongoDB duplicate key error
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "A budget with similar parameters already exists",
        });
      }

      // Cast errors (invalid ObjectId, etc.)
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid data format provided",
        });
      }

      // Database connection errors
      if (
        error.name === "MongoNetworkError" ||
        error.name === "MongoTimeoutError"
      ) {
        return res.status(503).json({
          success: false,
          message: "Database temporarily unavailable. Please try again later.",
        });
      }

      // Default server error
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    };
  }

  // Handle validation errors
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
          location: error.location,
        })),
      });
    }
    next();
  }

  // Middleware to add request context
  static addRequestContext() {
    return (req, res, next) => {
      req.budget_context = {
        requestId: `budget_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        userId: req.user?.id,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        startTime: Date.now(),
        method: req.method,
        endpoint: req.originalUrl,
      };

      next();
    };
  }

  // Middleware for handling concurrent budget modifications
  static handleConcurrency() {
    const locks = new Map();

    return async (req, res, next) => {
      const budgetId = req.params.id;
      const method = req.method;

      // Only apply to modification operations
      if (!budgetId || !["PUT", "DELETE"].includes(method)) {
        return next();
      }

      const lockKey = `budget_${budgetId}`;

      if (locks.has(lockKey)) {
        return res.status(409).json({
          success: false,
          message:
            "Budget is currently being modified by another request. Please try again.",
        });
      }

      // Acquire lock
      locks.set(lockKey, Date.now());

      // Release lock after response
      res.on("finish", () => {
        locks.delete(lockKey);
      });

      // Release lock on error
      res.on("error", () => {
        locks.delete(lockKey);
      });

      // Clean up old locks periodically
      if (Math.random() < 0.01) {
        this.cleanupLocks(locks);
      }

      next();
    };
  }

  // Middleware for budget status validation
  static validateBudgetStatus() {
    return async (req, res, next) => {
      try {
        const budget = req.budget; // Set by ensureBudgetOwnership middleware
        const method = req.method;

        if (!budget || method === "GET") {
          return next();
        }

        const now = new Date();

        // Prevent modification of expired budgets (except deletion)
        if (budget.endDate < now && method !== "DELETE") {
          return res.status(400).json({
            success: false,
            message: "Cannot modify expired budget. You can only delete it.",
          });
        }

        // Warn about modifying active budgets
        if (
          budget.startDate <= now &&
          now <= budget.endDate &&
          method === "PUT"
        ) {
          // This is just a warning, not blocking the request
          console.warn(
            `[Budget Warning] Modifying active budget ${budget._id} by user ${req.user.id}`
          );
        }

        next();
      } catch (error) {
        console.error("Budget status validation error:", error);
        next(); // Continue to avoid blocking
      }
    };
  }

  // Helper methods
  static cleanupRateLimit(rateLimitMap, windowMs) {
    const now = Date.now();
    for (const [key, requests] of rateLimitMap.entries()) {
      const validRequests = requests.filter(
        (timestamp) => now - timestamp < windowMs
      );
      if (validRequests.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, validRequests);
      }
    }
  }

  static cleanupCache(cache, duration) {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp >= duration) {
        cache.delete(key);
      }
    }
  }

  static cleanupLocks(locks, maxAge = 5 * 60 * 1000) {
    // 5 minutes
    const now = Date.now();
    for (const [key, timestamp] of locks.entries()) {
      if (now - timestamp > maxAge) {
        locks.delete(key);
      }
    }
  }

  // Middleware for budget data export validation
  static validateExportRequest() {
    return [
      query("format")
        .optional()
        .isIn(["json", "csv"])
        .withMessage("Format must be either 'json' or 'csv'"),
      query("startDate")
        .optional()
        .isISO8601()
        .withMessage("Valid start date is required"),
      query("endDate")
        .optional()
        .isISO8601()
        .withMessage("Valid end date is required"),
      query("includeTransactions")
        .optional()
        .isBoolean()
        .withMessage("includeTransactions must be a boolean"),
      this.handleValidationErrors,
    ];
  }

  // Middleware to handle large budget datasets
  static handleLargeDatasets() {
    return (req, res, next) => {
      // Set timeout for large queries (20 seconds for budgets)
      req.setTimeout(20000, () => {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            message:
              "Request timeout. Try reducing the date range or data scope.",
          });
        }
      });

      // Add default pagination if not specified
      if (!req.query.limit && req.method === "GET") {
        req.query.limit = 20;
        req.query.offset = 0;
      }

      next();
    };
  }
}

module.exports = BudgetMiddleware;
