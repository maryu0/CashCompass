const axios = require("axios");
const Transaction = require("../models/Transaction");

// Python chatbot API URL
const CHATBOT_API_URL = process.env.CHATBOT_API_URL || "http://localhost:5001";

/**
 * @desc    Send message to AI chatbot with user context
 * @route   POST /api/chatbot/message
 * @access  Private
 */
const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // Fetch user's recent transactions for context
    const recentTransactions = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 })
      .limit(10)
      .populate("category", "name icon");

    // Calculate user context
    const totalIncome = recentTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = recentTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    // Format transactions for context
    const transactionsContext = recentTransactions
      .map((t) => {
        const date = new Date(t.date).toLocaleDateString();
        const type = t.type === "income" ? "+" : "-";
        return `${date}: ${t.description} (${
          t.category?.name || "Uncategorized"
        }) ${type}₹${t.amount}`;
      })
      .join("\n");

    // Prepare context payload
    const contextPayload = {
      message: message,
      context: {
        transactions: transactionsContext,
        balance: balance,
        monthly_expenses: totalExpenses,
        monthly_income: totalIncome,
        user_name: req.user.name,
      },
    };

    // Send to Python chatbot API
    const chatbotResponse = await axios.post(
      `${CHATBOT_API_URL}/chat`,
      contextPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (chatbotResponse.data.success) {
      return res.status(200).json({
        success: true,
        data: {
          message: chatbotResponse.data.response,
          timestamp: new Date(),
        },
      });
    } else {
      throw new Error("Chatbot API returned unsuccessful response");
    }
  } catch (error) {
    console.error("Chatbot API Error:", error.message);

    // Handle specific error cases
    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        message: "Chatbot service is unavailable. Please try again later.",
      });
    }

    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        success: false,
        message: "Chatbot is taking too long to respond. Please try again.",
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message:
          error.response.data.error || "Error communicating with chatbot",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to process chatbot request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Check chatbot service health
 * @route   GET /api/chatbot/health
 * @access  Public
 */
const checkHealth = async (req, res) => {
  try {
    const response = await axios.get(`${CHATBOT_API_URL}/health`, {
      timeout: 5000,
    });

    return res.status(200).json({
      success: true,
      chatbot_status: response.data.status,
      message: "Chatbot service is healthy",
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Chatbot service is unavailable",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get chatbot suggestions based on spending patterns
 * @route   GET /api/chatbot/suggestions
 * @access  Private
 */
const getSuggestions = async (req, res) => {
  try {
    // Get last 30 days of transactions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: thirtyDaysAgo },
    }).populate("category", "name type");

    // Calculate spending by category
    const categorySpending = {};
    let totalExpenses = 0;
    let totalIncome = 0;

    transactions.forEach((t) => {
      if (t.type === "expense") {
        totalExpenses += t.amount;
        const catName = t.category?.name || "Uncategorized";
        categorySpending[catName] = (categorySpending[catName] || 0) + t.amount;
      } else {
        totalIncome += t.amount;
      }
    });

    // Build insights prompt
    const insightPrompt = `Based on this user's last 30 days:
- Total Income: ₹${totalIncome}
- Total Expenses: ₹${totalExpenses}
- Spending by category: ${JSON.stringify(categorySpending, null, 2)}

Provide 3-5 actionable financial suggestions to help them save money and manage their finances better. Be specific and practical.`;

    const chatbotResponse = await axios.post(
      `${CHATBOT_API_URL}/chat`,
      { message: insightPrompt },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    if (chatbotResponse.data.success) {
      return res.status(200).json({
        success: true,
        data: {
          suggestions: chatbotResponse.data.response,
          summary: {
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            topCategories: Object.entries(categorySpending)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3),
          },
        },
      });
    } else {
      throw new Error("Failed to get suggestions");
    }
  } catch (error) {
    console.error("Suggestions Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate suggestions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  sendMessage,
  checkHealth,
  getSuggestions,
};
