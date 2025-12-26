import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, X, Save } from "lucide-react";
import toast from "react-hot-toast";
import type {
  TradingBotConfig,
  Stock,
  Portfolio,
  BotCreateRequest,
} from "../lib/api";
import { botAPI, stockAPI, portfolioAPI } from "../lib/api";

const EditBot: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bot, setBot] = useState<TradingBotConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [allBots, setAllBots] = useState<TradingBotConfig[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    if (id) {
      fetchBot();
      fetchStocks();
      fetchPortfolio();
      fetchAllBots();
    }
  }, [id]);

  useEffect(() => {
    // Fetch all stocks when component mounts
    const fetchAllStocks = async () => {
      setIsLoadingStocks(true);
      try {
        let allStocksData: Stock[] = [];
        let page = 1;
        let hasMore = true;
        const pageSize = 100;

        while (hasMore) {
          const response = await stockAPI.getStocks({
            page,
            page_size: pageSize,
          });
          const data = response.data;
          const results = Array.isArray(data) ? data : data.results || [];
          allStocksData = [...allStocksData, ...results];

          if (Array.isArray(data)) {
            hasMore = false;
          } else {
            const totalCount = data.count || 0;
            const currentCount = allStocksData.length;
            hasMore = currentCount < totalCount && results.length === pageSize;
            if (hasMore) {
              page++;
            }
          }
        }

        setAllStocks(allStocksData);
      } catch (error) {
        console.error("Failed to fetch all stocks:", error);
        setAllStocks(stocks);
      } finally {
        setIsLoadingStocks(false);
      }
    };

    if (stocks.length > 0) {
      fetchAllStocks();
    }
  }, [stocks]);

  const fetchBot = async () => {
    if (!id) return;

    try {
      const response = await botAPI.getBot(id);
      const botData = response.data;
      setBot(botData);

      // Populate form with bot data
      setBotForm({
        name: botData.name || "",
        budget_type: botData.budget_type || "cash",
        budget_cash: botData.budget_cash?.toString() || "",
        budget_portfolio: botData.budget_portfolio || [],
        assigned_stocks: botData.assigned_stocks || [],
        max_position_size: botData.max_position_size?.toString() || "",
        max_daily_trades: botData.max_daily_trades?.toString() || "",
        max_daily_loss: botData.max_daily_loss?.toString() || "",
        risk_per_trade: botData.risk_per_trade?.toString() || "2.00",
        stop_loss_percent: botData.stop_loss_percent?.toString() || "",
        take_profit_percent: botData.take_profit_percent?.toString() || "",
        enabled_indicators: botData.enabled_indicators || {},
        enabled_patterns: botData.enabled_patterns || {},
        buy_rules: botData.buy_rules || {},
        sell_rules: botData.sell_rules || {},
      });
      // Initialize JSON fields with formatted strings
      setJsonFields({
        enabled_indicators: JSON.stringify(
          botData.enabled_indicators || {},
          null,
          2
        ),
        enabled_patterns: JSON.stringify(
          botData.enabled_patterns || {},
          null,
          2
        ),
        buy_rules: JSON.stringify(botData.buy_rules || {}, null, 2),
        sell_rules: JSON.stringify(botData.sell_rules || {}, null, 2),
      });
    } catch (error) {
      console.error("Failed to load bot:", error);
      toast.error("Failed to load bot");
      navigate("/trading-bots");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStocks = async () => {
    try {
      const response = await stockAPI.getStocks({ page_size: 50 });
      const data = response.data;
      setStocks(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error("Failed to load stocks:", error);
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

  const fetchAllBots = async () => {
    try {
      const response = await botAPI.getBots();
      const data = response.data;
      const botsData = Array.isArray(data) ? data : data.results || [];
      setAllBots(botsData);
    } catch (error) {
      console.error("Failed to load bots:", error);
    }
  };

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
  allBots.forEach((b) => {
    // Skip the current bot being edited
    if (b.id === id) {
      return;
    }
    // Collect portfolio IDs assigned to other bots
    if (b.budget_portfolio && Array.isArray(b.budget_portfolio)) {
      b.budget_portfolio.forEach((portfolioId) => {
        assignedPortfolioIds.add(portfolioId);
      });
    }
  });

  // Filter portfolio to exclude positions already assigned to other bots
  const availablePortfolio = portfolio.filter(
    (pos) => !assignedPortfolioIds.has(pos.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSaving(true);
    try {
      const updateData: Partial<BotCreateRequest> = {
        name: botForm.name,
        budget_type: botForm.budget_type,
        assigned_stocks: botForm.assigned_stocks,
        risk_per_trade: parseFloat(botForm.risk_per_trade),
        enabled_indicators: botForm.enabled_indicators,
        enabled_patterns: botForm.enabled_patterns,
        buy_rules: botForm.buy_rules,
        sell_rules: botForm.sell_rules,
      };

      if (botForm.budget_type === "cash") {
        updateData.budget_cash = botForm.budget_cash
          ? parseFloat(botForm.budget_cash)
          : undefined;
      } else {
        updateData.budget_portfolio = botForm.budget_portfolio;
      }

      if (botForm.max_position_size) {
        updateData.max_position_size = parseFloat(botForm.max_position_size);
      }
      if (botForm.max_daily_trades) {
        updateData.max_daily_trades = parseInt(botForm.max_daily_trades);
      }
      if (botForm.max_daily_loss) {
        updateData.max_daily_loss = parseFloat(botForm.max_daily_loss);
      }
      if (botForm.stop_loss_percent) {
        updateData.stop_loss_percent = parseFloat(botForm.stop_loss_percent);
      }
      if (botForm.take_profit_percent) {
        updateData.take_profit_percent = parseFloat(
          botForm.take_profit_percent
        );
      }

      await botAPI.updateBot(id, updateData);
      toast.success("Bot updated successfully");
      navigate(`/trading-bots/${id}`);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.detail ||
        "Failed to update bot";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
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
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/trading-bots/${id}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Bot Details
          </button>

          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">
              Edit Bot: {bot.name}
            </h1>
          </div>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg border border-gray-700 p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Bot Name *
              </label>
              <input
                type="text"
                required
                value={botForm.name}
                onChange={(e) =>
                  setBotForm({ ...botForm, name: e.target.value })
                }
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                placeholder="My Trading Bot"
              />
            </div>

            {/* Budget Type */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Budget Type *
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="10000.00"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Select Portfolio Positions *
                </label>
                {availablePortfolio.length === 0 ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 sm:p-4">
                    <p className="text-yellow-400 text-xs sm:text-sm text-center">
                      {portfolio.length === 0
                        ? "No portfolio positions available"
                        : `All ${portfolio.length} portfolio position(s) are already assigned to other bots`}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-gray-600 rounded-lg p-2 space-y-2">
                    {availablePortfolio.map((pos) => (
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
                                budget_portfolio:
                                  botForm.budget_portfolio.filter(
                                    (id: string) => id !== pos.id
                                  ),
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-white text-xs sm:text-sm">
                          {pos.stock_symbol} - {pos.quantity} shares
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assigned Stocks */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Assigned Stocks * (Select stocks bot can trade)
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stocks..."
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500 mb-2"
              />
              <div className="max-h-60 overflow-y-auto border border-gray-600 rounded-lg p-2 space-y-2">
                {isLoadingStocks ? (
                  <p className="text-gray-400 text-sm text-center py-4">
                    Loading stocks...
                  </p>
                ) : filteredStocks.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">
                    {searchQuery && searchQuery.trim().length > 0
                      ? "No stocks found matching your search"
                      : "No stocks available"}
                  </p>
                ) : (
                  filteredStocks.map((stock) => (
                    <label
                      key={stock.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer"
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
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-white text-sm">
                        {stock.symbol} - {stock.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {botForm.assigned_stocks.length} stock(s) selected
              </p>
            </div>

            {/* Risk Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="2.00"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Max Position Size
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={botForm.max_position_size}
                  onChange={(e) =>
                    setBotForm({
                      ...botForm,
                      max_position_size: e.target.value,
                    })
                  }
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Max Daily Trades
                </label>
                <input
                  type="number"
                  min="0"
                  value={botForm.max_daily_trades}
                  onChange={(e) =>
                    setBotForm({ ...botForm, max_daily_trades: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={botForm.stop_loss_percent}
                  onChange={(e) =>
                    setBotForm({
                      ...botForm,
                      stop_loss_percent: e.target.value,
                    })
                  }
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Rules Configuration */}
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
                rows={8}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder='{"rsi": {"enabled": true, "threshold": 30}}'
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
                rows={8}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder='{"rsi": {"enabled": true, "threshold": 70}}'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enabled Indicators (JSON - Advanced)
              </label>
              <textarea
                value={jsonFields.enabled_indicators}
                onChange={(e) => {
                  const value = e.target.value;
                  setJsonFields({ ...jsonFields, enabled_indicators: value });
                  try {
                    setBotForm({
                      ...botForm,
                      enabled_indicators: JSON.parse(value),
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
                      enabled_indicators: parsed,
                    });
                    setJsonFields({
                      ...jsonFields,
                      enabled_indicators: JSON.stringify(parsed, null, 2),
                    });
                  } catch {
                    // Keep invalid JSON for user to fix
                  }
                }}
                rows={6}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder='{"rsi": true, "macd": true}'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enabled Patterns (JSON - Advanced)
              </label>
              <textarea
                value={jsonFields.enabled_patterns}
                onChange={(e) => {
                  const value = e.target.value;
                  setJsonFields({ ...jsonFields, enabled_patterns: value });
                  try {
                    setBotForm({
                      ...botForm,
                      enabled_patterns: JSON.parse(value),
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
                      enabled_patterns: parsed,
                    });
                    setJsonFields({
                      ...jsonFields,
                      enabled_patterns: JSON.stringify(parsed, null, 2),
                    });
                  } catch {
                    // Keep invalid JSON for user to fix
                  }
                }}
                rows={6}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder='{"hammer": true, "doji": true}'
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4 border-t border-gray-700">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/trading-bots/${id}`)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default EditBot;
