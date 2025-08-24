const { query, validationResult } = require("express-validator");

class AnalyticsMiddleware {
  // Validation middleware for overview endpoint
  static validateOverview() {
    return [
      query("period")
        .optional()
        .isIn(["week", "month", "year"])
        .withMessage("Period must be one of: week, month, year"),
      this.handleValidationErrors,
    ];
  }

  // Validation middleware for spending trends endpoint
  static validateSpendingTrends() {
    return [
      query("period")
        .optional()
        .isIn(["week", "month", "year"])
        .withMessage("Period must be one of: week, month, year"),
      query("months")
        .optional()
        .isInt({ min: 1, max: 24 })
        .withMessage("Months must be a number between 1 and 24"),
      this.handleValidationErrors,
    ];
  }

  // Validation middleware for category breakdown endpoint
  static validateCategoryBreakdown() {
    return [
      query("period")
        .optional()
        .isIn(["week", "month", "year"])
        .withMessage("Period must be one of: week, month, year"),
      query("type")
        .optional()
        .isIn(["income", "expense"])
        .withMessage("Type must be either 'income' or 'expense'"),
      this.handleValidationErrors,
    ];
  }

  // Validation middleware for export endpoint
  static validateExport() {
    return [
      query("format")
        .optional()
        .isIn(["json", "csv"])
        .withMessage("Format must be either 'json' or 'csv'"),
      query("period")
        .optional()
        .isIn(["month", "year", "all"])
        .withMessage("Period must be one of: month, year, all"),
      this.handleValidationErrors,
    ];
  }

  // Rate limiting middleware for analytics endpoints
  static rateLimit() {
    const rateLimitMap = new Map();

    return (req, res, next) => {
      const userId = req.user?.id;
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute
      const maxRequests = 30; // 30 requests per minute per user

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const userKey = `analytics_${userId}`;
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
        // 1% chance to clean up
        this.cleanupRateLimit(rateLimitMap, windowMs);
      }

      next();
    };
  }

  // Cache middleware for analytics data
  static cache(duration = 5 * 60 * 1000) {
    // 5 minutes default
    const cache = new Map();

    return (req, res, next) => {
      const userId = req.user?.id;
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
        // 1% chance to clean up
        this.cleanupCache(cache, duration);
      }

      next();
    };
  }

  // Logging middleware for analytics requests
  static logRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      const userId = req.user?.id;
      const endpoint = req.route?.path || req.path;

      // Log request start
      console.log(
        `[Analytics] ${new Date().toISOString()} - User ${userId} accessing ${endpoint}`
      );

      // Override res.json to log response
      const originalJson = res.json;
      res.json = function (data) {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        console.log(
          `[Analytics] ${new Date().toISOString()} - User ${userId} ${endpoint} - ${status} - ${duration}ms`
        );

        if (status >= 400) {
          console.error(
            `[Analytics Error] User ${userId} ${endpoint}:`,
            data.message || "Unknown error"
          );
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  // Security middleware to ensure user can only access their own data
  static ensureOwnership() {
    return (req, res, next) => {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Add user context for easier access in controllers
      req.analytics = {
        userId: req.user.id,
        userEmail: req.user.email,
        requestTime: new Date(),
      };

      next();
    };
  }

  // Data sanitization middleware
  static sanitizeQuery() {
    return (req, res, next) => {
      // Sanitize numeric parameters
      if (req.query.months) {
        req.query.months = Math.min(
          Math.max(parseInt(req.query.months) || 6, 1),
          24
        );
      }

      // Ensure valid date ranges
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate);
        if (isNaN(startDate.getTime())) {
          delete req.query.startDate;
        }
      }

      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        if (isNaN(endDate.getTime())) {
          delete req.query.endDate;
        }
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
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

        // Log slow requests (> 1 second)
        if (duration > 1000) {
          console.warn(
            `[Analytics Performance] Slow request: ${
              req.originalUrl
            } - ${duration.toFixed(2)}ms - Memory: ${(
              memoryDelta /
              1024 /
              1024
            ).toFixed(2)}MB`
          );
        }

        // Log high memory usage (> 50MB)
        if (Math.abs(memoryDelta) > 50 * 1024 * 1024) {
          console.warn(
            `[Analytics Memory] High memory usage: ${req.originalUrl} - ${(
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

  // Error handling middleware
  static handleErrors() {
    return (error, req, res, next) => {
      console.error("[Analytics Error]", error);

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

      // Validation errors
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Invalid data provided",
          errors: Object.values(error.errors).map((err) => err.message),
        });
      }

      // Cast errors (invalid ObjectId, etc.)
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid data format",
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
        })),
      });
    }
    next();
  }

  // Helper method to clean up rate limit map
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

  // Helper method to clean up cache
  static cleanupCache(cache, duration) {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp >= duration) {
        cache.delete(key);
      }
    }
  }

  // Middleware to add request context
  static addRequestContext() {
    return (req, res, next) => {
      req.analytics = {
        ...req.analytics,
        requestId: `analytics_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        startTime: Date.now(),
      };

      next();
    };
  }

  // Middleware for handling large dataset queries
  static handleLargeQueries() {
    return (req, res, next) => {
      // Set timeout for large queries (30 seconds)
      req.setTimeout(30000, () => {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            message:
              "Request timeout. Try reducing the date range or data scope.",
          });
        }
      });

      // Add pagination support for large datasets
      if (req.query.limit) {
        req.query.limit = Math.min(parseInt(req.query.limit) || 100, 1000);
      }

      if (req.query.offset) {
        req.query.offset = Math.max(parseInt(req.query.offset) || 0, 0);
      }

      next();
    };
  }
}

module.exports = AnalyticsMiddleware;
