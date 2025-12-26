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

const TradingBotDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bot, setBot] = useState<TradingBotConfig | null>(null);
  const [executions, setExecutions] = useState<TradingBotExecution[]>([]);
  const [performance, setPerformance] = useState<BotPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "executions" | "performance"
  >("overview");

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
      }
    }
  }, [bot, activeTab]);

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
      toast.success(
        `Bot executed: ${result.buy_signals.length} buy signals, ${result.sell_signals.length} sell signals`
      );
      if (activeTab === "executions") {
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
                className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2"
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
            {(["overview", "executions", "performance"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-2 sm:py-3 border-b-2 transition-colors capitalize font-medium text-sm sm:text-base whitespace-nowrap ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-300 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "overview" && (
            <BotOverviewTab bot={bot} onDelete={handleDeleteBot} />
          )}
          {activeTab === "executions" && (
            <BotExecutionsTab
              executions={executions}
              onRefresh={() => fetchExecutions(bot.id)}
            />
          )}
          {activeTab === "performance" && (
            <BotPerformanceTab
              performance={performance}
              onRefresh={() => fetchPerformance(bot.id)}
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
            <p className="text-gray-400 text-xs sm:text-sm">
              No indicators enabled
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.enabled_indicators || {}).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 pb-2 border-b border-gray-600 last:border-0"
                  >
                    <span className="text-xs sm:text-sm font-medium text-blue-400 capitalize">
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
            <p className="text-gray-400 text-xs sm:text-sm">
              No patterns enabled
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bot.enabled_patterns || {}).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 pb-2 border-b border-gray-600 last:border-0"
                  >
                    <span className="text-xs sm:text-sm font-medium text-purple-400 capitalize">
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
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-2">
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
