import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bot,
  Plus,
  Play,
  Pause,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  BarChart,
  X,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle,
  Clock,
  Edit,
  Search,
  Shield,
  AlertTriangle,
  Maximize,
  ArrowDown,
  ArrowUp,
  Brain,
  MessageSquare,
  Newspaper,
  LineChart,
  Layers,
  GitMerge,
  FileText,
  Gauge,
  BookOpen,
  History,
  Package,
  DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  TradingBotConfig,
  TradingBotExecution,
  BotPerformance,
  Stock,
  Portfolio,
  MLModel,
  Order,
} from "../lib/api";
import { botAPI, stockAPI, portfolioAPI, mlModelAPI } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { SectionCard } from "../components/bots/SectionCard";
import { InfoTooltip } from "../components/bots/InfoTooltip";
import { ThresholdInput } from "../components/bots/ThresholdInput";
import { SignalWeightSlider } from "../components/bots/SignalWeightSlider";
import { MLModelSelector } from "../components/bots/MLModelSelector";
import { SignalSourceToggle } from "../components/bots/SignalSourceToggle";
import { IndicatorGrid } from "../components/bots/IndicatorGrid";
import { PatternGrid } from "../components/bots/PatternGrid";
import { AggregationMethodSelector } from "../components/bots/AggregationMethodSelector";
import { RiskScorePreview } from "../components/bots/RiskScorePreview";
import BotSignalHistoryTab from "../components/bots/BotSignalHistoryTab";
import StockPriceTooltip from "../components/bots/StockPriceTooltip";
import BotPortfolioTab from "../components/bots/BotPortfolioTab";
import BotDetailsTabs from "../components/bots/BotDetailsTabs";
import {
  TOOLTIPS,
  SIGNAL_SOURCE_WEIGHTS,
  AGGREGATION_METHODS,
  INDICATORS,
  PATTERNS,
  getIndicatorThresholds,
  getThresholdLabel,
  formatThresholdValue,
} from "../lib/botConstants";
import { useIndicatorThresholds } from "../contexts/IndicatorThresholdsContext";

