import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  MessageCircle,
  Bell,
  DollarSign,
  Calendar,
  Target,
  Zap,
  PiggyBank,
  Settings,
  LayoutDashboard,
  Moon,
  Sun,
} from "lucide-react";

// Mock Data
const incomeData = [
  { month: "Jul", income: 28000, expenses: 22000 },
  { month: "Aug", income: 32000, expenses: 24000 },
  { month: "Sep", income: 26000, expenses: 25000 },
  { month: "Oct", income: 30000, expenses: 23000 },
  { month: "Nov", income: 18000, expenses: 26000 }, // Crisis month!
  { month: "Dec", income: 24000, expenses: 21000 },
];

const expenseBreakdown = [
  { category: "Food", amount: 8000, color: "#8884d8" },
  { category: "Transport", amount: 6000, color: "#82ca9d" },
  { category: "Rent", amount: 12000, color: "#ffc658" },
  { category: "Entertainment", amount: 3000, color: "#ff7300" },
  { category: "Others", amount: 2000, color: "#00ff88" },
];

const crisisAlerts = [
  {
    id: 1,
    type: "weather",
    severity: "high",
    title: "Heavy Rain Alert",
    message:
      "Expected 3 days of heavy rainfall. Delivery work may reduce by 60%. Consider saving ₹1,200 this week.",
    impact: "₹5,400 potential loss",
    timestamp: "2 hours ago",
  },
  {
    id: 2,
    type: "economic",
    severity: "medium",
    title: "Fuel Price Hike",
    message:
      "Petrol prices increased by ₹3/L. Your transport costs will rise by ₹450/month.",
    impact: "₹450 extra monthly",
    timestamp: "1 day ago",
  },
];

const initialChatMessages = [
  {
    id: 1,
    type: "user",
    message: "Can I afford to take 2 days off this month?",
  },
  {
    id: 2,
    type: "ai",
    message:
      "Based on your current savings of ₹8,500 and average daily expenses of ₹700, you can afford 2 days off. However, I recommend reducing entertainment spending by ₹600 to maintain your emergency buffer.",
  },
  { id: 3, type: "user", message: "What if fuel prices go up more?" },
  {
    id: 4,
    type: "ai",
    message:
      "If fuel increases by another ₹2/L, your monthly transport cost will rise to ₹6,900. Consider carpooling or using public transport 2 days/week to save ₹800/month.",
  },
];

