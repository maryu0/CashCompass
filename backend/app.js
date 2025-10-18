const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

const app = express();

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const budgetRoutes = require("./routes/budgetRoutes"); //* may delete later
const alertRoutes = require("./routes/alertRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");
// Middleware setup
const { errorHandler } = require("./middlewares/errorHandler");
const { notFound } = require("./middlewares/notFound");

app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP, please try again later." },
});
app.use("/api/", limiter);

app.use(compression());

//CORS config
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Cash Compass API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/chatbot", chatbotRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Cash Compass API",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      transactions: "/api/transactions",
      budgets: "/api/budgets",
      alerts: "/api/alerts",
      notification: "/api/notifications",
      analytics: "/api/analytics",
    },
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
