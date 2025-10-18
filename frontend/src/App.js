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

// API Configuration
const API_BASE_URL = "http://localhost:5000/api";

// Mock Data (keeping for Dashboard, Alerts, Chat)
const incomeData = [
  { month: "Jul", income: 28000, expenses: 22000 },
  { month: "Aug", income: 32000, expenses: 24000 },
  { month: "Sep", income: 26000, expenses: 25000 },
  { month: "Oct", income: 30000, expenses: 23000 },
  { month: "Nov", income: 18000, expenses: 26000 },
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
      "Expected 3 days of heavy rainfall. Delivery work may reduce by 60%.",
    impact: "₹5,400 potential loss",
    timestamp: "2 hours ago",
  },
  {
    id: 2,
    type: "economic",
    severity: "medium",
    title: "Fuel Price Hike",
    message: "Petrol prices increased by ₹3/L. Transport costs will rise.",
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
      "Based on your current savings and average daily expenses, you can afford 2 days off. However, I recommend reducing entertainment spending to maintain your emergency buffer.",
  },
];

function CashCompassApp() {
  const [activePage, setActivePage] = useState("dashboard");
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState(initialChatMessages);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  // State for API data
  const [authToken, setAuthToken] = useState(
    localStorage.getItem("authToken") || ""
  );
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal states
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Form states
  const [transactionForm, setTransactionForm] = useState({
    type: "expense",
    amount: "",
    category: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "cash",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    type: "expense",
    icon: "📦",
    color: "#3B82F6",
    description: "",
  });

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Apply dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  // Fetch user profile
  useEffect(() => {
    if (authToken) {
      fetchUserProfile();
      fetchCategories();
      fetchTransactions();
    }
  }, [authToken]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        setProfileForm({
          name: data.data.name,
          email: data.data.email,
        });
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/transactions?limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setTransactions(data.data.transactions || []);
      }
    } catch (err) {
      setError("Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(transactionForm),
      });
      const data = await response.json();
      if (data.success) {
        setShowTransactionModal(false);
        setTransactionForm({
          type: "expense",
          amount: "",
          category: "",
          description: "",
          date: new Date().toISOString().split("T")[0],
          paymentMethod: "cash",
        });
        fetchTransactions();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to create transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/transactions/${editingTransaction._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(transactionForm),
        }
      );
      const data = await response.json();
      if (data.success) {
        setShowTransactionModal(false);
        setEditingTransaction(null);
        fetchTransactions();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to update transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?"))
      return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (data.success) {
        fetchTransactions();
      }
    } catch (err) {
      setError("Failed to delete transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(categoryForm),
      });
      const data = await response.json();
      if (data.success) {
        setShowCategoryModal(false);
        setCategoryForm({
          name: "",
          type: "expense",
          icon: "📦",
          color: "#3B82F6",
          description: "",
        });
        fetchCategories();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(profileForm),
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        alert("Profile updated successfully!");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(passwordForm),
      });
      const data = await response.json();
      if (data.success) {
        alert("Password changed successfully!");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setError(data.message || "Failed to change password");
      }
    } catch (err) {
      setError("Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setAuthToken("");
    setUser(null);
    setActivePage("dashboard");
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const [sendingMessage, setSendingMessage] = useState(false);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const userMsg = {
      id: messages.length + 1,
      type: "user",
      message: newMessage,
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMsg]);
    setNewMessage("");
    setSendingMessage(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chatbot/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ message: newMessage }),
      });

      const data = await response.json();

      if (data.success) {
        const aiMsg = {
          id: messages.length + 2,
          type: "ai",
          message: data.data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(data.message || "Failed to get response");
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg = {
        id: messages.length + 2,
        type: "ai",
        message:
          "Sorry, I'm having trouble connecting right now. Please try again! 🤖",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSendingMessage(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getPageInfo = () => {
    const pages = {
      dashboard: { title: "Dashboard", subtitle: "Financial overview" },
      wallet: { title: "My Wallet", subtitle: "Manage your finances" },
      transactions: { title: "Transactions", subtitle: "Track your spending" },
      alerts: { title: "Crisis Alerts", subtitle: "Real-time monitoring" },
      chat: { title: "AI Financial Buddy", subtitle: "Personal advisor" },
      settings: { title: "Settings", subtitle: "Manage your account" },
    };
    return pages[activePage] || pages.dashboard;
  };

  const pageInfo = getPageInfo();

  // Calculate wallet stats
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpenses;

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (data.success && data.token) {
        localStorage.setItem("authToken", data.token);
        setAuthToken(data.token);
      } else {
        setLoginError(data.message || "Login failed");
      }
    } catch (err) {
      setLoginError("Failed to connect to server");
    } finally {
      setLoggingIn(false);
    }
  };

  if (!authToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💰</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Cash Compass
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your Financial Companion
            </p>
          </div>

          {loginError && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, email: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white py-3 rounded-xl font-semibold hover:from-orange-500 hover:to-orange-600 transition-all disabled:opacity-50"
            >
              {loggingIn ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Demo Account: <br />
              <span className="font-mono text-xs">john.doe@example.com</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 shadow-lg">
        <div className="p-6">
          <div className="flex items-center mb-8">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white">💰</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Cash Compass
            </h1>
          </div>

          {/* User Profile */}
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-orange-200 dark:bg-orange-800 rounded-full flex items-center justify-center mr-3">
              <span className="text-orange-600 dark:text-orange-300 font-medium text-sm">
                {user?.name?.charAt(0) || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {user?.name || "User"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email || "user@example.com"}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {[
              { id: "dashboard", icon: "📊", label: "Dashboard" },
              { id: "wallet", icon: "👛", label: "My Wallet" },
              { id: "transactions", icon: "📝", label: "Transactions" },
              { id: "alerts", icon: "⚠️", label: "Crisis Alerts" },
              { id: "chat", icon: "💬", label: "AI Buddy" },
              { id: "settings", icon: "⚙️", label: "Settings" },
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex items-center px-3 py-2 text-sm cursor-pointer rounded-lg transition-all ${
                  activePage === item.id
                    ? "text-gray-700 bg-gray-50 dark:text-white dark:bg-gray-700"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                <div
                  className={`w-1 h-4 rounded-full mr-3 ${
                    activePage === item.id ? "bg-orange-400" : "bg-transparent"
                  }`}
                ></div>
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
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
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-xl">{darkMode ? "☀️" : "🌙"}</span>
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
              <span className="text-xl">🔔</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xl">
              ×
            </button>
          </div>
        )}

        {/* DASHBOARD PAGE (Original) */}
        {activePage === "dashboard" && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold">B</span>
                  </div>
                  <span className="text-green-500">📈</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹24,000
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This Month Income
                </p>
                <p className="text-xs text-green-500 mt-1">+5% This week</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-white">🎯</span>
                  </div>
                  <span className="text-yellow-500">📈</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Medium
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Crisis Score
                </p>
                <p className="text-xs text-yellow-500 mt-1">35% This week</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold">N</span>
                  </div>
                  <span className="text-red-500">📉</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹21,000
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This Month Expenses
                </p>
                <p className="text-xs text-red-500 mt-1">21% This week</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-black dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-white">🐷</span>
                  </div>
                  <span className="text-green-500">📈</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹3,000
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Money Saved
                </p>
                <p className="text-xs text-green-500 mt-1">+12% This week</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Market Overview
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={incomeData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={darkMode ? "#374151" : "#f1f5f9"}
                  />
                  <XAxis
                    dataKey="month"
                    stroke={darkMode ? "#9ca3af" : "#64748b"}
                  />
                  <YAxis stroke={darkMode ? "#9ca3af" : "#64748b"} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#10b981"
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
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
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
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
          </>
        )}

        {/* MY WALLET PAGE */}
        {activePage === "wallet" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">📈</span>
                  <span className="text-sm font-medium">Total Income</span>
                </div>
                <h2 className="text-3xl font-bold">
                  ₹{totalIncome.toLocaleString()}
                </h2>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">📉</span>
                  <span className="text-sm font-medium">Total Expenses</span>
                </div>
                <h2 className="text-3xl font-bold">
                  ₹{totalExpenses.toLocaleString()}
                </h2>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">🐷</span>
                  <span className="text-sm font-medium">Balance</span>
                </div>
                <h2 className="text-3xl font-bold">
                  ₹{balance.toLocaleString()}
                </h2>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Categories
                </h3>
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  <span className="mr-2">➕</span>
                  Add Category
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {categories.length === 0 ? (
                  <div className="col-span-4 text-center py-8 text-gray-500 dark:text-gray-400">
                    No categories yet. Create one to get started!
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat._id}
                      className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all"
                    >
                      <div className="text-3xl mb-2">{cat.icon}</div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {cat.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {cat.type}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TRANSACTIONS PAGE */}
        {activePage === "transactions" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total: {transactions.length} transactions
              </div>
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setTransactionForm({
                    type: "expense",
                    amount: "",
                    category: "",
                    description: "",
                    date: new Date().toISOString().split("T")[0],
                    paymentMethod: "cash",
                  });
                  setShowTransactionModal(true);
                }}
                className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <span className="mr-2">➕</span>
                Add Transaction
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No transactions yet. Add your first transaction!
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => {
                    const category = categories.find(
                      (c) => c._id === transaction.category
                    );
                    return (
                      <div
                        key={transaction._id}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="text-3xl">
                            {category?.icon || "💰"}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {transaction.description}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {category?.name || "Uncategorized"} •{" "}
                              {new Date(transaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span
                            className={`text-lg font-bold ${
                              transaction.type === "income"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}₹
                            {transaction.amount.toLocaleString()}
                          </span>
                          <button
                            onClick={() => {
                              setEditingTransaction(transaction);
                              setTransactionForm({
                                type: transaction.type,
                                amount: transaction.amount,
                                category: transaction.category,
                                description: transaction.description,
                                date: transaction.date.split("T")[0],
                                paymentMethod:
                                  transaction.paymentMethod || "cash",
                              });
                              setShowTransactionModal(true);
                            }}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteTransaction(transaction._id)
                            }
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CRISIS ALERTS PAGE (Original) */}
        {activePage === "alerts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">⚠️</span>
                  <span className="text-xs text-red-500 font-medium">HIGH</span>
                </div>
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  2
                </h2>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Active Alerts
                </p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">⚡</span>
                  <span className="text-xs text-yellow-500 font-medium">
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
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">🎯</span>
                  <span className="text-xs text-green-500 font-medium">
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

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
                Real-time Crisis Monitoring
              </h3>
              <div className="space-y-4">
                {crisisAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border-2 rounded-2xl p-6 ${getSeverityColor(
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
                          <span className="text-2xl">⚠️</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
                            {alert.title}
                          </h4>
                          <p className="text-gray-700 dark:text-gray-300 mb-3">
                            {alert.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">
                              Impact: {alert.impact}
                            </span>
                            <span className="text-xs text-gray-500">
                              {alert.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI CHAT PAGE (Original) */}
        {activePage === "chat" && (
          <div className="h-full">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm h-96 flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mr-4">
                      <span className="text-2xl">💬</span>
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
                  <span className="text-green-500 text-sm">● ONLINE</span>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-2xl max-w-md">
                    <p className="text-sm">
                      👋 Hi! I'm your AI Financial Buddy. I can help you with
                      budgeting, crisis planning, and financial advice. What
                      would you like to know?
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
                      className={`px-4 py-3 rounded-2xl max-w-md ${
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
                    className="flex-1 border-2 border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-500 text-white px-6 py-3 rounded-2xl hover:bg-blue-600 disabled:opacity-50"
                    disabled={!newMessage.trim() || sendingMessage}
                  >
                    {sendingMessage ? "Thinking..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS PAGE */}
        {activePage === "settings" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Profile Settings
              </h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Change Password
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? "Changing..." : "Change Password"}
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Account Actions
              </h3>
              <button
                onClick={handleLogout}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTransaction ? "Edit Transaction" : "Add Transaction"}
              </h3>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="text-2xl"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={
                editingTransaction
                  ? handleUpdateTransaction
                  : handleCreateTransaction
              }
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type
                </label>
                <select
                  value={transactionForm.type}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      type: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  value={transactionForm.amount}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      amount: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={transactionForm.category}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      category: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={transactionForm.description}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      date: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading
                    ? "Saving..."
                    : editingTransaction
                    ? "Update"
                    : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Category
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-2xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type
                </label>
                <select
                  value={categoryForm.type}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, type: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Icon (Emoji)
                </label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, icon: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  maxLength={2}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, color: e.target.value })
                  }
                  className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CashCompassApp;