function CrisisFinancialBuddy() {
  const [activePage, setActivePage] = useState("dashboard");
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState(initialChatMessages);
  const [darkMode, setDarkMode] = useState(() => {
    // Check if there's a saved preference, otherwise use system preference
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Check system preference
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  // Apply dark mode class to document
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    // Save preference
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const userMsg = {
      id: messages.length + 1,
      type: "user",
      message: newMessage,
    };

    const aiResponses = [
      "Based on your spending pattern, I'd recommend budgeting ₹500 extra for emergency situations this month.",
      "Looking at your income history, here's what I suggest: try to save at least 15% of your monthly earnings.",
      "Given the current crisis alerts in your area, consider keeping ₹2,000 as an emergency buffer.",
      "Your financial health score is improving! Here's how to keep it up: maintain consistent savings and monitor your expenses daily.",
      "I notice your transport costs are high. Have you considered carpooling or using public transport 2-3 days a week?",
      "Weather alerts show potential income disruption. I suggest saving an extra ₹800 this week just to be safe.",
      "Your entertainment expenses seem manageable, but reducing them by 20% could boost your savings significantly.",
    ];

    const aiMsg = {
      id: messages.length + 2,
      type: "ai",
      message: aiResponses[Math.floor(Math.random() * aiResponses.length)],
    };

    setMessages([...messages, userMsg, aiMsg]);
    setNewMessage("");
  };

  const handleQuickQuestion = (question) => {
    setNewMessage(question);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800";
      case "low":
        return "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700";
    }
  };

  const getPageInfo = () => {
    switch (activePage) {
      case "dashboard":
        return { title: "Dashboard", subtitle: "Financial overview" };
      case "alerts":
        return {
          title: "Crisis Alerts",
          subtitle: "Real-time crisis monitoring",
        };
      case "chat":
        return {
          title: "AI Financial Buddy",
          subtitle: "Your personal financial advisor",
        };
      default:
        return { title: "Dashboard", subtitle: "Financial overview" };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex transition-colors duration-300">
      {/* Left Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 shadow-lg transition-colors duration-300">
        <div className="p-6">
          <div className="flex items-center mb-8">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg flex items-center justify-center mr-3">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Financial Buddy
              </h1>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-orange-200 dark:bg-orange-800 rounded-full flex items-center justify-center mr-3">
              <span className="text-orange-600 dark:text-orange-300 font-medium text-sm">
                G
              </span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Ayush
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gig Worker
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <div
              onClick={() => setActivePage("dashboard")}
              className={`flex items-center px-3 py-2 text-sm cursor-pointer rounded-lg transition-all ${
                activePage === "dashboard"
                  ? "text-gray-700 bg-gray-50 dark:text-white dark:bg-gray-700"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              <div
                className={`w-1 h-4 rounded-full mr-3 ${
                  activePage === "dashboard"
                    ? "bg-orange-400"
                    : "bg-transparent"
                }`}
              ></div>
              <LayoutDashboard className="h-4 w-4 mr-3" />
              Dashboard
            </div>
            <div className="flex items-center px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-all">
              <div className="w-1 h-4 rounded-full mr-3 bg-transparent"></div>
              <DollarSign className="h-4 w-4 mr-3" />
              My Wallet
            </div>
            <div className="flex items-center px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-all">
              <div className="w-1 h-4 rounded-full mr-3 bg-transparent"></div>
              <Calendar className="h-4 w-4 mr-3" />
              Transactions
            </div>
            <div
              onClick={() => setActivePage("alerts")}
              className={`flex items-center px-3 py-2 text-sm cursor-pointer rounded-lg transition-all ${
                activePage === "alerts"
                  ? "text-gray-700 bg-gray-50 dark:text-white dark:bg-gray-700"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              <div
                className={`w-1 h-4 rounded-full mr-3 ${
                  activePage === "alerts" ? "bg-orange-400" : "bg-transparent"
                }`}
              ></div>
              <AlertTriangle className="h-4 w-4 mr-3" />
              Crisis Alerts
              {activePage !== "alerts" && (
                <div className="w-2 h-2 bg-red-500 rounded-full ml-auto animate-pulse"></div>
              )}
            </div>
            <div
              onClick={() => setActivePage("chat")}
              className={`flex items-center px-3 py-2 text-sm cursor-pointer rounded-lg transition-all ${
                activePage === "chat"
                  ? "text-gray-700 bg-gray-50 dark:text-white dark:bg-gray-700"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              <div
                className={`w-1 h-4 rounded-full mr-3 ${
                  activePage === "chat" ? "bg-orange-400" : "bg-transparent"
                }`}
              ></div>
              <MessageCircle className="h-4 w-4 mr-3" />
              AI Financial Buddy
            </div>
            <div className="flex items-center px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-all">
              <div className="w-1 h-4 rounded-full mr-3 bg-transparent"></div>
              <Settings className="h-4 w-4 mr-3" />
              Settings
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {pageInfo.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {pageInfo.subtitle}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" />
              )}
            </button>
            {/* Notifications */}
            <div className="relative">
              <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400 cursor-pointer hover:text-orange-500 dark:hover:text-orange-400 transition-colors" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Dashboard Page */}
        {activePage === "dashboard" && (
          <>
            {/* Top Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {/* This Month Income */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">B</span>
                  </div>
                  <TrendingUp className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹24,000
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This Month Income
                </p>
                <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                  +5% This week
                </p>
              </div>

              {/* Crisis Score */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <Target className="text-white h-5 w-5" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Medium
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Crisis Score
                </p>
                <p className="text-xs text-yellow-500 dark:text-yellow-400 mt-1">
                  35% This week
                </p>
              </div>

              {/* Expenses */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">N</span>
                  </div>
                  <TrendingDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹21,000
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This Month Expenses
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  21% This week
                </p>
              </div>

              {/* Money Saved */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <PiggyBank className="text-white h-5 w-5" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹3,000
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Money Saved
                </p>
                <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                  +12% This week
                </p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="space-y-6">
              {/* Income vs Expenses Graph */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Market Overview
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Financial trend analysis
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <select className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option>Weekly (2024)</option>
                      <option>Monthly (2024)</option>
                      <option>Yearly</option>
                    </select>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={incomeData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={darkMode ? "#374151" : "#f1f5f9"}
                    />
                    <XAxis
                      dataKey="month"
                      stroke={darkMode ? "#9ca3af" : "#64748b"}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={darkMode ? "#9ca3af" : "#64748b"}
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value) => `₹${value.toLocaleString()}`}
                      contentStyle={{
                        backgroundColor: darkMode ? "#1f2937" : "#fff",
                        border: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        color: darkMode ? "#fff" : "#000",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#10b981"
                      strokeWidth={3}
                      name="Income"
                      dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                      activeDot={{
                        r: 6,
                        stroke: "#10b981",
                        strokeWidth: 2,
                        fill: darkMode ? "#1f2937" : "#fff",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={3}
                      name="Expenses"
                      dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                      activeDot={{
                        r: 6,
                        stroke: "#ef4444",
                        strokeWidth: 2,
                        fill: darkMode ? "#1f2937" : "#fff",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom Row - Pie Chart and Crisis Preparedness */}
              <div className="grid grid-cols-2 gap-6">
                {/* Expense Breakdown */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                  <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
                    Expense Breakdown
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="amount"
                        label={({ category, amount }) =>
                          `${category}: ₹${amount}`
                        }
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `₹${value.toLocaleString()}`}
                        contentStyle={{
                          backgroundColor: darkMode ? "#1f2937" : "#fff",
                          border: `1px solid ${
                            darkMode ? "#374151" : "#e2e8f0"
                          }`,
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                          color: darkMode ? "#fff" : "#000",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Crisis Preparedness Insights */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                  <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
                    Crisis Preparedness
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          67%
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Financial Health Score
                        </div>
                      </div>
                      <div className="w-16 h-16 relative">
                        <svg
                          className="w-16 h-16 transform -rotate-90"
                          viewBox="0 0 36 36"
                        >
                          <path
                            className="text-green-200 dark:text-green-800"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-green-600 dark:text-green-400"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray="67, 100"
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ₹2,100
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Recommended Savings This Month
                      </div>
                    </div>

                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        15 Days
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Survival Period (No Income)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Crisis Alerts Page */}
        {activePage === "alerts" && (
          <div className="space-y-6">
            {/* Alert Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
                  <span className="text-xs text-red-500 dark:text-red-400 font-medium">
                    HIGH
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  2
                </h2>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Active Alerts
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <Zap className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
                  <span className="text-xs text-yellow-500 dark:text-yellow-400 font-medium">
                    MEDIUM
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  ₹5,850
                </h2>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Potential Impact
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-8 w-8 text-green-500 dark:text-green-400" />
                  <span className="text-xs text-green-500 dark:text-green-400 font-medium">
                    READY
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">
                  3
                </h2>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Action Plans
                </p>
              </div>
            </div>

            {/* Crisis Alerts List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center text-gray-900 dark:text-white">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3 animate-pulse"></div>
                  Real-time Crisis Monitoring
                </h3>
                <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  System Active
                </div>
              </div>

              <div className="space-y-4">
                {crisisAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border-2 rounded-2xl p-6 hover:shadow-md transition-all duration-300 ${getSeverityColor(
                      alert.severity
                    )}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <div
                          className={`p-3 rounded-xl mr-4 ${
                            alert.severity === "high"
                              ? "bg-red-100 dark:bg-red-900/40"
                              : "bg-yellow-100 dark:bg-yellow-900/40"
                          }`}
                        >
                          <AlertTriangle
                            className={`h-6 w-6 ${
                              alert.severity === "high"
                                ? "text-red-500 dark:text-red-400"
                                : "text-yellow-500 dark:text-yellow-400"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                              {alert.title}
                            </h4>
                            <span
                              className={`ml-3 px-2 py-1 text-xs font-bold rounded-full ${
                                alert.severity === "high"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                              }`}
                            >
                              {alert.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 mb-3 text-base">
                            {alert.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                Impact: {alert.impact}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {alert.timestamp}
                              </span>
                            </div>
                            <div className="flex space-x-2">
                              <button className="bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-white">
                                View Details
                              </button>
                              <button
                                className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ${
                                  alert.severity === "high"
                                    ? "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                                    : "bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700"
                                }`}
                              >
                                Action Plan
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-6 rounded-2xl text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    System Status: All Good
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No new crisis alerts in the last 6 hours. Monitoring
                  continues...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Chat Page */}
        {activePage === "chat" && (
          <div className="h-full">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 h-96 flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mr-4">
                      <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        AI Financial Buddy
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Ask me anything about your finances
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      ONLINE
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-2xl max-w-md">
                    <p className="text-sm">
                      👋 Hi Ayush! I'm your AI Financial Buddy. I can help you
                      with budgeting, crisis planning, and financial advice.
                      What would you like to know?
                    </p>
                  </div>
                </div>

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`px-4 py-3 rounded-2xl max-w-md transition-all hover:shadow-sm ${
                        msg.type === "user"
                          ? "bg-blue-500 dark:bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Ask about your finances..."
                    className="flex-1 border-2 border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-500 dark:bg-blue-600 text-white px-6 py-3 rounded-2xl text-sm font-medium hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!newMessage.trim()}
                  >
                    Send
                  </button>
                </div>

                <div className="flex items-center justify-center mt-4 space-x-4">
                  <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-default">
                    Quick Questions:
                  </button>
                  <button
                    onClick={() =>
                      handleQuickQuestion("Can I afford to take time off?")
                    }
                    className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1 rounded-full transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Time Off?
                  </button>
                  <button
                    onClick={() =>
                      handleQuickQuestion("How to save more money?")
                    }
                    className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1 rounded-full transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Save More?
                  </button>
                  <button
                    onClick={() =>
                      handleQuickQuestion("Crisis preparation tips?")
                    }
                    className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1 rounded-full transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Crisis Tips?
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CrisisFinancialBuddy;
