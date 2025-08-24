const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Standard authentication middleware
 * Verifies JWT token and adds user to request object
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization");

    // Check if no token
    if (!token || !token.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      });
    }

    // Extract token from "Bearer <token>"
    const actualToken = token.split(" ")[1];

    if (!actualToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);

      // Check if user still exists
      const user = await User.findById(decoded.user.id).select("-password");
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Token valid but user no longer exists",
        });
      }

      // Add user to request
      req.user = decoded.user;
      req.userData = user; // Full user data if needed
      next();
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      } else if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token provided, but adds user if valid token exists
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization");

    // If no token, continue without user
    if (!token || !token.startsWith("Bearer ")) {
      req.user = null;
      req.userData = null;
      return next();
    }

    const actualToken = token.split(" ")[1];

    if (!actualToken) {
      req.user = null;
      req.userData = null;
      return next();
    }

    try {
      const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.user.id).select("-password");

      if (user) {
        req.user = decoded.user;
        req.userData = user;
      } else {
        req.user = null;
        req.userData = null;
      }
    } catch (jwtError) {
      // Invalid token, but continue without user
      req.user = null;
      req.userData = null;
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    req.user = null;
    req.userData = null;
    next();
  }
};

/**
 * Admin role middleware
 * Requires authentication and admin role
 */
const requireAdmin = async (req, res, next) => {
  try {
    // First check authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get full user data if not already available
    let user = req.userData;
    if (!user) {
      user = await User.findById(req.user.id).select("-password");
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has admin role
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.userData = user;
    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error in authorization",
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {Array} roles - Array of allowed roles
 */
const requireRoles = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      let user = req.userData;
      if (!user) {
        user = await User.findById(req.user.id).select("-password");
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roles.join(", ")}`,
        });
      }

      req.userData = user;
      next();
    } catch (error) {
      console.error("Role middleware error:", error);
      res.status(500).json({
        success: false,
        message: "Server error in authorization",
      });
    }
  };
};

/**
 * Email verification middleware
 * Requires user to have verified email
 */
const requireEmailVerified = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    let user = req.userData;
    if (!user) {
      user = await User.findById(req.user.id).select("-password");
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Email verification required",
      });
    }

    req.userData = user;
    next();
  } catch (error) {
    console.error("Email verification middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error in verification check",
    });
  }
};

/**
 * Rate limiting middleware for auth endpoints
 * Simple in-memory rate limiting (use Redis in production)
 */
const authRateLimit = (() => {
  const attempts = new Map();
  const WINDOW_SIZE = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 5;

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean up old entries
    for (const [ip, data] of attempts.entries()) {
      if (now - data.firstAttempt > WINDOW_SIZE) {
        attempts.delete(ip);
      }
    }

    const userAttempts = attempts.get(key);

    if (!userAttempts) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (now - userAttempts.firstAttempt > WINDOW_SIZE) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (userAttempts.count >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many authentication attempts, please try again later",
      });
    }

    userAttempts.count++;
    next();
  };
})();

/**
 * Token blacklist middleware (for logout functionality)
 * In production, use Redis for token blacklisting
 */
const blacklistedTokens = new Set();

const checkTokenBlacklist = (req, res, next) => {
  try {
    const token = req.header("Authorization");

    if (token && token.startsWith("Bearer ")) {
      const actualToken = token.split(" ")[1];

      if (blacklistedTokens.has(actualToken)) {
        return res.status(401).json({
          success: false,
          message: "Token has been invalidated",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Token blacklist check error:", error);
    next();
  }
};

/**
 * Add token to blacklist
 * @param {string} token - JWT token to blacklist
 */
const addToBlacklist = (token) => {
  blacklistedTokens.add(token);

  // Clean up expired tokens periodically
  setTimeout(() => {
    blacklistedTokens.delete(token);
  }, 7 * 24 * 60 * 60 * 1000); // 7 days
};

module.exports = {
  auth,
  optionalAuth,
  requireAdmin,
  requireRoles,
  requireEmailVerified,
  authRateLimit,
  checkTokenBlacklist,
  addToBlacklist,
};
