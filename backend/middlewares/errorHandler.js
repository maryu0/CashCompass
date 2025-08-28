const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details for debugging
  console.error("Error Handler:", {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id || "Anonymous",
    timestamp: new Date().toISOString(),
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || "Server error";

  // Handle specific error types

  // MongoDB Validation Error
  if (err.name === "ValidationError") {
    statusCode = 400;
    const errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));

    return res.status(statusCode).json({
      success: false,
      message: "Validation errors",
      errors,
    });
  }

  // MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    message = `Resource with ${field} '${value}' already exists`;

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // MongoDB Cast Error (Invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // Express Validator Errors (if not caught by controllers)
  if (err.array && typeof err.array === "function") {
    statusCode = 400;
    const errors = err.array();

    return res.status(statusCode).json({
      success: false,
      message: "Validation errors",
      errors,
    });
  }

  // Request too large
  if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request entity too large";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // Malformed JSON
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON format";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // Rate limiting errors
  if (err.message && err.message.includes("Rate limit")) {
    statusCode = 429;

    return res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Custom financial app errors
  if (err.name === "InsufficientFundsError") {
    statusCode = 400;
    message = "Insufficient funds for this transaction";

    return res.status(statusCode).json({
      success: false,
      message,
      type: "insufficient_funds",
    });
  }

  if (err.name === "BudgetExceededError") {
    statusCode = 400;
    message = "Transaction would exceed budget limit";

    return res.status(statusCode).json({
      success: false,
      message,
      type: "budget_exceeded",
      budgetInfo: err.budgetInfo || null,
    });
  }

  if (err.name === "UnauthorizedAccessError") {
    statusCode = 403;
    message = "Access denied - insufficient permissions";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // Handle specific HTTP status codes
  if (statusCode === 404) {
    message = message || "Resource not found";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  if (statusCode === 401) {
    message = message || "Authentication required";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  if (statusCode === 403) {
    message = message || "Access denied";

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // Default error response (500)
  const response = {
    success: false,
    message:
      process.env.NODE_ENV === "production" ? "Internal server error" : message,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
    response.error = error;
  }

  res.status(statusCode).json(response);
};

/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 * Usage: router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom Error Classes for Financial App
 */
class InsufficientFundsError extends Error {
  constructor(message = "Insufficient funds", availableAmount = null) {
    super(message);
    this.name = "InsufficientFundsError";
    this.availableAmount = availableAmount;
  }
}

class BudgetExceededError extends Error {
  constructor(message = "Budget exceeded", budgetInfo = null) {
    super(message);
    this.name = "BudgetExceededError";
    this.budgetInfo = budgetInfo;
  }
}

class UnauthorizedAccessError extends Error {
  constructor(message = "Unauthorized access") {
    super(message);
    this.name = "UnauthorizedAccessError";
  }
}

/**
 * Validation Error Handler
 * Specifically for express-validator errors in routes
 */
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require("express-validator");
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
  }

  next();
};

/**
 * Development Error Logger
 * More detailed logging for development environment
 */
const devErrorLogger = (err, req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log("\n=== ERROR DETAILS ===");
    console.log("Time:", new Date().toISOString());
    console.log("Method:", req.method);
    console.log("URL:", req.originalUrl);
    console.log("User:", req.user?.id || "Anonymous");
    console.log("Error Name:", err.name);
    console.log("Error Message:", err.message);
    console.log("Stack Trace:", err.stack);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
    console.log("Request Query:", JSON.stringify(req.query, null, 2));
    console.log("Request Params:", JSON.stringify(req.params, null, 2));
    console.log("====================\n");
  }

  next(err);
};

/**
 * Production Error Logger
 * Logs errors to external service in production
 */
const prodErrorLogger = (err, req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    // Here you would typically log to external service like:
    // - Winston + CloudWatch
    // - Sentry
    // - LogRocket
    // - Datadog

    const errorLog = {
      timestamp: new Date().toISOString(),
      level: "error",
      message: err.message,
      name: err.name,
      statusCode: err.statusCode || 500,
      userId: req.user?.id || "anonymous",
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    };

    console.error("PRODUCTION ERROR:", JSON.stringify(errorLog));
  }

  next(err);
};

/**
 * Helper function to create standardized errors
 */
const createError = (message, statusCode = 500, type = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (type) error.type = type;
  return error;
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  handleValidationErrors,
  devErrorLogger,
  prodErrorLogger,
  createError,

  // Custom error classes
  InsufficientFundsError,
  BudgetExceededError,
  UnauthorizedAccessError,
};