const TradingBots: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { thresholds: defaultThresholds } = useIndicatorThresholds();
  const [bots, setBots] = useState<TradingBotConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBot, setSelectedBot] = useState<TradingBotConfig | null>(null);
  const [executions, setExecutions] = useState<TradingBotExecution[]>([]);
  const [performance, setPerformance] = useState<BotPerformance | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "executions"
    | "performance"
    | "signals"
    | "orders"
    | "portfolio"
  >("overview");
  const [showExecutedOrdersModal, setShowExecutedOrdersModal] = useState(false);
  const [executedOrders, setExecutedOrders] = useState<Order[]>([]);
  const [botOrders, setBotOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [showExecutionDetailsModal, setShowExecutionDetailsModal] =
    useState(false);
  const [executionDetails, setExecutionDetails] = useState<any>(null);

  const [botForm, setBotForm] = useState({
    name: "",
    budget_type: "cash" as "cash" | "portfolio",
    budget_cash: "",
    budget_portfolio: [] as string[],
    assigned_stocks: [] as string[],
    max_position_size: "",
    max_daily_trades: "",
    max_daily_loss: "",
    risk_per_trade: "2.00",
    stop_loss_percent: "",
    take_profit_percent: "",
    period_days: "14",
    enabled_indicators: {} as Record<string, any>,
    enabled_patterns: {} as Record<string, any>,
    buy_rules: {} as Record<string, any>,
    sell_rules: {} as Record<string, any>,
    enabled_ml_models: [] as string[],
    ml_model_weights: {} as Record<string, number>,
    enable_social_analysis: false,
    enable_news_analysis: false,
    signal_aggregation_method: "weighted_average",
    signal_weights: {} as Record<string, number>,
    signal_thresholds: {} as Record<string, any>,
    risk_score_threshold: "80",
    risk_adjustment_factor: "0.40",
    risk_based_position_scaling: true,
    signal_persistence_type: null as "tick_count" | "time_duration" | null,
    signal_persistence_value: "",
  });
  const [mlModels, setMLModels] = useState<MLModel[]>([]);

  // Store raw JSON strings to allow typing invalid JSON while editing
  const [jsonFields, setJsonFields] = useState({
    enabled_indicators: "{}",
    enabled_patterns: "{}",
    buy_rules: "{}",
    sell_rules: "{}",
  });

  useEffect(() => {
    fetchBots();
    fetchStocks();
    fetchPortfolio();
    fetchMLModels();
  }, []);

  const fetchMLModels = async () => {
    try {
      const response = await mlModelAPI.getModels({ is_active: true });
      setMLModels(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load ML models:", error);
    }
  };

  useEffect(() => {
    if (selectedBot) {
      // Reset executions when switching bots
      setExecutions([]);
      if (activeTab === "executions") {
        fetchExecutions(selectedBot.id);
      } else if (activeTab === "performance") {
        fetchPerformance(selectedBot.id);
      } else if (activeTab === "orders") {
        fetchBotOrders(selectedBot.id);
      }
    } else {
      // Reset when no bot is selected
      setExecutions([]);
    }
  }, [selectedBot, activeTab]);

  const fetchBots = async () => {
    try {
      const response = await botAPI.getBots();
      // Handle paginated response (Django REST Framework default)
      let botsData: TradingBotConfig[] = [];

      if (Array.isArray(response.data)) {
        // Direct array response
        botsData = response.data;
      } else if (response.data && typeof response.data === "object") {
        // Paginated response with results array
        if (Array.isArray(response.data.results)) {
          botsData = response.data.results;
        } else if (Array.isArray(response.data)) {
          botsData = response.data;
        }
      }

      setBots(botsData);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load bots:", error);
      toast.error("Failed to load trading bots");
      setIsLoading(false);
      setBots([]); // Set empty array on error
    }
  };

  const fetchStocks = async () => {
    try {
      setIsLoadingStocks(true);
      // Fetch first page of stocks - users can search for specific stocks
      // This avoids making multiple API calls for all pages
      const response = await stockAPI.getStocks({ page: 1 });
      setStocks(response.data.results || []);
    } catch (error) {
      console.error("Failed to load stocks:", error);
      toast.error("Failed to load stocks");
    } finally {
      setIsLoadingStocks(false);
    }
  };

  const fetchPortfolio = async () => {
    try {
      const response = await portfolioAPI.getPortfolio();
      setPortfolio(response.data.results || []);
    } catch (error) {
      console.error("Failed to load portfolio:", error);
    }
  };

  const fetchExecutions = async (botId: string) => {
    try {
      const response = await botAPI.getBotExecutions(botId);
      // Handle both direct array and paginated responses
      let executionsData = response.data;
      if (
        executionsData &&
        typeof executionsData === "object" &&
        "results" in executionsData
      ) {
        executionsData = (executionsData as { results: TradingBotExecution[] })
          .results;
      }
      // Ensure executionsData is an array
      setExecutions(Array.isArray(executionsData) ? executionsData : []);
    } catch (error) {
      console.error("Failed to load executions:", error);
      toast.error("Failed to load bot executions");
      setExecutions([]); // Reset to empty array on error
    }
  };

  const fetchPerformance = async (botId: string) => {
    try {
      const response = await botAPI.getBotPerformance(botId);
      setPerformance(response.data);
    } catch (error) {
      console.error("Failed to load performance:", error);
      toast.error("Failed to load bot performance");
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!botForm.name || botForm.name.trim() === "") {
        toast.error("Bot name is required");
        return;
      }

      if (!botForm.assigned_stocks || botForm.assigned_stocks.length === 0) {
        toast.error("At least one stock must be assigned to the bot");
        return;
      }

      // Validate that at least one budget option is provided
      const hasCash =
        botForm.budget_cash && parseFloat(botForm.budget_cash) > 0;
      const hasPortfolio = botForm.budget_portfolio.length > 0;

      if (!hasCash && !hasPortfolio) {
        toast.error(
          "Please provide at least one: cash budget or portfolio positions"
        );
        return;
      }

      // Determine budget_type based on what's provided
      let budgetType: "cash" | "portfolio" = "cash";
      if (hasPortfolio && !hasCash) {
        budgetType = "portfolio";
      } else if (hasCash && hasPortfolio) {
        // If both are provided, use "cash" as the primary type (backend handles both)
        budgetType = "cash";
      }

      const botData: any = {
        name: botForm.name,
        budget_type: budgetType,
        assigned_stocks: botForm.assigned_stocks,
        risk_per_trade: parseFloat(botForm.risk_per_trade),
      };

      // Add cash budget if provided
      if (hasCash) {
        botData.budget_cash = parseFloat(botForm.budget_cash);
      }

      // Add portfolio positions if provided
      if (hasPortfolio) {
        botData.budget_portfolio = botForm.budget_portfolio;
      }

      if (botForm.max_position_size) {
        botData.max_position_size = parseFloat(botForm.max_position_size);
      }
      if (botForm.max_daily_trades) {
        botData.max_daily_trades = parseInt(botForm.max_daily_trades);
      }
      if (botForm.max_daily_loss) {
        botData.max_daily_loss = parseFloat(botForm.max_daily_loss);
      }
      if (botForm.stop_loss_percent) {
        botData.stop_loss_percent = parseFloat(botForm.stop_loss_percent);
      }
      if (botForm.take_profit_percent) {
        botData.take_profit_percent = parseFloat(botForm.take_profit_percent);
      }
      botData.period_days = parseInt(botForm.period_days) || 14;

      botData.enabled_indicators = botForm.enabled_indicators || {};
      botData.enabled_patterns = botForm.enabled_patterns || {};
      botData.buy_rules = botForm.buy_rules || {};
      botData.sell_rules = botForm.sell_rules || {};
      botData.enabled_ml_models = botForm.enabled_ml_models || [];
      botData.ml_model_weights = botForm.ml_model_weights || {};
      botData.enable_social_analysis = botForm.enable_social_analysis || false;
      botData.enable_news_analysis = botForm.enable_news_analysis || false;
      botData.signal_aggregation_method =
        botForm.signal_aggregation_method || "weighted_average";
      botData.signal_weights = botForm.signal_weights || {};
      botData.signal_thresholds = botForm.signal_thresholds || {};
      if (botForm.risk_score_threshold) {
        botData.risk_score_threshold = parseFloat(botForm.risk_score_threshold);
      }
      if (botForm.risk_adjustment_factor) {
        botData.risk_adjustment_factor = parseFloat(
          botForm.risk_adjustment_factor
        );
      }
      botData.risk_based_position_scaling =
        botForm.risk_based_position_scaling || false;

      // Signal persistence
      botData.signal_persistence_type = botForm.signal_persistence_type;
      if (botForm.signal_persistence_value) {
        botData.signal_persistence_value = parseInt(
          botForm.signal_persistence_value,
          10
        );
      } else {
        botData.signal_persistence_value = null;
      }

      await botAPI.createBot(botData);
      toast.success("Trading bot created successfully!");
      setShowCreateModal(false);
      resetForm();
      fetchBots();
    } catch (error: any) {
      // Handle field-specific errors from backend
      const errorData = error.response?.data;
      if (errorData) {
        // Check for field-specific errors
        if (
          errorData.assigned_stocks &&
          Array.isArray(errorData.assigned_stocks)
        ) {
          toast.error(errorData.assigned_stocks[0]);
          return;
        }
        if (errorData.budget_cash && Array.isArray(errorData.budget_cash)) {
          toast.error(errorData.budget_cash[0]);
          return;
        }
        if (
          errorData.budget_portfolio &&
          Array.isArray(errorData.budget_portfolio)
        ) {
          toast.error(errorData.budget_portfolio[0]);
          return;
        }
        // Check for general error messages
        if (errorData.detail) {
          toast.error(errorData.detail);
          return;
        }
        if (errorData.message) {
          toast.error(errorData.message);
          return;
        }
        // If errorData is an object with multiple field errors, show the first one
        const firstErrorKey = Object.keys(errorData)[0];
        if (firstErrorKey && Array.isArray(errorData[firstErrorKey])) {
          toast.error(errorData[firstErrorKey][0]);
          return;
        }
      }
      // Fallback error message
      toast.error(
        "Failed to create bot. Please check your input and try again."
      );
    }
  };

  const handleToggleBot = async (bot: TradingBotConfig) => {
    try {
      if (bot.is_active) {
        await botAPI.deactivateBot(bot.id);
        toast.success("Bot deactivated");
      } else {
        await botAPI.activateBot(bot.id);
        toast.success("Bot activated");
      }
      // Refresh bots list
      fetchBots();
      // Update selectedBot if it's the same bot that's open in modal
      if (selectedBot && selectedBot.id === bot.id) {
        try {
          const updatedBotResponse = await botAPI.getBot(bot.id);
          setSelectedBot(updatedBotResponse.data);
        } catch (error) {
          console.error("Failed to refresh selected bot:", error);
        }
      }
    } catch (error) {
      toast.error("Failed to toggle bot status");
    }
  };

  const handleExecuteBot = async (bot: TradingBotConfig) => {
    try {
      const response = await botAPI.executeBot(bot.id);
      const result = response.data;

      const tradesExecuted = result.trades_executed || 0;
      const buyExecuted = result.buy_signals.filter(
        (s: any) => s.executed
      ).length;
      const sellExecuted = result.sell_signals.filter(
        (s: any) => s.executed
      ).length;

      let message = `Bot executed: ${result.buy_signals.length} buy signals, ${result.sell_signals.length} sell signals`;
      if (tradesExecuted > 0) {
        message += `. ${tradesExecuted} trades executed (${buyExecuted} buys, ${sellExecuted} sells)`;
        // Show executed orders modal if there are executed orders
        if (result.executed_orders && result.executed_orders.length > 0) {
          setExecutedOrders(result.executed_orders);
          setShowExecutedOrdersModal(true);
        }
      } else {
        message += `. No trades executed`;
      }

      if (result.trade_errors && result.trade_errors.length > 0) {
        message += `. ${result.trade_errors.length} error(s) occurred`;
        toast.error(message);
        console.warn("Trade errors:", result.trade_errors);
      } else {
        toast.success(message);
      }

      // Show execution details modal with all analysis information
      setExecutionDetails(result);
      setShowExecutionDetailsModal(true);

      // Log configurations used for debugging
      if (result.configurations_used) {
        console.log("Bot configurations used:", result.configurations_used);
      }

      if (selectedBot?.id === bot.id) {
        fetchExecutions(bot.id);
        fetchPerformance(bot.id);
        fetchBotOrders(bot.id);
      }

      // Refresh bots list to update any status changes
      fetchBots();
    } catch (error) {
      toast.error("Failed to execute bot");
      console.error("Bot execution error:", error);
    }
  };

  const fetchBotOrders = async (botId: string) => {
    setIsLoadingOrders(true);
    try {
      console.log("Fetching orders for bot:", botId);
      const response = await botAPI.getBotOrders(botId);
      console.log("Bot orders response:", response.data);
      const data = response.data;
      if (Array.isArray(data)) {
        setBotOrders(data);
        console.log("Set orders (array):", data.length);
      } else if (data && typeof data === "object" && "results" in data) {
        const orders = Array.isArray(data.results) ? data.results : [];
        setBotOrders(orders);
        console.log("Set orders (paginated):", orders.length);
      } else {
        setBotOrders([]);
        console.log("No orders found, set empty array");
      }
    } catch (error) {
      console.error("Failed to fetch bot orders:", error);
      setBotOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleDeleteBot = async (bot: TradingBotConfig) => {
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}"?`)) {
      return;
    }
    try {
      await botAPI.deleteBot(bot.id);
      toast.success("Bot deleted successfully");
      fetchBots();
      if (selectedBot?.id === bot.id) {
        setShowDetailsModal(false);
        setSelectedBot(null);
      }
    } catch (error) {
      toast.error("Failed to delete bot");
    }
  };

  const handleViewDetails = (bot: TradingBotConfig) => {
    setSelectedBot(bot);
    setShowDetailsModal(true);
    setActiveTab("overview");
  };

  const handleViewExecutions = (bot: TradingBotConfig) => {
    setSelectedBot(bot);
    setShowDetailsModal(true);
    setActiveTab("executions");
    fetchExecutions(bot.id);
  };

  const resetForm = () => {
    setBotForm({
      name: "",
      budget_type: "cash",
      budget_cash: "",
      budget_portfolio: [],
      assigned_stocks: [],
      max_position_size: "",
      max_daily_trades: "",
      max_daily_loss: "",
      risk_per_trade: "2.00",
      stop_loss_percent: "",
      take_profit_percent: "",
      period_days: "14",
      enabled_indicators: {},
      enabled_patterns: {},
      buy_rules: {},
      sell_rules: {},
      enabled_ml_models: [],
      ml_model_weights: {},
      enable_social_analysis: false,
      enable_news_analysis: false,
      signal_aggregation_method: "weighted_average",
      signal_weights: {},
      signal_thresholds: {},
      risk_score_threshold: "80",
      risk_adjustment_factor: "1.0",
      risk_based_position_scaling: false,
    signal_persistence_type: null,
    signal_persistence_value: "",
    });
    setJsonFields({
      enabled_indicators: "{}",
      enabled_patterns: "{}",
      buy_rules: "{}",
      sell_rules: "{}",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Trading Bots</h1>
            <p className="text-gray-400">
              Automate your trading with rule-based algorithms
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/trading-bots/documentation")}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              title="View Bot System Documentation"
            >
              <BookOpen className="w-5 h-5" />
              <span className="hidden sm:inline">Documentation</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Bot
            </button>
          </div>
        </div>

        {/* Bots Grid */}
        {!Array.isArray(bots) || bots.length === 0 ? (
          <div className="text-center py-20 bg-gray-800/50 rounded-lg border border-gray-700">
            <Bot className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No Trading Bots
            </h3>
            <p className="text-gray-400 mb-6">
              Create your first trading bot to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Bot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(bots) &&
              bots.map((bot) => (
                <motion.div
                  key={bot.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-blue-500/50 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                >
                  {/* Header with Status Indicator */}
                  <div
                    className={`px-5 pt-5 pb-4 ${
                      bot.is_active
                        ? "bg-gradient-to-r from-green-500/10 to-transparent"
                        : "bg-gray-800/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      {/* Bot Icon and Name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`relative p-3 rounded-xl flex-shrink-0 transition-all duration-300 ${
                            bot.is_active
                              ? "bg-gradient-to-br from-green-500/20 to-green-600/10 ring-2 ring-green-500/30"
                              : "bg-gray-700/50 ring-2 ring-gray-600/30"
                          }`}
                        >
                          <Bot
                            className={`w-6 h-6 transition-colors ${
                              bot.is_active ? "text-green-400" : "text-gray-400"
                            }`}
                          />
                          {bot.is_active && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full ring-2 ring-gray-900 animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3
                            className="text-lg sm:text-xl font-bold text-white cursor-pointer hover:text-blue-400 transition-colors truncate mb-1"
                            onClick={() => navigate(`/trading-bots/${bot.id}`)}
                            title={bot.name}
                          >
                            {bot.name}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
                                bot.is_active
                                  ? "bg-green-500/20 text-green-400 border border-green-500/40 shadow-sm shadow-green-500/20"
                                  : "bg-gray-700/60 text-gray-400 border border-gray-600/40"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  bot.is_active
                                    ? "bg-green-400 animate-pulse"
                                    : "bg-gray-400"
                                }`}
                              />
                              {bot.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBot(bot);
                          }}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            bot.is_active
                              ? "hover:bg-yellow-500/20 text-yellow-400"
                              : "hover:bg-green-500/20 text-green-400"
                          }`}
                          title={bot.is_active ? "Deactivate" : "Activate"}
                        >
                          {bot.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(bot);
                          }}
                          className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-all duration-200"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Budget Info */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/40 rounded-lg border border-gray-700/50">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        Budget
                      </span>
                      <span className="text-sm font-bold text-white">
                        {bot.budget_type === "cash"
                          ? `$${Number(bot.budget_cash || 0).toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}`
                          : `${bot.budget_portfolio?.length || 0} position${
                              (bot.budget_portfolio?.length || 0) !== 1
                                ? "s"
                                : ""
                            }`}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="px-5 py-4 flex-1">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {/* Assigned Stocks */}
                      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 hover:border-blue-500/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Stocks
                          </span>
                        </div>
                        <p className="text-xl font-bold text-white">
                          {bot.assigned_stocks.length}
                        </p>
                      </div>

                      {/* Cash Balance */}
                      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 hover:border-blue-500/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Cash
                          </span>
                        </div>
                        <p className="text-xl font-bold text-white">
                          $
                          {Number(bot.cash_balance || 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Risk per Trade */}
                      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 hover:border-blue-500/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Risk
                          </span>
                        </div>
                        <p className="text-xl font-bold text-white">
                          {bot.risk_per_trade}%
                        </p>
                      </div>
                      {/* Total Equity */}
                      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 hover:border-blue-500/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Equity
                          </span>
                        </div>
                        <p
                          className={`text-xl font-bold ${
                            (bot.total_equity || 0) >=
                            (bot.initial_cash || 0) +
                              (bot.initial_portfolio_value || 0)
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          $
                          {Number(bot.total_equity || 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Stop Loss & Take Profit */}
                    {(bot.stop_loss_percent || bot.take_profit_percent) && (
                      <div className="grid grid-cols-2 gap-3">
                        {bot.stop_loss_percent && (
                          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                            <span className="text-xs font-medium text-red-400 uppercase tracking-wide block mb-1">
                              Stop Loss
                            </span>
                            <p className="text-lg font-bold text-red-400">
                              {bot.stop_loss_percent}%
                            </p>
                          </div>
                        )}
                        {bot.take_profit_percent && (
                          <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                            <span className="text-xs font-medium text-green-400 uppercase tracking-wide block mb-1">
                              Take Profit
                            </span>
                            <p className="text-lg font-bold text-green-400">
                              {bot.take_profit_percent}%
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="px-5 pb-5 pt-0">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExecuteBot(bot)}
                        disabled={!bot.is_active}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                          bot.is_active
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40"
                            : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${
                            bot.is_active ? "animate-spin-slow" : ""
                          }`}
                        />
                        <span>Execute</span>
                      </button>
                      <button
                        onClick={() => handleViewExecutions(bot)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700/60 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-all duration-200 border border-gray-600/50 hover:border-gray-600"
                      >
                        <Activity className="w-4 h-4" />
                        <span className="hidden sm:inline">History</span>
                        <span className="sm:hidden">Hist</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        )}

        {/* Create Bot Modal */}
        {showCreateModal && (
          <CreateBotModal
            botForm={botForm}
            setBotForm={setBotForm}
            jsonFields={jsonFields}
            setJsonFields={setJsonFields}
            stocks={stocks}
            portfolio={portfolio}
            bots={bots}
            editingBotId={null}
            mlModels={mlModels}
            onClose={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            onSubmit={handleCreateBot}
          />
        )}

        {/* Bot Details Modal */}
        {showExecutedOrdersModal && (
          <ExecutedOrdersModal
            orders={executedOrders}
            onClose={() => setShowExecutedOrdersModal(false)}
          />
        )}
        {showExecutionDetailsModal && executionDetails && (
          <ExecutionDetailsModal
            executionDetails={executionDetails}
            onClose={() => setShowExecutionDetailsModal(false)}
          />
        )}
        {showDetailsModal && selectedBot && (
          <BotDetailsModal
            bot={selectedBot}
            executions={executions}
            performance={performance}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedBot(null);
            }}
            onDelete={handleDeleteBot}
            onExecute={handleExecuteBot}
            onToggle={handleToggleBot}
            onRefreshExecutions={() => fetchExecutions(selectedBot.id)}
            onRefreshPerformance={() => fetchPerformance(selectedBot.id)}
            botOrders={botOrders}
            isLoadingOrders={isLoadingOrders}
            onRefreshOrders={() => fetchBotOrders(selectedBot.id)}
            defaultThresholds={defaultThresholds}
          />
        )}
      </div>
    </div>
  );
};

// Create Bot Modal Component
interface CreateBotModalProps {
  botForm: any;
  setBotForm: (form: any) => void;
  jsonFields: {
    enabled_indicators: string;
    enabled_patterns: string;
    buy_rules: string;
    sell_rules: string;
  };
  setJsonFields: (fields: {
    enabled_indicators: string;
    enabled_patterns: string;
    buy_rules: string;
    sell_rules: string;
  }) => void;
  stocks: Stock[];
  portfolio: Portfolio[];
  bots: TradingBotConfig[]; // All bots to check for already-assigned portfolio positions
  editingBotId?: string | null; // ID of bot being edited (if any)
  mlModels: MLModel[]; // Available ML models
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const CreateBotModal: React.FC<CreateBotModalProps> = ({
  botForm,
  setBotForm,
  jsonFields,
  setJsonFields,
  stocks,
  portfolio,
  bots,
  editingBotId,
  mlModels,
  onClose,
  onSubmit,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);

  // Fetch all stocks on mount using the new lightweight endpoint
  useEffect(() => {
    const fetchAllStocks = async () => {
      try {
        setIsLoadingStocks(true);
        const response = await stockAPI.getAllStocks();
        const allStocksData = Array.isArray(response.data) ? response.data : [];
        setAllStocks(allStocksData);
      } catch (error) {
        console.error("Failed to fetch all stocks:", error);
        // Fallback to local stocks if API fails
        setAllStocks(stocks);
      } finally {
        setIsLoadingStocks(false);
      }
    };

    fetchAllStocks();
  }, [stocks]); // Include stocks as dependency for fallback

  // Filter all stocks based on search query
  const filteredStocks = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return allStocks;
    }

    const query = searchQuery.toLowerCase();
    return allStocks.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query)
    );
  }, [allStocks, searchQuery]);

  // Get all portfolio position IDs that are already assigned to other bots
  const assignedPortfolioIds = new Set<string>();
  bots.forEach((bot) => {
    // Skip the current bot being edited (if any)
    if (editingBotId && bot.id === editingBotId) {
      return;
    }
    // Collect portfolio IDs assigned to other bots
    if (bot.budget_portfolio && Array.isArray(bot.budget_portfolio)) {
      bot.budget_portfolio.forEach((portfolioId) => {
        assignedPortfolioIds.add(portfolioId);
      });
    }
  });

  // Filter portfolio to exclude positions already assigned to other bots
  const availablePortfolio = portfolio.filter(
    (pos) => !assignedPortfolioIds.has(pos.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Create Trading Bot</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bot Name *
            </label>
            <input
              type="text"
              required
              value={botForm.name}
              onChange={(e) => setBotForm({ ...botForm, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="My Trading Bot"
            />
          </div>

          {/* Analysis Period */}
          <ThresholdInput
            label="Analysis Period"
            icon={LineChart}
            value={botForm.period_days || "14"}
            onChange={(value) =>
              setBotForm({
                ...botForm,
                period_days: String(value),
              })
            }
            type="number"
            min={1}
            max={365}
            step={1}
            tooltip={{
              title: "Analysis Period",
              description:
                "Number of days to look back for indicators and patterns calculation",
            }}
            unit="days"
          />

          {/* Initial Budget Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Initial Budget Configuration *
            </label>
            <p className="text-xs text-gray-400 mb-3">
              You can set both cash and portfolio, or just one of them. At least
              one is required.
            </p>
            {!botForm.budget_cash && botForm.budget_portfolio.length === 0 && (
              <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-400">
                  ⚠️ Please provide at least one: cash budget or portfolio
                  positions
                </p>
              </div>
            )}

            {/* Cash Budget */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Initial Cash Budget ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={botForm.budget_cash}
                onChange={(e) =>
                  setBotForm({ ...botForm, budget_cash: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="10000.00 (optional)"
              />
              <p className="text-xs text-gray-400 mt-1">
                Starting cash amount for the bot to trade with
              </p>
            </div>

            {/* Portfolio Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Initial Portfolio Positions
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-600 rounded-lg p-2 space-y-2">
                {availablePortfolio.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">
                    {portfolio.length === 0
                      ? "No portfolio positions available"
                      : "All portfolio positions are already assigned to other bots"}
                  </p>
                ) : (
                  availablePortfolio.map((pos) => (
                    <label
                      key={pos.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={botForm.budget_portfolio.includes(pos.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBotForm({
                              ...botForm,
                              budget_portfolio: [
                                ...botForm.budget_portfolio,
                                pos.id,
                              ],
                            });
                          } else {
                            setBotForm({
                              ...botForm,
                              budget_portfolio: botForm.budget_portfolio.filter(
                                (id: string) => id !== pos.id
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-white text-sm">
                        {pos.stock_symbol} - {pos.quantity} shares
                      </span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Select existing portfolio positions to assign to the bot
              </p>
            </div>
          </div>

          {/* Assigned Stocks */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Assigned Stocks * (Select stocks bot can trade)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stocks by name or symbol..."
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="mt-2 max-h-60 overflow-y-auto border border-gray-600 rounded-lg bg-gray-800/50 backdrop-blur-sm">
              {isLoadingStocks ? (
                <div className="p-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-600 border-t-blue-500 mb-2"></div>
                  <p className="text-gray-400 text-sm">Loading stocks...</p>
                </div>
              ) : filteredStocks.length === 0 ? (
                <div className="p-6 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-500 opacity-50" />
                  <p className="text-gray-400 text-sm">
                    {searchQuery && searchQuery.trim().length > 0
                      ? "No stocks found matching your search"
                      : "No stocks available"}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredStocks.map((stock) => (
                    <label
                      key={stock.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                        botForm.assigned_stocks.includes(stock.id)
                          ? "bg-blue-600/20 border border-blue-500/30"
                          : "hover:bg-gray-700/50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={botForm.assigned_stocks.includes(stock.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBotForm({
                              ...botForm,
                              assigned_stocks: [
                                ...botForm.assigned_stocks,
                                stock.id,
                              ],
                            });
                          } else {
                            setBotForm({
                              ...botForm,
                              assigned_stocks: botForm.assigned_stocks.filter(
                                (id: string) => id !== stock.id
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">
                            {stock.symbol}
                          </span>
                          <span className="text-gray-400 text-xs">•</span>
                          <span className="text-gray-300 text-sm truncate">
                            {stock.name}
                          </span>
                        </div>
                      </div>
                      {botForm.assigned_stocks.includes(stock.id) && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {botForm.assigned_stocks.length} stock
                {botForm.assigned_stocks.length !== 1 ? "s" : ""} selected
              </p>
              {botForm.assigned_stocks.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBotForm({ ...botForm, assigned_stocks: [] });
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Risk Management Section */}
          <SectionCard
            title="Risk Management"
            icon={Shield}
            defaultOpen={true}
            isComplete={
              !!botForm.risk_per_trade &&
              (!!botForm.budget_cash || botForm.budget_portfolio.length > 0)
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ThresholdInput
                  label="Risk Per Trade"
                  icon={AlertTriangle}
                  value={botForm.risk_per_trade}
                  onChange={(value) =>
                    setBotForm({ ...botForm, risk_per_trade: String(value) })
                  }
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  tooltip={TOOLTIPS.riskPerTrade}
                  unit="%"
                />
                <ThresholdInput
                  label="Max Position Size"
                  icon={Maximize}
                  value={botForm.max_position_size || ""}
                  onChange={(value) =>
                    setBotForm({ ...botForm, max_position_size: String(value) })
                  }
                  type="number"
                  min={0}
                  step={0.0001}
                  tooltip={TOOLTIPS.maxPositionSize}
                  unit="shares"
                />
                <ThresholdInput
                  label="Max Daily Trades"
                  icon={Activity}
                  value={botForm.max_daily_trades || ""}
                  onChange={(value) =>
                    setBotForm({ ...botForm, max_daily_trades: String(value) })
                  }
                  type="number"
                  min={0}
                  tooltip={TOOLTIPS.maxDailyTrades}
                />
                <ThresholdInput
                  label="Max Daily Loss"
                  icon={TrendingDown}
                  value={botForm.max_daily_loss || ""}
                  onChange={(value) =>
                    setBotForm({ ...botForm, max_daily_loss: String(value) })
                  }
                  type="number"
                  min={0}
                  step={0.01}
                  tooltip={TOOLTIPS.maxDailyLoss}
                  unit="$"
                />
                <ThresholdInput
                  label="Stop Loss %"
                  icon={ArrowDown}
                  value={botForm.stop_loss_percent || ""}
                  onChange={(value) =>
                    setBotForm({ ...botForm, stop_loss_percent: String(value) })
                  }
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  tooltip={TOOLTIPS.stopLossPercent}
                  unit="%"
                />
                <ThresholdInput
                  label="Take Profit %"
                  icon={ArrowUp}
                  value={botForm.take_profit_percent || ""}
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      take_profit_percent: String(value),
                    })
                  }
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  tooltip={TOOLTIPS.takeProfitPercent}
                  unit="%"
                />
              </div>

              {/* Risk Score Preview */}
              {botForm.budget_cash && (
                <RiskScorePreview
                  riskPerTrade={parseFloat(botForm.risk_per_trade) || 2}
                  maxPositionSize={
                    botForm.max_position_size
                      ? parseFloat(botForm.max_position_size)
                      : undefined
                  }
                  stopLossPercent={
                    botForm.stop_loss_percent
                      ? parseFloat(botForm.stop_loss_percent)
                      : undefined
                  }
                  takeProfitPercent={
                    botForm.take_profit_percent
                      ? parseFloat(botForm.take_profit_percent)
                      : undefined
                  }
                  budget={parseFloat(botForm.budget_cash) || 0}
                />
              )}
            </div>
          </SectionCard>

          {/* ML Models Section */}
          <SectionCard
            title="ML Models"
            icon={Brain}
            defaultOpen={false}
            isComplete={botForm.enabled_ml_models.length > 0}
          >
            <MLModelSelector
              models={mlModels}
              selectedModels={botForm.enabled_ml_models || []}
              modelWeights={botForm.ml_model_weights || {}}
              onModelsChange={(models) =>
                setBotForm({ ...botForm, enabled_ml_models: models })
              }
              onWeightsChange={(weights) =>
                setBotForm({ ...botForm, ml_model_weights: weights })
              }
            />
          </SectionCard>

          {/* Social Media Analysis Section */}
          <SectionCard
            title="Social Media Analysis"
            icon={MessageSquare}
            defaultOpen={false}
            isComplete={botForm.enable_social_analysis}
          >
            <SignalSourceToggle
              label="Enable Social Media Analysis"
              icon={MessageSquare}
              enabled={botForm.enable_social_analysis}
              onToggle={(enabled) =>
                setBotForm({ ...botForm, enable_social_analysis: enabled })
              }
              tooltip={TOOLTIPS.socialAnalysis}
            >
              <div className="mt-3 space-y-3">
                <SignalWeightSlider
                  label="Social Media Weight"
                  icon={BarChart}
                  value={
                    (botForm.signal_weights?.social ||
                      SIGNAL_SOURCE_WEIGHTS.social.default) * 100
                  }
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      signal_weights: {
                        ...botForm.signal_weights,
                        social: value / 100,
                      },
                    })
                  }
                  tooltip={{
                    title: "Social Media Signal Weight",
                    description:
                      "Weight of social media signals in aggregation",
                  }}
                />
              </div>
            </SignalSourceToggle>
          </SectionCard>

          {/* News Analysis Section */}
          <SectionCard
            title="News Analysis"
            icon={Newspaper}
            defaultOpen={false}
            isComplete={botForm.enable_news_analysis}
          >
            <SignalSourceToggle
              label="Enable News Analysis"
              icon={Newspaper}
              enabled={botForm.enable_news_analysis}
              onToggle={(enabled) =>
                setBotForm({ ...botForm, enable_news_analysis: enabled })
              }
              tooltip={TOOLTIPS.newsAnalysis}
            >
              <div className="mt-3 space-y-3">
                <SignalWeightSlider
                  label="News Weight"
                  icon={BarChart}
                  value={
                    (botForm.signal_weights?.news ||
                      SIGNAL_SOURCE_WEIGHTS.news.default) * 100
                  }
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      signal_weights: {
                        ...botForm.signal_weights,
                        news: value / 100,
                      },
                    })
                  }
                  tooltip={{
                    title: "News Signal Weight",
                    description: "Weight of news signals in aggregation",
                  }}
                />
              </div>
            </SignalSourceToggle>
          </SectionCard>

          {/* Technical Indicators Section */}
          <SectionCard
            title="Technical Indicators"
            icon={LineChart}
            defaultOpen={false}
            isComplete={Object.keys(botForm.enabled_indicators).length > 0}
          >
            <IndicatorGrid
              enabledIndicators={botForm.enabled_indicators}
              onIndicatorsChange={(indicators) =>
                setBotForm({ ...botForm, enabled_indicators: indicators })
              }
            />
          </SectionCard>

          {/* Chart Patterns Section */}
          <SectionCard
            title="Chart Patterns"
            icon={Layers}
            defaultOpen={false}
            isComplete={Object.keys(botForm.enabled_patterns).length > 0}
          >
            <PatternGrid
              enabledPatterns={botForm.enabled_patterns}
              onPatternsChange={(patterns) =>
                setBotForm({ ...botForm, enabled_patterns: patterns })
              }
            />
          </SectionCard>

          {/* Signal Aggregation Section */}
          <SectionCard
            title="Signal Aggregation"
            icon={GitMerge}
            defaultOpen={false}
            isComplete={!!botForm.signal_aggregation_method}
          >
            <div className="space-y-6">
              <AggregationMethodSelector
                value={botForm.signal_aggregation_method}
                onChange={(value) =>
                  setBotForm({ ...botForm, signal_aggregation_method: value })
                }
              />

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-300">
                  Signal Type Weights
                </h4>
                <SignalWeightSlider
                  label={SIGNAL_SOURCE_WEIGHTS.ml.name}
                  icon={Brain}
                  value={
                    (botForm.signal_weights?.ml ||
                      SIGNAL_SOURCE_WEIGHTS.ml.default) * 100
                  }
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      signal_weights: {
                        ...botForm.signal_weights,
                        ml: value / 100,
                      },
                    })
                  }
                />
                <SignalWeightSlider
                  label={SIGNAL_SOURCE_WEIGHTS.indicators.name}
                  icon={LineChart}
                  value={
                    (botForm.signal_weights?.indicators ||
                      SIGNAL_SOURCE_WEIGHTS.indicators.default) * 100
                  }
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      signal_weights: {
                        ...botForm.signal_weights,
                        indicators: value / 100,
                      },
                    })
                  }
                />
                <SignalWeightSlider
                  label={SIGNAL_SOURCE_WEIGHTS.patterns.name}
                  icon={Layers}
                  value={
                    (botForm.signal_weights?.patterns ||
                      SIGNAL_SOURCE_WEIGHTS.patterns.default) * 100
                  }
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      signal_weights: {
                        ...botForm.signal_weights,
                        patterns: value / 100,
                      },
                    })
                  }
                />
                {botForm.enable_social_analysis && (
                  <SignalWeightSlider
                    label={SIGNAL_SOURCE_WEIGHTS.social.name}
                    icon={MessageSquare}
                    value={
                      (botForm.signal_weights?.social ||
                        SIGNAL_SOURCE_WEIGHTS.social.default) * 100
                    }
                    onChange={(value) =>
                      setBotForm({
                        ...botForm,
                        signal_weights: {
                          ...botForm.signal_weights,
                          social: value / 100,
                        },
                      })
                    }
                  />
                )}
                {botForm.enable_news_analysis && (
                  <SignalWeightSlider
                    label={SIGNAL_SOURCE_WEIGHTS.news.name}
                    icon={Newspaper}
                    value={
                      (botForm.signal_weights?.news ||
                        SIGNAL_SOURCE_WEIGHTS.news.default) * 100
                    }
                    onChange={(value) =>
                      setBotForm({
                        ...botForm,
                        signal_weights: {
                          ...botForm.signal_weights,
                          news: value / 100,
                        },
                      })
                    }
                  />
                )}

                {(() => {
                  const totalWeight =
                    (botForm.signal_weights?.ml ||
                      SIGNAL_SOURCE_WEIGHTS.ml.default) +
                    (botForm.signal_weights?.indicators ||
                      SIGNAL_SOURCE_WEIGHTS.indicators.default) +
                    (botForm.signal_weights?.patterns ||
                      SIGNAL_SOURCE_WEIGHTS.patterns.default) +
                    (botForm.enable_social_analysis
                      ? botForm.signal_weights?.social ||
                        SIGNAL_SOURCE_WEIGHTS.social.default
                      : 0) +
                    (botForm.enable_news_analysis
                      ? botForm.signal_weights?.news ||
                        SIGNAL_SOURCE_WEIGHTS.news.default
                      : 0);
                  const totalPercent = totalWeight * 100;

                  return (
                    <div
                      className={`p-3 rounded-lg ${
                        Math.abs(totalPercent - 100) < 0.01
                          ? "bg-green-900/20 border border-green-600"
                          : "bg-yellow-900/20 border border-yellow-600"
                      }`}
                    >
                      <p className="text-sm text-gray-300">
                        Total Weight:{" "}
                        <span className="font-bold">
                          {totalPercent.toFixed(1)}%
                        </span>
                        {Math.abs(totalPercent - 100) >= 0.01 && (
                          <span className="text-yellow-400 ml-2">
                            (Should equal 100%)
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-4 border-t border-gray-600 pt-4">
                <h4 className="text-sm font-semibold text-gray-300">
                  Risk Integration
                </h4>
                <ThresholdInput
                  label="Risk Score Threshold"
                  icon={Shield}
                  value={botForm.risk_score_threshold}
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      risk_score_threshold: String(value),
                    })
                  }
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  tooltip={TOOLTIPS.riskScoreThreshold}
                />
                <ThresholdInput
                  label="Risk Adjustment Factor"
                  icon={Gauge}
                  value={botForm.risk_adjustment_factor}
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      risk_adjustment_factor: String(value),
                    })
                  }
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  tooltip={TOOLTIPS.riskAdjustmentFactor}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Maximize className="w-4 h-4 text-gray-400" />
                    <label className="text-sm font-medium text-gray-300">
                      Risk-Based Position Scaling
                    </label>
                    <InfoTooltip
                      tooltip={{
                        title: "Risk-Based Position Scaling",
                        description:
                          "If enabled, position size is automatically reduced when risk score is high",
                      }}
                    />
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={botForm.risk_based_position_scaling}
                      onChange={(e) =>
                        setBotForm({
                          ...botForm,
                          risk_based_position_scaling: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Signal Persistence Section */}
          <SectionCard
            title="Signal Persistence"
            icon={Activity}
            defaultOpen={false}
            isComplete={
              !botForm.signal_persistence_type ||
              (botForm.signal_persistence_type &&
                botForm.signal_persistence_value)
            }
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Persistence Type
                  <InfoTooltip tooltip="Choose how to confirm signals before execution: Tick Count (N consecutive ticks) or Time Duration (M minutes). Disabled means immediate execution." />
                </label>
                <select
                  value={botForm.signal_persistence_type ?? ""}
                  onChange={(e) => {
                    const newType =
                      e.target.value === ""
                        ? null
                        : (e.target.value as "tick_count" | "time_duration");
                    setBotForm({
                      ...botForm,
                      signal_persistence_type: newType,
                      signal_persistence_value:
                        e.target.value === ""
                          ? ""
                          : botForm.signal_persistence_value,
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Disabled (Immediate Execution)</option>
                  <option value="tick_count">Tick Count (N ticks)</option>
                  <option value="time_duration">
                    Time Duration (M minutes)
                  </option>
                </select>
              </div>

              {botForm.signal_persistence_type && (
                <ThresholdInput
                  label={
                    botForm.signal_persistence_type === "tick_count"
                      ? "Number of Ticks (N)"
                      : "Duration in Minutes (M)"
                  }
                  icon={Activity}
                  value={botForm.signal_persistence_value}
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      signal_persistence_value: String(value),
                    })
                  }
                  type="number"
                  min="1"
                  max={
                    botForm.signal_persistence_type === "tick_count"
                      ? "100"
                      : "1440"
                  }
                  step="1"
                  tooltip={
                    botForm.signal_persistence_type === "tick_count"
                      ? "Number of consecutive ticks that must show the same signal before execution"
                      : "Number of minutes the signal must persist before execution"
                  }
                />
              )}
            </div>
          </SectionCard>

          {/* Trading Rules Section */}
          <SectionCard
            title="Trading Rules"
            icon={FileText}
            defaultOpen={false}
            isComplete={
              Object.keys(botForm.buy_rules).length > 0 ||
              Object.keys(botForm.sell_rules).length > 0
            }
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Buy Rules (JSON - Advanced)
                </label>
                <textarea
                  value={jsonFields.buy_rules}
                  onChange={(e) => {
                    const value = e.target.value;
                    setJsonFields({ ...jsonFields, buy_rules: value });
                    try {
                      setBotForm({
                        ...botForm,
                        buy_rules: JSON.parse(value),
                      });
                    } catch {
                      // Invalid JSON while typing, keep raw string
                    }
                  }}
                  onBlur={(e) => {
                    // Validate on blur and update if valid
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setBotForm({
                        ...botForm,
                        buy_rules: parsed,
                      });
                      setJsonFields({
                        ...jsonFields,
                        buy_rules: JSON.stringify(parsed, null, 2),
                      });
                    } catch {
                      // Keep invalid JSON for user to fix
                    }
                  }}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  rows={4}
                  placeholder='{"operator": "AND", "conditions": [...]}'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sell Rules (JSON - Advanced)
                </label>
                <textarea
                  value={jsonFields.sell_rules}
                  onChange={(e) => {
                    const value = e.target.value;
                    setJsonFields({ ...jsonFields, sell_rules: value });
                    try {
                      setBotForm({
                        ...botForm,
                        sell_rules: JSON.parse(value),
                      });
                    } catch {
                      // Invalid JSON while typing, keep raw string
                    }
                  }}
                  onBlur={(e) => {
                    // Validate on blur and update if valid
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setBotForm({
                        ...botForm,
                        sell_rules: parsed,
                      });
                      setJsonFields({
                        ...jsonFields,
                        sell_rules: JSON.stringify(parsed, null, 2),
                      });
                    } catch {
                      // Keep invalid JSON for user to fix
                    }
                  }}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  rows={4}
                  placeholder='{"operator": "OR", "conditions": [...]}'
                />
              </div>
            </div>
          </SectionCard>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Bot
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// Bot Details Modal Component
interface BotDetailsModalProps {
  bot: TradingBotConfig;
  executions: TradingBotExecution[];
  performance: BotPerformance | null;
  activeTab:
    | "overview"
    | "executions"
    | "performance"
    | "signals"
    | "orders"
    | "portfolio";
  setActiveTab: (
    tab:
      | "overview"
      | "executions"
      | "performance"
      | "signals"
      | "orders"
      | "portfolio"
  ) => void;
  onClose: () => void;
  onDelete: (bot: TradingBotConfig) => void;
  onExecute: (bot: TradingBotConfig) => void;
  onToggle: (bot: TradingBotConfig) => void;
  onRefreshExecutions: () => void;
  onRefreshPerformance: () => void;
  botOrders: Order[];
  isLoadingOrders: boolean;
  onRefreshOrders: () => void;
  defaultThresholds: Record<string, Record<string, number>>;
}

const BotDetailsModal: React.FC<BotDetailsModalProps> = ({
  bot,
  executions,
  performance,
  activeTab,
  setActiveTab,
  onClose,
  onDelete,
  onExecute,
  onToggle,
  onRefreshExecutions,
  onRefreshPerformance,
  botOrders,
  isLoadingOrders,
  onRefreshOrders,
  defaultThresholds,
}) => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            {/* Left Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">
                  {bot.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1 sm:mt-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      bot.is_active
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {bot.is_active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-400">
                    Created {new Date(bot.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            {/* Right Section - Action Buttons */}
            <div className="flex gap-2 items-center justify-end">
              <button
                onClick={() => {
                  navigate(`/trading-bots/${bot.id}`);
                  onClose();
                }}
                className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2"
                title="View Full Details"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">View Full Details</span>
                <span className="sm:hidden">Full Details</span>
              </button>
              <button
                onClick={() => {
                  navigate(`/trading-bots/${bot.id}/edit`);
                  onClose();
                }}
                className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2"
                title="Edit Bot"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => onExecute(bot)}
                disabled={!bot.is_active}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2 ${
                  bot.is_active
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
                }`}
                title={
                  bot.is_active
                    ? "Execute Bot"
                    : "Bot must be active to execute"
                }
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Execute</span>
              </button>
              <button
                onClick={() => onToggle(bot)}
                className="px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs sm:text-sm transition-colors"
                title={bot.is_active ? "Deactivate" : "Activate"}
              >
                <span className="hidden sm:inline">
                  {bot.is_active ? "Deactivate" : "Activate"}
                </span>
                <span className="sm:hidden">
                  {bot.is_active ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </span>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0">
          <BotDetailsTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            variant="modal"
            onTabChange={(tab) => {
              // Fetch orders immediately when orders tab is clicked
              if (tab === "orders" && bot) {
                onRefreshOrders();
              }
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-h-0">
          {activeTab === "overview" && (
            <BotOverviewTab
              bot={bot}
              onDelete={onDelete}
              defaultThresholds={defaultThresholds}
            />
          )}
          {activeTab === "executions" && (
            <BotExecutionsTab
              executions={executions}
              onRefresh={onRefreshExecutions}
              navigate={navigate}
            />
          )}
          {activeTab === "performance" && (
            <BotPerformanceTab
              performance={performance}
              onRefresh={onRefreshPerformance}
            />
          )}
          {activeTab === "signals" && <BotSignalHistoryTab botId={bot.id} />}
          {activeTab === "orders" && (
            <BotOrdersTab
              orders={botOrders}
              isLoading={isLoadingOrders}
              onRefresh={onRefreshOrders}
            />
          )}
          {activeTab === "portfolio" && (
            <BotPortfolioTab
              botId={bot.id}
              botCashBalance={bot.cash_balance}
              botTotalEquity={bot.total_equity}
              botPortfolioValue={bot.portfolio_value}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};

// Bot Overview Tab
const BotOverviewTab: React.FC<{
  bot: TradingBotConfig;
  onDelete: (bot: TradingBotConfig) => void;
  defaultThresholds: Record<string, Record<string, number>>;
}> = ({ bot, onDelete, defaultThresholds }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [mlModels, setMlModels] = useState<MLModel[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch all stocks - use getAllStocks for lightweight data
        try {
          const allStocksResponse = await stockAPI.getAllStocks();
          const allStocks = Array.isArray(allStocksResponse.data)
            ? allStocksResponse.data
            : [];
          setStocks(allStocks);
        } catch {
          // Fallback to paginated endpoint if getAllStocks fails
          const stocksResponse = await stockAPI.getStocks({ page_size: 1000 });
          const stocksData = stocksResponse.data;
          const allStocks = Array.isArray(stocksData)
            ? stocksData
            : stocksData.results || [];
          setStocks(allStocks);
        }

        // Fetch portfolio
        const portfolioResponse = await portfolioAPI.getPortfolio();
        setPortfolio(portfolioResponse.data.results || []);

        // Fetch ML models
        try {
          const mlModelsResponse = await mlModelAPI.getModels();
          const modelsData = mlModelsResponse.data;
          setMlModels(
            Array.isArray(modelsData)
              ? modelsData
              : (modelsData as any).results || []
          );
        } catch (error) {
          console.error("Failed to fetch ML models:", error);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // Create maps for quick lookup
  const stockMap = new Map(stocks.map((s) => [s.id, s]));
  const portfolioMap = new Map(portfolio.map((p) => [p.id, p]));
  const mlModelMap = new Map(mlModels.map((m) => [m.id, m]));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Basic Information
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">Bot ID</span>
            <span className="text-xs sm:text-sm text-white break-all font-mono">
              {bot.id}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">Name</span>
            <span className="text-xs sm:text-sm text-white font-semibold">
              {bot.name}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">Status</span>
            <span
              className={`text-xs sm:text-sm px-2 py-1 rounded ${
                bot.is_active
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              {bot.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">Created At</span>
            <span className="text-xs sm:text-sm text-white">
              {new Date(bot.created_at).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">Updated At</span>
            <span className="text-xs sm:text-sm text-white">
              {new Date(bot.updated_at).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">
              Analysis Period
            </span>
            <span className="text-xs sm:text-sm text-white">
              {bot.period_days
                ? `${bot.period_days} days`
                : "14 days (default)"}
            </span>
          </div>
        </div>
      </div>

      {/* Budget & Stocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
            Budget Type
          </h3>
          <p className="text-xl sm:text-2xl font-bold text-white capitalize">
            {bot.budget_type}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
            Initial Budget
          </h3>
          <p className="text-xl sm:text-2xl font-bold text-white break-words">
            {bot.budget_type === "cash"
              ? `$${Number(bot.budget_cash || 0).toFixed(2)}`
              : `${bot.budget_portfolio?.length || 0} positions`}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
            Assigned Stocks
          </h3>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {bot.assigned_stocks.length}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
            Risk per Trade
          </h3>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {bot.risk_per_trade}%
          </p>
        </div>
      </div>

      {/* Bot Portfolio & Cash Status */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Portfolio & Cash Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              Current Cash
            </h4>
            <p className="text-lg sm:text-xl font-bold text-white">
              ${Number(bot.cash_balance || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              Initial Cash
            </h4>
            <p className="text-lg sm:text-xl font-bold text-white">
              ${Number(bot.initial_cash || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              Portfolio Value
            </h4>
            <p className="text-lg sm:text-xl font-bold text-white">
              ${Number(bot.portfolio_value || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              Initial Portfolio Value
            </h4>
            <p className="text-lg sm:text-xl font-bold text-white">
              ${Number(bot.initial_portfolio_value || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-medium text-gray-400 mb-1 sm:mb-2">
              Total Equity
            </h4>
            <p
              className={`text-lg sm:text-xl font-bold ${(() => {
                const totalEquity = Number(bot.total_equity || 0);
                const initialCash = Number(bot.initial_cash || 0);
                const initialPortfolioValue = Number(
                  bot.initial_portfolio_value || 0
                );
                const initialTotal = initialCash + initialPortfolioValue;
                return !isNaN(totalEquity) &&
                  !isNaN(initialTotal) &&
                  totalEquity >= initialTotal
                  ? "text-green-400"
                  : "text-red-400";
              })()}`}
            >
              $
              {(() => {
                const totalEquity = Number(bot.total_equity || 0);
                return isNaN(totalEquity) ? "0.00" : totalEquity.toFixed(2);
              })()}
            </p>
            {bot.initial_cash !== undefined &&
              bot.initial_portfolio_value !== undefined && (
                <p className="text-xs text-gray-400 mt-1">
                  {(() => {
                    const totalEquity = Number(bot.total_equity || 0);
                    const initialCash = Number(bot.initial_cash || 0);
                    const initialPortfolioValue = Number(
                      bot.initial_portfolio_value || 0
                    );
                    const initialTotal = initialCash + initialPortfolioValue;
                    const gainLoss = totalEquity - initialTotal;

                    if (
                      isNaN(gainLoss) ||
                      isNaN(totalEquity) ||
                      isNaN(initialTotal)
                    ) {
                      return "";
                    }

                    return `${gainLoss >= 0 ? "+" : ""}$${gainLoss.toFixed(2)}`;
                  })()}
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Budget Portfolio Details */}
      {bot.budget_type === "portfolio" &&
        bot.budget_portfolio &&
        bot.budget_portfolio.length > 0 && (
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
              Budget Portfolio Positions
            </h3>
            <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
              {isLoadingData ? (
                <p className="text-gray-400 text-sm">
                  Loading portfolio data...
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bot.budget_portfolio.map((positionId, index) => {
                    const position = portfolioMap.get(positionId);
                    return (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs sm:text-sm"
                        title={positionId}
                      >
                        {position
                          ? `${position.stock_symbol} - ${position.quantity} shares`
                          : positionId}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Assigned Stocks List */}
      {bot.assigned_stocks.length > 0 && (
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
            Assigned Stocks List
          </h3>
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            {isLoadingData ? (
              <p className="text-gray-400 text-sm">Loading stocks data...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bot.assigned_stocks.map((stockId) => {
                  const stock = stockMap.get(stockId);
                  // If stock not found in map, try to find by ID in the stocks array directly
                  const foundStock =
                    stock || stocks.find((s) => s.id === stockId);
                  if (!foundStock) {
                    return (
                      <span
                        key={stockId}
                        className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs sm:text-sm"
                        title={stockId}
                      >
                        Stock ID: {stockId}
                      </span>
                    );
                  }
                  return (
                    <StockPriceTooltip
                      key={stockId}
                      stockSymbol={foundStock.symbol}
                      stockName={foundStock.name}
                    >
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs sm:text-sm">
                        {foundStock.symbol}
                      </span>
                    </StockPriceTooltip>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk & Position Settings */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Risk & Position Settings
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">
              Risk per Trade
            </span>
            <span className="text-xs sm:text-sm text-white">
              {bot.risk_per_trade}%
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">Stop Loss</span>
            <span className="text-xs sm:text-sm text-white">
              {bot.stop_loss_percent ? `${bot.stop_loss_percent}%` : "Not set"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">
              Take Profit
            </span>
            <span className="text-xs sm:text-sm text-white">
              {bot.take_profit_percent
                ? `${bot.take_profit_percent}%`
                : "Not set"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">
              Max Position Size
            </span>
            <span className="text-xs sm:text-sm text-white break-words">
              {bot.max_position_size ? bot.max_position_size : "Not set"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">
              Max Daily Trades
            </span>
            <span className="text-xs sm:text-sm text-white">
              {bot.max_daily_trades ? bot.max_daily_trades : "Not set"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-400">
              Max Daily Loss
            </span>
            <span className="text-xs sm:text-sm text-white break-words">
              {bot.max_daily_loss ? `$${bot.max_daily_loss}` : "Not set"}
            </span>
          </div>
        </div>
      </div>

      {/* Enabled Indicators */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <LineChart className="w-5 h-5 text-blue-400" />
          Enabled Indicators
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          {Object.keys(bot.enabled_indicators || {}).length === 0 ? (
            <p className="text-gray-400 text-sm">No indicators enabled</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(bot.enabled_indicators || {}).map(
                ([key, value]) => {
                  const indicatorDef = INDICATORS.find((i) => i.id === key);
                  const thresholds = getIndicatorThresholds(
                    key,
                    bot.indicator_thresholds,
                    defaultThresholds
                  );

                  return (
                    <div
                      key={key}
                      className="bg-gray-800/50 rounded p-2 border border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {indicatorDef && (
                            <indicatorDef.icon className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="text-sm font-medium text-blue-400 capitalize">
                            {indicatorDef?.name || key}
                          </span>
                        </div>
                        {indicatorDef && (
                          <a
                            href={`/indicators/${indicatorDef.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Maximize className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {thresholds && (
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          <p className="text-xs text-gray-400 mb-1.5 font-semibold">
                            Signal Thresholds:
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {Object.entries(thresholds)
                              .filter(([k, v]) => {
                                // Show all thresholds except those that are 0.0 and are auto-detect types
                                if (v === 0.0) {
                                  // Only hide if it's an auto-detect type (threshold or touch that's 0)
                                  return !(
                                    k.includes("threshold") ||
                                    k.includes("touch") ||
                                    k.includes("breakout") ||
                                    k.includes("breakdown")
                                  );
                                }
                                return true;
                              })
                              .map(([thresholdKey, thresholdValue]) => (
                                <div
                                  key={thresholdKey}
                                  className="flex justify-between items-center"
                                >
                                  <span className="text-gray-400">
                                    {getThresholdLabel(thresholdKey)}:
                                  </span>
                                  <span className="text-white font-medium">
                                    {formatThresholdValue(
                                      thresholdKey,
                                      thresholdValue
                                    )}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {typeof value === "object" &&
                        value !== null &&
                        Object.keys(value).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-700">
                            <p className="text-xs text-gray-400 mb-1.5 font-semibold">
                              Configuration:
                            </p>
                            <div className="space-y-1">
                              {Object.entries(value as Record<string, any>).map(
                                ([k, v]) => (
                                  <div key={k} className="flex gap-2 text-xs">
                                    <span className="text-gray-400 capitalize">
                                      {k}:
                                    </span>
                                    <span className="text-gray-300">
                                      {String(v)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enabled Patterns */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Enabled Patterns
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          {Object.keys(bot.enabled_patterns || {}).length === 0 ? (
            <p className="text-gray-400 text-sm">No patterns enabled</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.enabled_patterns || {}).map(
                ([key, value]) => {
                  const patternDef = PATTERNS.find((p) => p.id === key);
                  return (
                    <div
                      key={key}
                      className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 pb-2 border-b border-gray-600 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {patternDef && (
                          <patternDef.icon className="w-4 h-4 text-purple-400" />
                        )}
                        <span className="text-sm font-medium text-purple-400 capitalize">
                          {patternDef?.name || key}
                        </span>
                        {patternDef && (
                          <a
                            href={`/patterns/${patternDef.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-400 hover:text-purple-300 underline flex items-center gap-1 ml-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Maximize className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-300">
                        {typeof value === "boolean" ? (
                          <span
                            className={
                              value ? "text-green-400" : "text-red-400"
                            }
                          >
                            {value ? "Enabled" : "Disabled"}
                          </span>
                        ) : typeof value === "object" && value !== null ? (
                          <div className="space-y-1">
                            {Object.entries(value as Record<string, any>).map(
                              ([k, v]) => (
                                <div key={k} className="flex gap-2">
                                  <span className="text-gray-400 capitalize">
                                    {k}:
                                  </span>
                                  <span>{String(v)}</span>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <span>{String(value)}</span>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* ML Models Configuration */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          ML Models Configuration
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-3">
          {!bot.enabled_ml_models || bot.enabled_ml_models.length === 0 ? (
            <p className="text-gray-400 text-sm">No ML models enabled</p>
          ) : (
            <div className="space-y-3">
              {(bot.enabled_ml_models || []).map((modelId) => {
                const model = mlModelMap.get(modelId);
                const enabledModels = bot.enabled_ml_models || [];
                const weight =
                  bot.ml_model_weights?.[modelId] ||
                  (enabledModels.length > 0 ? 1 / enabledModels.length : 0);
                return (
                  <div
                    key={modelId}
                    className="flex flex-col sm:flex-row sm:justify-between gap-2 pb-3 border-b border-gray-600 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-400">
                          {model?.name || modelId}
                        </span>
                      </div>
                      {model && (
                        <div className="text-xs text-gray-400 space-y-1">
                          <div>
                            <span className="text-gray-500">Type: </span>
                            <span className="capitalize">
                              {model.model_type}
                            </span>
                          </div>
                          {model.description && (
                            <div className="text-gray-400">
                              {model.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-400">
                        Weight:
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {(weight * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Social Media & News Analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-400" />
            Social Media Analysis
          </h3>
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
              <span className="text-sm text-gray-400">Status</span>
              <span
                className={`text-sm font-semibold ${
                  bot.enable_social_analysis
                    ? "text-green-400"
                    : "text-gray-500"
                }`}
              >
                {bot.enable_social_analysis ? "Enabled" : "Disabled"}
              </span>
            </div>
            {bot.enable_social_analysis && bot.signal_weights?.social && (
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mt-2 pt-2 border-t border-gray-600">
                <span className="text-sm text-gray-400">Signal Weight</span>
                <span className="text-sm font-semibold text-white">
                  {(bot.signal_weights.social * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-orange-400" />
            News Analysis
          </h3>
          <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
              <span className="text-sm text-gray-400">Status</span>
              <span
                className={`text-sm font-semibold ${
                  bot.enable_news_analysis ? "text-green-400" : "text-gray-500"
                }`}
              >
                {bot.enable_news_analysis ? "Enabled" : "Disabled"}
              </span>
            </div>
            {bot.enable_news_analysis && bot.signal_weights?.news && (
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mt-2 pt-2 border-t border-gray-600">
                <span className="text-sm text-gray-400">Signal Weight</span>
                <span className="text-sm font-semibold text-white">
                  {(bot.signal_weights.news * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signal Aggregation Configuration */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <GitMerge className="w-5 h-5 text-purple-400" />
          Signal Aggregation
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pb-3 border-b border-gray-600">
            <span className="text-sm text-gray-400">Aggregation Method</span>
            <span className="text-sm font-semibold text-white capitalize">
              {bot.signal_aggregation_method
                ? AGGREGATION_METHODS.find(
                    (m) => m.id === bot.signal_aggregation_method
                  )?.name || bot.signal_aggregation_method
                : "Not set"}
            </span>
          </div>

          {bot.signal_weights && Object.keys(bot.signal_weights).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Signal Weights
              </h4>
              <div className="space-y-2">
                {Object.entries(bot.signal_weights).map(([key, weight]) => {
                  const sourceInfo =
                    SIGNAL_SOURCE_WEIGHTS[
                      key as keyof typeof SIGNAL_SOURCE_WEIGHTS
                    ];
                  if (!sourceInfo) return null;
                  const Icon = sourceInfo.icon;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-xs sm:text-sm text-gray-300">
                          {sourceInfo.name}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-white">
                        {(Number(weight) * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {bot.signal_thresholds &&
            Object.keys(bot.signal_thresholds).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">
                  Signal Thresholds
                </h4>
                <div className="space-y-1">
                  {Object.entries(bot.signal_thresholds).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between gap-2 text-xs sm:text-sm"
                    >
                      <span className="text-gray-400 capitalize">{key}</span>
                      <span className="text-gray-300">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Enhanced Risk Management */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-yellow-400" />
          Enhanced Risk Management
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-3">
          {bot.risk_score_threshold && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pb-2 border-b border-gray-600">
              <span className="text-sm text-gray-400">
                Risk Score Threshold
              </span>
              <span className="text-sm font-semibold text-white">
                {bot.risk_score_threshold}
              </span>
            </div>
          )}
          {bot.risk_adjustment_factor && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pb-2 border-b border-gray-600">
              <span className="text-sm text-gray-400">
                Risk Adjustment Factor
              </span>
              <span className="text-sm font-semibold text-white">
                {bot.risk_adjustment_factor}
              </span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <span className="text-sm text-gray-400">
              Risk-Based Position Scaling
            </span>
            <span
              className={`text-sm font-semibold ${
                bot.risk_based_position_scaling
                  ? "text-green-400"
                  : "text-gray-500"
              }`}
            >
              {bot.risk_based_position_scaling ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Signal Persistence */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Signal Persistence
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pb-2 border-b border-gray-600">
            <span className="text-sm text-gray-400">Persistence Type</span>
            <span className="text-sm font-semibold text-white capitalize">
              {bot.signal_persistence_type
                ? bot.signal_persistence_type === "tick_count"
                  ? "Tick Count"
                  : "Time Duration"
                : "Disabled (Immediate Execution)"}
            </span>
          </div>
          {bot.signal_persistence_type && bot.signal_persistence_value && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
              <span className="text-sm text-gray-400">
                {bot.signal_persistence_type === "tick_count"
                  ? "Number of Ticks (N)"
                  : "Duration in Minutes (M)"}
              </span>
              <span className="text-sm font-semibold text-white">
                {bot.signal_persistence_value}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Buy Rules */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Buy Rules
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          {Object.keys(bot.buy_rules || {}).length === 0 ? (
            <p className="text-gray-400 text-sm">No buy rules configured</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.buy_rules || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 pb-2 border-b border-gray-600 last:border-0"
                >
                  <span className="text-sm font-medium text-green-400 capitalize">
                    {key}
                  </span>
                  <div className="text-xs sm:text-sm text-gray-300">
                    {typeof value === "boolean" ? (
                      <span
                        className={value ? "text-green-400" : "text-red-400"}
                      >
                        {value ? "Enabled" : "Disabled"}
                      </span>
                    ) : typeof value === "object" && value !== null ? (
                      <div className="space-y-1">
                        {Object.entries(value as Record<string, any>).map(
                          ([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-gray-400 capitalize">
                                {k}:
                              </span>
                              <span>{String(v)}</span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <span>{String(value)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sell Rules */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Sell Rules
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          {Object.keys(bot.sell_rules || {}).length === 0 ? (
            <p className="text-gray-400 text-sm">No sell rules configured</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.sell_rules || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 pb-2 border-b border-gray-600 last:border-0"
                >
                  <span className="text-sm font-medium text-red-400 capitalize">
                    {key}
                  </span>
                  <div className="text-xs sm:text-sm text-gray-300">
                    {typeof value === "boolean" ? (
                      <span
                        className={value ? "text-green-400" : "text-red-400"}
                      >
                        {value ? "Enabled" : "Disabled"}
                      </span>
                    ) : typeof value === "object" && value !== null ? (
                      <div className="space-y-1">
                        {Object.entries(value as Record<string, any>).map(
                          ([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-gray-400 capitalize">
                                {k}:
                              </span>
                              <span>{String(v)}</span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <span>{String(value)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 sm:pt-4 border-t border-gray-700">
        <button
          onClick={() => onDelete(bot)}
          className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <Trash2 className="w-4 h-4" />
          Delete Bot
        </button>
      </div>
    </div>
  );
};

// Bot Executions Tab
const BotExecutionsTab: React.FC<{
  executions: TradingBotExecution[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}> = ({ executions, onRefresh }) => {
  const getActionIcon = (action: string) => {
    switch (action) {
      case "buy":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "sell":
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-white">
          Execution History
        </h3>
        <button
          onClick={onRefresh}
          className="px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {!executions || executions.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-gray-700/50 rounded-lg">
          <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-400">
            No executions yet
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {(Array.isArray(executions) ? executions : []).map((execution) => (
            <div
              key={execution.id}
              className="bg-gray-700/50 rounded-lg p-3 sm:p-4 border border-gray-600"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {getActionIcon(execution.action)}
                      <div>
                        <h4 className="text-sm sm:text-base text-white font-medium">
                          {execution.stock_symbol}
                        </h4>
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm text-gray-400 capitalize">
                            {execution.action}
                          </p>
                          <span className="text-xs text-gray-500">•</span>
                          <p className="text-xs sm:text-sm text-gray-400">
                            {new Date(execution.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-left sm:text-right">
                        <p className="text-xs sm:text-sm text-gray-400">
                          {new Date(execution.timestamp).toLocaleTimeString()}
                        </p>
                        {execution.risk_score && (
                          <p
                            className={`text-xs font-medium ${
                              execution.risk_score > 70
                                ? "text-red-400"
                                : execution.risk_score > 50
                                ? "text-yellow-400"
                                : "text-green-400"
                            }`}
                          >
                            Risk: {execution.risk_score}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    window.open(
                      `/executions/${execution.id}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                  className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                  title="View detailed timeline"
                >
                  <Maximize className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>

              {/* Summary Info */}
              <div className="mb-2">
                <p className="text-xs sm:text-sm text-gray-300 mb-2 break-words">
                  {execution.reason}
                </p>
                {execution.indicators_data &&
                  Object.keys(execution.indicators_data).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.keys(execution.indicators_data)
                        .slice(0, 5)
                        .map((key) => (
                          <span
                            key={key}
                            className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400"
                          >
                            {key.replace(/_/g, " ")}
                          </span>
                        ))}
                      {Object.keys(execution.indicators_data).length > 5 && (
                        <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400">
                          +{Object.keys(execution.indicators_data).length - 5}{" "}
                          more
                        </span>
                      )}
                    </div>
                  )}
                {execution.patterns_detected &&
                  Object.keys(execution.patterns_detected).length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">
                        Patterns:{" "}
                        {Object.keys(execution.patterns_detected).length}{" "}
                        detected
                      </p>
                    </div>
                  )}
                {execution.executed_order && (
                  <div className="flex items-center gap-2 text-xs text-green-400 mt-2">
                    <CheckCircle className="w-3 h-3" />
                    Order executed
                  </div>
                )}
                {execution.action === "skip" && (
                  <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    No trade executed - Click to see full analysis details
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Bot Orders Tab
const BotOrdersTab: React.FC<{
  orders: Order[];
  isLoading: boolean;
  onRefresh: () => void;
}> = ({ orders, isLoading, onRefresh }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 sm:py-12">
        <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4 animate-spin" />
        <p className="text-sm sm:text-base text-gray-400">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <h3 className="text-base sm:text-lg font-semibold text-white">
          Bot Orders ({orders.length})
        </h3>
        <button
          onClick={onRefresh}
          className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-gray-700/50 rounded-lg">
          <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-gray-700/50 rounded-lg p-3 sm:p-4 border border-gray-600"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  {order.transaction_type === "buy" ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <h4 className="text-white font-medium text-sm sm:text-base">
                      {order.stock_symbol}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-400 capitalize">
                      {order.transaction_type} • {order.order_type} •{" "}
                      {order.status}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs sm:text-sm text-gray-400">
                    {formatDate(order.created_at)}
                  </p>
                  {order.executed_at && (
                    <p className="text-xs text-gray-500">
                      Executed: {formatDate(order.executed_at)}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-3">
                <div>
                  <p className="text-xs text-gray-400">Quantity</p>
                  <p className="text-sm sm:text-base text-white font-medium">
                    {order.quantity}
                  </p>
                </div>
                {order.executed_price && (
                  <div>
                    <p className="text-xs text-gray-400">Executed Price</p>
                    <p className="text-sm sm:text-base text-white font-medium">
                      {formatPrice(order.executed_price)}
                    </p>
                  </div>
                )}
                {order.target_price && (
                  <div>
                    <p className="text-xs text-gray-400">Target Price</p>
                    <p className="text-sm sm:text-base text-white font-medium">
                      {formatPrice(order.target_price)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <span
                    className={`text-xs sm:text-sm font-medium ${
                      order.status === "done"
                        ? "text-green-400"
                        : order.status === "waiting"
                        ? "text-yellow-400"
                        : order.status === "cancelled"
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
              {order.notes && (
                <p className="text-xs sm:text-sm text-gray-300 mt-2 break-words">
                  {order.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Execution Details Modal - Shows detailed analysis for all stocks
const ExecutionDetailsModal: React.FC<{
  executionDetails: any;
  onClose: () => void;
}> = ({ executionDetails, onClose }) => {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  const allStocks = [
    ...(executionDetails.buy_signals || []),
    ...(executionDetails.sell_signals || []),
    ...(executionDetails.skipped || []),
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy":
        return "text-green-400 bg-green-500/20";
      case "sell":
        return "text-red-400 bg-red-500/20";
      case "skip":
      case "hold":
        return "text-yellow-400 bg-yellow-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  };

  const renderStockDetails = (stock: any) => {
    return (
      <div className="space-y-4">
        {/* Decision Summary */}
        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
          <h4 className="text-lg font-semibold text-white mb-3">
            Decision Summary
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-400">Action</p>
              <span
                className={`text-sm font-medium px-2 py-1 rounded ${getActionColor(
                  stock.action || "skip"
                )}`}
              >
                {stock.action?.toUpperCase() || "SKIP"}
              </span>
            </div>
            {stock.current_price && (
              <div>
                <p className="text-xs text-gray-400">Current Price</p>
                <p className="text-sm font-medium text-white">
                  {formatPrice(stock.current_price)}
                </p>
              </div>
            )}
            {stock.risk_score !== null && stock.risk_score !== undefined && (
              <div>
                <p className="text-xs text-gray-400">Risk Score</p>
                <p
                  className={`text-sm font-medium ${
                    stock.risk_score > 70
                      ? "text-red-400"
                      : stock.risk_score > 50
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {stock.risk_score.toFixed(2)}
                </p>
              </div>
            )}
            {stock.confidence !== null && stock.confidence !== undefined && (
              <div>
                <p className="text-xs text-gray-400">Confidence</p>
                <p className="text-sm font-medium text-white">
                  {(stock.confidence * 100).toFixed(1)}%
                </p>
              </div>
            )}
            {/* Prediction Preview */}
            {stock.decision_details?.possible_gain !== undefined && (
              <div>
                <p className="text-xs text-gray-400">Possible Gain</p>
                <p className="text-sm font-medium text-green-400">
                  +{(stock.decision_details.possible_gain * 100).toFixed(1)}%
                </p>
              </div>
            )}
            {stock.decision_details?.gain_probability !== undefined && (
              <div>
                <p className="text-xs text-gray-400">Gain Probability</p>
                <p className="text-sm font-medium text-green-400">
                  {(stock.decision_details.gain_probability * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </div>
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-1">Reason</p>
            <p className="text-sm text-gray-300">{stock.reason}</p>
          </div>
        </div>

        {/* Prediction Analysis */}
        {stock.decision_details &&
          (stock.decision_details.possible_gain !== undefined ||
            stock.decision_details.possible_loss !== undefined ||
            stock.decision_details.gain_probability !== undefined ||
            stock.decision_details.timeframe_prediction ||
            stock.decision_details.consequences) && (
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <h4 className="text-lg font-semibold text-white mb-3">
                Prediction Analysis
              </h4>
              <div className="space-y-4">
                {/* Gain/Loss Predictions */}
                {(stock.decision_details.possible_gain !== undefined ||
                  stock.decision_details.possible_loss !== undefined) && (
                  <div className="grid grid-cols-2 gap-3">
                    {stock.decision_details.possible_gain !== undefined && (
                      <div className="bg-green-900/30 border border-green-500/50 rounded p-3">
                        <p className="text-xs text-gray-400 mb-1">
                          Possible Gain
                        </p>
                        <p className="text-lg font-semibold text-green-400">
                          +
                          {(stock.decision_details.possible_gain * 100).toFixed(
                            2
                          )}
                          %
                        </p>
                      </div>
                    )}
                    {stock.decision_details.possible_loss !== undefined && (
                      <div className="bg-red-900/30 border border-red-500/50 rounded p-3">
                        <p className="text-xs text-gray-400 mb-1">
                          Possible Loss
                        </p>
                        <p className="text-lg font-semibold text-red-400">
                          -
                          {(stock.decision_details.possible_loss * 100).toFixed(
                            2
                          )}
                          %
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Probabilities */}
                {(stock.decision_details.gain_probability !== undefined ||
                  stock.decision_details.loss_probability !== undefined) && (
                  <div className="space-y-3">
                    {stock.decision_details.gain_probability !== undefined && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-400">
                            Gain Probability
                          </span>
                          <span className="text-sm text-green-400 font-medium">
                            {(
                              stock.decision_details.gain_probability * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all"
                            style={{
                              width: `${
                                stock.decision_details.gain_probability * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {stock.decision_details.loss_probability !== undefined && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-400">
                            Loss Probability
                          </span>
                          <span className="text-sm text-red-400 font-medium">
                            {(
                              stock.decision_details.loss_probability * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-3">
                          <div
                            className="bg-red-500 h-3 rounded-full transition-all"
                            style={{
                              width: `${
                                stock.decision_details.loss_probability * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeframe Prediction */}
                {stock.decision_details.timeframe_prediction && (
                  <div className="bg-gray-800/50 rounded p-3">
                    <p className="text-sm text-gray-400 mb-2">
                      Expected Timeframe
                    </p>
                    <div className="flex items-center gap-2">
                      {stock.decision_details.timeframe_prediction
                        .min_timeframe && (
                        <span className="text-sm text-gray-500">
                          {
                            stock.decision_details.timeframe_prediction
                              .min_timeframe
                          }
                        </span>
                      )}
                      <span className="text-sm text-gray-400">-</span>
                      {stock.decision_details.timeframe_prediction
                        .max_timeframe && (
                        <span className="text-sm text-gray-500">
                          {
                            stock.decision_details.timeframe_prediction
                              .max_timeframe
                          }
                        </span>
                      )}
                      {stock.decision_details.timeframe_prediction
                        .expected_timeframe && (
                        <>
                          <span className="text-sm text-gray-400">
                            (Expected:
                          </span>
                          <span className="text-sm text-blue-400 font-medium">
                            {
                              stock.decision_details.timeframe_prediction
                                .expected_timeframe
                            }
                          </span>
                          <span className="text-sm text-gray-400">)</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Scenario Analysis */}
                {stock.decision_details.consequences && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400 mb-2">
                      Scenario Analysis
                    </p>
                    {stock.decision_details.consequences.best_case && (
                      <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-green-400">
                            Best Case
                          </span>
                          {stock.decision_details.consequences.best_case
                            .gain !== undefined && (
                            <span className="text-sm text-green-400 font-medium">
                              +
                              {(
                                stock.decision_details.consequences.best_case
                                  .gain * 100
                              ).toFixed(2)}
                              %
                            </span>
                          )}
                        </div>
                        {stock.decision_details.consequences.best_case
                          .probability !== undefined && (
                          <p className="text-xs text-gray-400">
                            Probability:{" "}
                            {(
                              stock.decision_details.consequences.best_case
                                .probability * 100
                            ).toFixed(1)}
                            %
                          </p>
                        )}
                        {stock.decision_details.consequences.best_case
                          .timeframe && (
                          <p className="text-xs text-gray-400">
                            Timeframe:{" "}
                            {
                              stock.decision_details.consequences.best_case
                                .timeframe
                            }
                          </p>
                        )}
                      </div>
                    )}
                    {stock.decision_details.consequences.base_case && (
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-400">
                            Base Case
                          </span>
                          {stock.decision_details.consequences.base_case
                            .gain !== undefined && (
                            <span className="text-sm text-blue-400 font-medium">
                              +
                              {(
                                stock.decision_details.consequences.base_case
                                  .gain * 100
                              ).toFixed(2)}
                              %
                            </span>
                          )}
                        </div>
                        {stock.decision_details.consequences.base_case
                          .probability !== undefined && (
                          <p className="text-xs text-gray-400">
                            Probability:{" "}
                            {(
                              stock.decision_details.consequences.base_case
                                .probability * 100
                            ).toFixed(1)}
                            %
                          </p>
                        )}
                        {stock.decision_details.consequences.base_case
                          .timeframe && (
                          <p className="text-xs text-gray-400">
                            Timeframe:{" "}
                            {
                              stock.decision_details.consequences.base_case
                                .timeframe
                            }
                          </p>
                        )}
                      </div>
                    )}
                    {stock.decision_details.consequences.worst_case && (
                      <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-red-400">
                            Worst Case
                          </span>
                          {stock.decision_details.consequences.worst_case
                            .loss !== undefined && (
                            <span className="text-sm text-red-400 font-medium">
                              -
                              {(
                                stock.decision_details.consequences.worst_case
                                  .loss * 100
                              ).toFixed(2)}
                              %
                            </span>
                          )}
                        </div>
                        {stock.decision_details.consequences.worst_case
                          .probability !== undefined && (
                          <p className="text-xs text-gray-400">
                            Probability:{" "}
                            {(
                              stock.decision_details.consequences.worst_case
                                .probability * 100
                            ).toFixed(1)}
                            %
                          </p>
                        )}
                        {stock.decision_details.consequences.worst_case
                          .timeframe && (
                          <p className="text-xs text-gray-400">
                            Timeframe:{" "}
                            {
                              stock.decision_details.consequences.worst_case
                                .timeframe
                            }
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Decision Details */}
        {stock.decision_details && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold text-white mb-3">
              Decision Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Aggregation Method:</span>
                <span className="text-white">
                  {stock.decision_details.aggregation_method || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Signals Used:</span>
                <span className="text-white">
                  {stock.decision_details.signals_used || 0}
                </span>
              </div>
              {stock.decision_details.risk_score_threshold && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk Threshold:</span>
                  <span className="text-white">
                    {stock.decision_details.risk_score_threshold}
                  </span>
                </div>
              )}
              {stock.decision_details.risk_override && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk Override:</span>
                  <span className="text-red-400">Yes (Risk too high)</span>
                </div>
              )}
              {stock.decision_details.action_scores && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">Action Scores:</p>
                  <div className="space-y-1">
                    {Object.entries(stock.decision_details.action_scores).map(
                      ([action, score]: [string, any]) => (
                        <div key={action} className="flex justify-between">
                          <span className="text-gray-400 capitalize">
                            {action}:
                          </span>
                          <span className="text-white">
                            {(score * 100).toFixed(2)}%
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Indicators */}
        {stock.indicators && Object.keys(stock.indicators).length > 0 && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold text-white mb-3">
              Technical Indicators
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(stock.indicators).map(
                ([key, value]: [string, any]) => (
                  <div key={key} className="bg-gray-800/50 rounded p-2">
                    <p className="text-xs text-gray-400 mb-1">
                      {key.replace(/_/g, " ").toUpperCase()}
                    </p>
                    {value?.current !== null && value?.current !== undefined ? (
                      <p className="text-sm font-medium text-white">
                        {typeof value.current === "number"
                          ? value.current.toFixed(2)
                          : value.current}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">N/A</p>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Patterns */}
        {stock.patterns && stock.patterns.length > 0 && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold text-white mb-3">
              Detected Patterns ({stock.patterns.length})
            </h4>
            <div className="space-y-2">
              {stock.patterns.map((pattern: any, idx: number) => (
                <div key={idx} className="bg-gray-800/50 rounded p-2">
                  <p className="text-sm font-medium text-white capitalize">
                    {pattern.pattern || pattern.name || `Pattern ${idx + 1}`}
                  </p>
                  {pattern.confidence && (
                    <p className="text-xs text-gray-400">
                      Confidence: {(pattern.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                  {pattern.signal && (
                    <p className="text-xs text-gray-400 capitalize">
                      Signal: {pattern.signal}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ML Signals */}
        {stock.ml_signals && stock.ml_signals.length > 0 && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold text-white mb-3">
              ML Model Predictions ({stock.ml_signals.length})
            </h4>
            <div className="space-y-2">
              {stock.ml_signals.map((signal: any, idx: number) => (
                <div key={idx} className="bg-gray-800/50 rounded p-2">
                  <p className="text-sm font-medium text-white">
                    {signal.model_name || `Model ${idx + 1}`}
                  </p>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400 capitalize">
                      Action: {signal.action}
                    </span>
                    {signal.confidence && (
                      <span className="text-xs text-white">
                        Confidence: {(signal.confidence * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Signals */}
        {stock.social_signals && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold text-white mb-3">
              Social Media Sentiment
            </h4>
            <div className="space-y-2 text-sm">
              {stock.social_signals.action && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Sentiment:</span>
                  <span className="text-white capitalize">
                    {stock.social_signals.action}
                  </span>
                </div>
              )}
              {stock.social_signals.confidence && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Confidence:</span>
                  <span className="text-white">
                    {(stock.social_signals.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* News Signals */}
        {stock.news_signals && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold text-white mb-3">
              News Sentiment
            </h4>
            <div className="space-y-2 text-sm">
              {stock.news_signals.action && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Sentiment:</span>
                  <span className="text-white capitalize">
                    {stock.news_signals.action}
                  </span>
                </div>
              )}
              {stock.news_signals.confidence && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Confidence:</span>
                  <span className="text-white">
                    {(stock.news_signals.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 md:p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                Execution Details: {executionDetails.bot_name}
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                {allStocks.length} stock{allStocks.length !== 1 ? "s" : ""}{" "}
                analyzed • {executionDetails.buy_signals?.length || 0} buy •{" "}
                {executionDetails.sell_signals?.length || 0} sell •{" "}
                {executionDetails.skipped?.length || 0} skipped
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {allStocks.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-400 text-sm sm:text-base">
                No stocks analyzed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allStocks.map((stock: any) => (
                <div
                  key={stock.stock}
                  className="bg-gray-700/30 rounded-lg border border-gray-600 overflow-hidden"
                >
                  {/* Stock Header */}
                  <button
                    onClick={() =>
                      setSelectedStock(
                        selectedStock === stock.stock ? null : stock.stock
                      )
                    }
                    className="w-full p-4 flex justify-between items-center hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded text-xs font-medium ${getActionColor(
                          stock.action || "skip"
                        )}`}
                      >
                        {stock.action?.toUpperCase() || "SKIP"}
                      </span>
                      <div className="text-left">
                        <h3 className="text-base font-semibold text-white">
                          {stock.stock}
                        </h3>
                        {stock.stock_name && (
                          <p className="text-xs text-gray-400">
                            {stock.stock_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {stock.risk_score !== null &&
                        stock.risk_score !== undefined && (
                          <div>
                            <p className="text-xs text-gray-400">Risk</p>
                            <p
                              className={`text-sm font-medium ${
                                stock.risk_score > 70
                                  ? "text-red-400"
                                  : stock.risk_score > 50
                                  ? "text-yellow-400"
                                  : "text-green-400"
                              }`}
                            >
                              {stock.risk_score.toFixed(1)}
                            </p>
                          </div>
                        )}
                      {stock.confidence !== null &&
                        stock.confidence !== undefined && (
                          <div>
                            <p className="text-xs text-gray-400">Confidence</p>
                            <p className="text-sm font-medium text-white">
                              {(stock.confidence * 100).toFixed(0)}%
                            </p>
                          </div>
                        )}
                      {selectedStock === stock.stock ? (
                        <ArrowUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ArrowDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expandable Details */}
                  {selectedStock === stock.stock && (
                    <div className="border-t border-gray-600 p-4">
                      {renderStockDetails(stock)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Executed Orders Modal
const ExecutedOrdersModal: React.FC<{
  orders: Order[];
  onClose: () => void;
}> = ({ orders, onClose }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 md:p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                Executed Orders
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                {orders.length} order{orders.length !== 1 ? "s" : ""} executed
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {orders.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-400 text-sm sm:text-base">
                No orders executed
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gray-700/50 rounded-lg p-3 sm:p-4 border border-gray-600"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {order.transaction_type === "buy" ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <h4 className="text-white font-medium text-sm sm:text-base">
                          {order.stock_symbol}
                          {order.stock_details?.name && (
                            <span className="text-gray-400 text-xs sm:text-sm ml-2">
                              {order.stock_details.name}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-400 capitalize">
                          {order.transaction_type} • {order.order_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm text-gray-400">
                        {formatDate(order.executed_at || order.created_at)}
                      </p>
                      <span className="text-xs sm:text-sm text-green-400 font-medium">
                        {order.status}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Quantity</p>
                      <p className="text-sm sm:text-base text-white font-medium">
                        {order.quantity}
                      </p>
                    </div>
                    {order.executed_price && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">
                          Executed Price
                        </p>
                        <p className="text-sm sm:text-base text-white font-medium">
                          {formatPrice(order.executed_price)}
                        </p>
                      </div>
                    )}
                    {order.executed_price && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">
                          Total Value
                        </p>
                        <p className="text-sm sm:text-base text-white font-medium">
                          {formatPrice(order.quantity * order.executed_price)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Order ID</p>
                      <p className="text-xs text-gray-300 font-mono truncate">
                        {order.id}
                      </p>
                    </div>
                  </div>
                  {order.notes && (
                    <p className="text-xs sm:text-sm text-gray-300 mt-3 break-words">
                      {order.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Bot Performance Tab
const BotPerformanceTab: React.FC<{
  performance: BotPerformance | null;
  onRefresh: () => void;
}> = ({ performance, onRefresh }) => {
  if (!performance) {
    return (
      <div className="text-center py-8 sm:py-12">
        <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
        <p className="text-sm sm:text-base text-gray-400 mb-3 sm:mb-4">
          No performance data available
        </p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm sm:text-base"
        >
          Load Performance
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <h3 className="text-base sm:text-lg font-semibold text-white">
          Performance Metrics
        </h3>
        <button
          onClick={onRefresh}
          className="px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm text-gray-400 mb-1">
            Total Trades
          </h4>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {performance.total_trades}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm text-gray-400 mb-1">
            Successful Trades
          </h4>
          <p className="text-xl sm:text-2xl font-bold text-green-400">
            {performance.successful_trades}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Win Rate</h4>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {Number(performance.win_rate || 0).toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Total P&L</h4>
          <p
            className={`text-xl sm:text-2xl font-bold break-words ${
              Number(performance.total_profit_loss || 0) >= 0
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            ${Number(performance.total_profit_loss || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Avg Profit</h4>
          <p className="text-xl sm:text-2xl font-bold text-green-400 break-words">
            ${Number(performance.average_profit || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Avg Loss</h4>
          <p className="text-xl sm:text-2xl font-bold text-red-400 break-words">
            ${Number(performance.average_loss || 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradingBots;
