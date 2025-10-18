const express = require("express");
const router = express.Router();
const { auth } = require("../middlewares/authMiddleware");
const {
  sendMessage,
  checkHealth,
  getSuggestions,
} = require("../controllers/chatbotController");

/**
 * @route   POST /api/chatbot/message
 * @desc    Send message to AI chatbot
 * @access  Private
 */
router.post("/message", auth, sendMessage);

/**
 * @route   GET /api/chatbot/health
 * @desc    Check chatbot service health
 * @access  Public
 */
router.get("/health", checkHealth);

/**
 * @route   GET /api/chatbot/suggestions
 * @desc    Get AI-generated financial suggestions
 * @access  Private
 */
router.get("/suggestions", auth, getSuggestions);

module.exports = router;
