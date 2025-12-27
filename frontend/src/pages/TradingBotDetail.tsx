import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Clock,
  CheckCircle,
  Edit,
  Brain,
  MessageSquare,
  Newspaper,
  GitMerge,
  Shield,
  LineChart,
  Layers,
  History,
  FileText,
  Maximize,
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
import {
  AGGREGATION_METHODS,
  SIGNAL_SOURCE_WEIGHTS,
  INDICATORS,
  PATTERNS,
  getIndicatorThresholds,
  getThresholdLabel,
  formatThresholdValue,
} from "../lib/botConstants";
import { useIndicatorThresholds } from "../contexts/IndicatorThresholdsContext";
import BotSignalHistoryTab from "../components/bots/BotSignalHistoryTab";
import StockPriceTooltip from "../components/bots/StockPriceTooltip";

const TradingBotDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { thresholds: defaultThresholds } = useIndicatorThresholds();

  const [bot, setBot] = useState<TradingBotConfig | null>(null);
  const [executions, setExecutions] = useState<TradingBotExecution[]>([]);
  const [performance, setPerformance] = useState<BotPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "executions" | "performance" | "signals" | "orders"
  >("overview");
  const [botOrders, setBotOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBot();
    }
  }, [id]);

  useEffect(() => {
    if (bot) {
      if (activeTab === "executions") {
        fetchExecutions(bot.id);
      } else if (activeTab === "performance") {
        fetchPerformance(bot.id);
      } else if (activeTab === "orders") {
        fetchBotOrders(bot.id);
      }
    }
  }, [bot, activeTab]);

  const fetchBotOrders = async (botId: string) => {
    setIsLoadingOrders(true);
    try {
      const response = await botAPI.getBotOrders(botId);
      const data = response.data;
      if (Array.isArray(data)) {
        setBotOrders(data);
      } else if (data && typeof data === "object" && "results" in data) {
        setBotOrders(Array.isArray(data.results) ? data.results : []);
      } else {
        setBotOrders([]);
      }
    } catch (error) {
      console.error("Failed to fetch bot orders:", error);
      setBotOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const fetchBot = async () => {
    if (!id) return;

    try {
      const response = await botAPI.getBot(id);
      setBot(response.data);
    } catch (error) {
      console.error("Failed to load bot:", error);
      toast.error("Failed to load bot");
      navigate("/trading-bots");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExecutions = async (botId: string) => {
    try {
      const response = await botAPI.getBotExecutions(botId);
      const data = response.data;
      if (Array.isArray(data)) {
        setExecutions(data);
      } else if (
        data &&
        typeof data === "object" &&
        "results" in data &&
        Array.isArray(data.results)
      ) {
        setExecutions(data.results as TradingBotExecution[]);
      } else {
        setExecutions([]);
      }
    } catch (error) {
      console.error("Failed to load executions:", error);
      toast.error("Failed to load executions");
    }
  };

  const fetchPerformance = async (botId: string) => {
    try {
      const response = await botAPI.getBotPerformance(botId);
      setPerformance(response.data);
    } catch (error) {
      console.error("Failed to load performance:", error);
      toast.error("Failed to load performance");
    }
  };

  const handleToggleBot = async (bot: TradingBotConfig) => {
    try {
      await botAPI.toggleBot(bot.id);
      toast.success(bot.is_active ? "Bot deactivated" : "Bot activated");
      fetchBot(); // Refresh bot data
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

      // Always refresh executions after execution, regardless of active tab
      fetchExecutions(bot.id);

      // Also refresh performance and orders if on those tabs
      if (activeTab === "performance") {
        fetchPerformance(bot.id);
      } else if (activeTab === "orders") {
        fetchBotOrders(bot.id);
      }
    } catch (error) {
      toast.error("Failed to execute bot");
      console.error("Bot execution error:", error);
    }
  };

  const handleDeleteBot = async (bot: TradingBotConfig) => {
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}"?`)) {
      return;
    }
    try {
      await botAPI.deleteBot(bot.id);
      toast.success("Bot deleted successfully");
      navigate("/trading-bots");
    } catch (error) {
      toast.error("Failed to delete bot");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Bot not found</p>
          <button
            onClick={() => navigate("/trading-bots")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Trading Bots
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate("/trading-bots")}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-3 sm:mb-4 transition-colors text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Back to Trading Bots
          </button>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 truncate">
                {bot.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/trading-bots/${bot.id}/edit`)}
                className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => handleExecuteBot(bot)}
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
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Execute</span>
              </button>
              <button
                onClick={() => handleToggleBot(bot)}
                className="px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2"
              >
                {bot.is_active ? (
                  <>
                    <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Deactivate</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Activate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 mb-4 sm:mb-6 overflow-x-auto">
          <div className="flex gap-2 sm:gap-4 min-w-max sm:min-w-0">
            {(
              [
                "overview",
                "executions",
                "performance",
                "signals",
                "orders",
              ] as const
            ).map((tab) => {
              const tabIcons = {
                overview: Activity,
                executions: Clock,
                performance: BarChart3,
                signals: History,
                orders: FileText,
              };
              const Icon = tabIcons[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 py-2 sm:py-3 border-b-2 transition-colors capitalize font-medium text-sm sm:text-base whitespace-nowrap flex items-center gap-2 ${
                    activeTab === tab
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-300 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "overview" && (
            <BotOverviewTab
              bot={bot}
              onDelete={handleDeleteBot}
              defaultThresholds={defaultThresholds}
            />
          )}
          {activeTab === "executions" && (
            <BotExecutionsTab
              executions={executions}
              onRefresh={() => fetchExecutions(bot.id)}
              navigate={navigate}
            />
          )}
          {activeTab === "performance" && (
            <BotPerformanceTab
              performance={performance}
              onRefresh={() => fetchPerformance(bot.id)}
            />
          )}
          {activeTab === "signals" && bot && (
            <BotSignalHistoryTab botId={bot.id} />
          )}
          {activeTab === "orders" && bot && (
            <BotOrdersTab
              orders={botOrders}
              isLoading={isLoadingOrders}
              onRefresh={() => fetchBotOrders(bot.id)}
            />
          )}
        </motion.div>
      </div>
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
            <span className="text-xs sm:text-sm text-white font-semibold truncate">
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
                <p className="text-gray-400 text-xs sm:text-sm">
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
              <p className="text-gray-400 text-xs sm:text-sm">
                Loading stocks data...
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bot.assigned_stocks.map((stockId, index) => {
                  const stock = stockMap.get(stockId);
                  if (!stock) {
                    return (
                      <span
                        key={index}
                        className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs sm:text-sm"
                        title={stockId}
                      >
                        {stockId}
                      </span>
                    );
                  }
                  return (
                    <StockPriceTooltip
                      key={index}
                      stockSymbol={stock.symbol}
                      stockName={stock.name}
                    >
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs sm:text-sm">
                        {stock.symbol}
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
            <p className="text-gray-400 text-xs sm:text-sm">
              No indicators enabled
            </p>
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
                          <span className="text-xs sm:text-sm font-medium text-blue-400 capitalize">
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
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          Enabled Patterns
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          {Object.keys(bot.enabled_patterns || {}).length === 0 ? (
            <p className="text-gray-400 text-xs sm:text-sm">
              No patterns enabled
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.enabled_patterns || {}).map(
                ([key, value]) => {
                  const patternDef = PATTERNS.find((p) => p.id === key);
                  return (
                    <div
                      key={key}
                      className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 pb-2 border-b border-gray-600 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {patternDef && (
                          <patternDef.icon className="w-4 h-4 text-purple-400" />
                        )}
                        <span className="text-xs sm:text-sm font-medium text-purple-400 capitalize">
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
                                  <span className="text-gray-400 capitalize text-xs">
                                    {k}:
                                  </span>
                                  <span className="text-xs">{String(v)}</span>
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
            <p className="text-gray-400 text-xs sm:text-sm">
              No ML models enabled
            </p>
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
                        <span className="text-xs sm:text-sm font-medium text-blue-400">
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
                      <span className="text-xs sm:text-sm font-semibold text-white">
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
              <span className="text-xs sm:text-sm text-gray-400">Status</span>
              <span
                className={`text-xs sm:text-sm font-semibold ${
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
                <span className="text-xs sm:text-sm text-gray-400">
                  Signal Weight
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
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
              <span className="text-xs sm:text-sm text-gray-400">Status</span>
              <span
                className={`text-xs sm:text-sm font-semibold ${
                  bot.enable_news_analysis ? "text-green-400" : "text-gray-500"
                }`}
              >
                {bot.enable_news_analysis ? "Enabled" : "Disabled"}
              </span>
            </div>
            {bot.enable_news_analysis && bot.signal_weights?.news && (
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mt-2 pt-2 border-t border-gray-600">
                <span className="text-xs sm:text-sm text-gray-400">
                  Signal Weight
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
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
            <span className="text-xs sm:text-sm text-gray-400">
              Aggregation Method
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white capitalize">
              {bot.signal_aggregation_method
                ? AGGREGATION_METHODS.find(
                    (m) => m.id === bot.signal_aggregation_method
                  )?.name || bot.signal_aggregation_method
                : "Not set"}
            </span>
          </div>

          {bot.signal_weights && Object.keys(bot.signal_weights).length > 0 && (
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
                <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
              <span className="text-xs sm:text-sm text-gray-400">
                Risk Score Threshold
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white">
                {bot.risk_score_threshold}
              </span>
            </div>
          )}
          {bot.risk_adjustment_factor && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pb-2 border-b border-gray-600">
              <span className="text-xs sm:text-sm text-gray-400">
                Risk Adjustment Factor
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white">
                {bot.risk_adjustment_factor}
              </span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <span className="text-xs sm:text-sm text-gray-400">
              Risk-Based Position Scaling
            </span>
            <span
              className={`text-xs sm:text-sm font-semibold ${
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

      {/* Buy Rules */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Buy Rules
        </h3>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          {Object.keys(bot.buy_rules || {}).length === 0 ? (
            <p className="text-gray-400 text-xs sm:text-sm">
              No buy rules configured
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.buy_rules || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 pb-2 border-b border-gray-600 last:border-0"
                >
                  <span className="text-xs sm:text-sm font-medium text-green-400 capitalize">
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
                              <span className="text-gray-400 capitalize text-xs">
                                {k}:
                              </span>
                              <span className="text-xs">{String(v)}</span>
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
            <p className="text-gray-400 text-xs sm:text-sm">
              No sell rules configured
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.sell_rules || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 pb-2 border-b border-gray-600 last:border-0"
                >
                  <span className="text-xs sm:text-sm font-medium text-red-400 capitalize">
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
                              <span className="text-gray-400 capitalize text-xs">
                                {k}:
                              </span>
                              <span className="text-xs">{String(v)}</span>
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
          className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
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
}> = ({ executions, onRefresh, navigate }) => {
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
          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
          Refresh
        </button>
      </div>

      {!executions || executions.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-gray-700/50 rounded-lg">
          <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">
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
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {getActionIcon(execution.action)}
                    <div>
                      <h4 className="text-white font-medium text-sm sm:text-base">
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

// Bot Performance Tab
const BotPerformanceTab: React.FC<{
  performance: BotPerformance | null;
  onRefresh: () => void;
}> = ({ performance, onRefresh }) => {
  if (!performance) {
    return (
      <div className="text-center py-8 sm:py-12">
        <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
        <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
          No performance data available
        </p>
        <button
          onClick={onRefresh}
          className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm sm:text-base"
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
          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
          <p className="text-xl sm:text-2xl font-bold text-green-400">
            ${Number(performance.average_profit || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Avg Loss</h4>
          <p className="text-xl sm:text-2xl font-bold text-red-400">
            ${Number(performance.average_loss || 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradingBotDetail;
