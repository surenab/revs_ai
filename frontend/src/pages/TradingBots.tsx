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
  X,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle,
  Clock,
  Edit,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  TradingBotConfig,
  TradingBotExecution,
  BotPerformance,
  Stock,
  Portfolio,
} from "../lib/api";
import { botAPI, stockAPI, portfolioAPI } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const TradingBots: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    "overview" | "executions" | "performance"
  >("overview");

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
    enabled_indicators: {} as Record<string, any>,
    enabled_patterns: {} as Record<string, any>,
    buy_rules: {} as Record<string, any>,
    sell_rules: {} as Record<string, any>,
  });

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
  }, []);

  useEffect(() => {
    if (selectedBot) {
      // Reset executions when switching bots
      setExecutions([]);
      if (activeTab === "executions") {
        fetchExecutions(selectedBot.id);
      } else if (activeTab === "performance") {
        fetchPerformance(selectedBot.id);
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
        executionsData = executionsData.results;
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

      const botData: any = {
        name: botForm.name,
        budget_type: botForm.budget_type,
        assigned_stocks: botForm.assigned_stocks,
        risk_per_trade: parseFloat(botForm.risk_per_trade),
      };

      if (botForm.budget_type === "cash") {
        if (!botForm.budget_cash) {
          toast.error("Cash budget is required");
          return;
        }
        botData.budget_cash = parseFloat(botForm.budget_cash);
      } else {
        if (botForm.budget_portfolio.length === 0) {
          toast.error("Please select portfolio positions");
          return;
        }
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

      botData.enabled_indicators = botForm.enabled_indicators;
      botData.enabled_patterns = botForm.enabled_patterns;
      botData.buy_rules = botForm.buy_rules;
      botData.sell_rules = botForm.sell_rules;

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
      toast.success(
        `Bot executed: ${result.buy_signals.length} buy signals, ${result.sell_signals.length} sell signals`
      );
      if (selectedBot?.id === bot.id) {
        fetchExecutions(bot.id);
      }
    } catch (error) {
      toast.error("Failed to execute bot");
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
      enabled_indicators: {},
      enabled_patterns: {},
      buy_rules: {},
      sell_rules: {},
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Trading Bots</h1>
            <p className="text-gray-400">
              Automate your trading with rule-based algorithms
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Bot
          </button>
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
            onClose={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            onSubmit={handleCreateBot}
          />
        )}

        {/* Bot Details Modal */}
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

          {/* Budget Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Budget Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="cash"
                  checked={botForm.budget_type === "cash"}
                  onChange={(e) =>
                    setBotForm({
                      ...botForm,
                      budget_type: e.target.value as "cash" | "portfolio",
                    })
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-white">Cash Budget</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="portfolio"
                  checked={botForm.budget_type === "portfolio"}
                  onChange={(e) =>
                    setBotForm({
                      ...botForm,
                      budget_type: e.target.value as "cash" | "portfolio",
                    })
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-white">Portfolio Budget</span>
              </label>
            </div>
          </div>

          {/* Budget Amount or Portfolio Selection */}
          {botForm.budget_type === "cash" ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cash Budget ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={botForm.budget_cash}
                onChange={(e) =>
                  setBotForm({ ...botForm, budget_cash: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="10000.00"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Portfolio Positions *
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
            </div>
          )}

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

          {/* Risk Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Risk per Trade (%) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                required
                value={botForm.risk_per_trade}
                onChange={(e) =>
                  setBotForm({ ...botForm, risk_per_trade: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="2.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Position Size
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={botForm.max_position_size}
                onChange={(e) =>
                  setBotForm({ ...botForm, max_position_size: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Daily Trades
              </label>
              <input
                type="number"
                min="0"
                value={botForm.max_daily_trades}
                onChange={(e) =>
                  setBotForm({ ...botForm, max_daily_trades: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Daily Loss ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={botForm.max_daily_loss}
                onChange={(e) =>
                  setBotForm({ ...botForm, max_daily_loss: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stop Loss (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={botForm.stop_loss_percent}
                onChange={(e) =>
                  setBotForm({ ...botForm, stop_loss_percent: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Take Profit (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={botForm.take_profit_percent}
                onChange={(e) =>
                  setBotForm({
                    ...botForm,
                    take_profit_percent: e.target.value,
                  })
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Rules Configuration - Simplified for now */}
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
  activeTab: "overview" | "executions" | "performance";
  setActiveTab: (tab: "overview" | "executions" | "performance") => void;
  onClose: () => void;
  onDelete: (bot: TradingBotConfig) => void;
  onExecute: (bot: TradingBotConfig) => void;
  onToggle: (bot: TradingBotConfig) => void;
  onRefreshExecutions: () => void;
  onRefreshPerformance: () => void;
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
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 md:p-6">
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
                className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2"
                title="Execute Bot"
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
        <div className="border-b border-gray-700 bg-gray-800 px-3 sm:px-6 pt-3 pb-0 overflow-y-visible">
          <div className="flex gap-1 sm:gap-2">
            {(["overview", "executions", "performance"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-3 sm:px-6 py-3 sm:py-3.5 border-b-2 transition-all capitalize font-semibold text-sm sm:text-base whitespace-nowrap ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-400 bg-blue-500/20 shadow-sm"
                    : "border-transparent text-gray-300 hover:text-white hover:bg-gray-700/50 hover:border-gray-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {activeTab === "overview" && (
            <BotOverviewTab bot={bot} onDelete={onDelete} />
          )}
          {activeTab === "executions" && (
            <BotExecutionsTab
              executions={executions}
              onRefresh={onRefreshExecutions}
            />
          )}
          {activeTab === "performance" && (
            <BotPerformanceTab
              performance={performance}
              onRefresh={onRefreshPerformance}
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
}> = ({ bot, onDelete }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch all stocks
        const stocksResponse = await stockAPI.getStocks({ page_size: 1000 });
        const stocksData = stocksResponse.data;
        const allStocks = Array.isArray(stocksData)
          ? stocksData
          : stocksData.results || [];
        setStocks(allStocks);

        // Fetch portfolio
        const portfolioResponse = await portfolioAPI.getPortfolio();
        setPortfolio(portfolioResponse.data.results || []);
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
        </div>
      </div>

      {/* Budget & Stocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
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
            Budget Amount
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
                {bot.assigned_stocks.map((stockId, index) => {
                  const stock = stockMap.get(stockId);
                  return (
                    <span
                      key={index}
                      className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs sm:text-sm"
                      title={stockId}
                    >
                      {stock ? `${stock.symbol} - ${stock.name}` : stockId}
                    </span>
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
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Enabled Indicators
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          {Object.keys(bot.enabled_indicators || {}).length === 0 ? (
            <p className="text-gray-400 text-sm">No indicators enabled</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.enabled_indicators || {}).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 pb-2 border-b border-gray-600 last:border-0"
                  >
                    <span className="text-sm font-medium text-blue-400 capitalize">
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
                )
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
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 pb-2 border-b border-gray-600 last:border-0"
                  >
                    <span className="text-sm font-medium text-purple-400 capitalize">
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
                )
              )}
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
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  {getActionIcon(execution.action)}
                  <div>
                    <h4 className="text-sm sm:text-base text-white font-medium">
                      {execution.stock_symbol}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-400 capitalize">
                      {execution.action}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs sm:text-sm text-gray-400">
                    {new Date(execution.timestamp).toLocaleString()}
                  </p>
                  {execution.risk_score && (
                    <p className="text-xs text-gray-500">
                      Risk: {execution.risk_score}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 mb-2 break-words">
                {execution.reason}
              </p>
              {execution.executed_order && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  Order executed
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
