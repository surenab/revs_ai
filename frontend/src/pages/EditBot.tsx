import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  X,
  Save,
  Bot,
  Wallet,
  DollarSign,
  TrendingUp,
  Shield,
  AlertTriangle,
  Maximize,
  Activity,
  TrendingDown,
  Brain,
  MessageSquare,
  Newspaper,
  LineChart,
  Layers,
  GitMerge,
  Gauge,
  BarChart,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  TradingBotConfig,
  Stock,
  Portfolio,
  BotCreateRequest,
  MLModel,
} from "../lib/api";
import { botAPI, stockAPI, portfolioAPI, mlModelAPI } from "../lib/api";
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
import { TOOLTIPS, SIGNAL_SOURCE_WEIGHTS } from "../lib/botConstants";

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
  const [mlModels, setMlModels] = useState<MLModel[]>([]);
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
    risk_adjustment_factor: "1.0",
    risk_based_position_scaling: false,
    signal_persistence_type: null as "tick_count" | "time_duration" | null,
    signal_persistence_value: "",
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
      fetchMlModels();
    }
  }, [id]);

  useEffect(() => {
    // Fetch all stocks when component mounts
    const fetchAllStocks = async () => {
      setIsLoadingStocks(true);
      try {
        const response = await stockAPI.getAllStocks();
        const allStocksData = Array.isArray(response.data) ? response.data : [];
        setAllStocks(allStocksData);
      } catch (error) {
        console.error("Failed to fetch all stocks:", error);
        setAllStocks(stocks);
      } finally {
        setIsLoadingStocks(false);
      }
    };

    fetchAllStocks();
  }, [stocks]);

  const fetchMlModels = async () => {
    try {
      const response = await mlModelAPI.getModels();
      const modelsData = response.data;
      setMlModels(
        Array.isArray(modelsData)
          ? modelsData
          : (modelsData as any).results || []
      );
    } catch (error) {
      console.error("Failed to fetch ML models:", error);
    }
  };

  const fetchBot = async () => {
    if (!id) return;

    try {
      const response = await botAPI.getBot(id);
      const botData = response.data;
      setBot(botData);

      // Populate form with bot data including all new fields
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
        period_days: botData.period_days?.toString() || "14",
        enabled_indicators: botData.enabled_indicators || {},
        enabled_patterns: botData.enabled_patterns || {},
        buy_rules: botData.buy_rules || {},
        sell_rules: botData.sell_rules || {},
        enabled_ml_models: botData.enabled_ml_models || [],
        ml_model_weights: botData.ml_model_weights || {},
        enable_social_analysis: botData.enable_social_analysis || false,
        enable_news_analysis: botData.enable_news_analysis || false,
        signal_aggregation_method:
          botData.signal_aggregation_method || "weighted_average",
        signal_weights: botData.signal_weights || {},
        signal_thresholds: botData.signal_thresholds || {},
        risk_score_threshold: botData.risk_score_threshold?.toString() || "80",
        risk_adjustment_factor:
          botData.risk_adjustment_factor?.toString() || "1.0",
        risk_based_position_scaling:
          botData.risk_based_position_scaling ?? false,
        signal_persistence_type: botData.signal_persistence_type || null,
        signal_persistence_value:
          botData.signal_persistence_value?.toString() || "",
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
        period_days: parseInt(botForm.period_days) || 14,
        enabled_indicators: botForm.enabled_indicators || {},
        enabled_patterns: botForm.enabled_patterns || {},
        buy_rules: botForm.buy_rules || {},
        sell_rules: botForm.sell_rules || {},
        enabled_ml_models: botForm.enabled_ml_models || [],
        ml_model_weights: botForm.ml_model_weights || {},
        enable_social_analysis: botForm.enable_social_analysis || false,
        enable_news_analysis: botForm.enable_news_analysis || false,
        signal_aggregation_method:
          botForm.signal_aggregation_method || "weighted_average",
        signal_weights: botForm.signal_weights || {},
        signal_thresholds: botForm.signal_thresholds || {},
        risk_based_position_scaling:
          botForm.risk_based_position_scaling || false,
      };

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
      let budgetType: "cash" | "portfolio" = botForm.budget_type;
      if (hasPortfolio && !hasCash) {
        budgetType = "portfolio";
      } else if (hasCash && hasPortfolio) {
        // If both are provided, use "cash" as the primary type (backend handles both)
        budgetType = "cash";
      } else if (hasCash) {
        budgetType = "cash";
      }

      updateData.budget_type = budgetType;

      // Add cash budget if provided
      if (hasCash) {
        updateData.budget_cash = parseFloat(botForm.budget_cash);
      } else {
        updateData.budget_cash = undefined;
      }

      // Add portfolio positions if provided
      if (hasPortfolio) {
        updateData.budget_portfolio = botForm.budget_portfolio;
      } else {
        updateData.budget_portfolio = [];
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
      if (botForm.risk_score_threshold) {
        updateData.risk_score_threshold = parseFloat(
          botForm.risk_score_threshold
        );
      }
      if (botForm.risk_adjustment_factor) {
        updateData.risk_adjustment_factor = parseFloat(
          botForm.risk_adjustment_factor
        );
      }
      updateData.risk_based_position_scaling =
        botForm.risk_based_position_scaling;
      // Signal persistence
      updateData.signal_persistence_type = botForm.signal_persistence_type;
      if (botForm.signal_persistence_value) {
        updateData.signal_persistence_value = parseInt(
          botForm.signal_persistence_value,
          10
        );
      } else {
        updateData.signal_persistence_value = null;
      }

      await botAPI.updateBot(id, updateData);
      toast.success("Bot updated successfully");
      navigate(`/trading-bots/${id}`);
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData) {
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
        if (errorData.detail) {
          toast.error(errorData.detail);
          return;
        }
        if (errorData.message) {
          toast.error(errorData.message);
          return;
        }
        const firstErrorKey = Object.keys(errorData)[0];
        if (firstErrorKey && Array.isArray(errorData[firstErrorKey])) {
          toast.error(errorData[firstErrorKey][0]);
          return;
        }
      }
      toast.error(
        "Failed to update bot. Please check your input and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
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
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Edit Bot: {bot.name}
            </h1>
          </div>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg border border-gray-700 p-4 sm:p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <SectionCard
              title="Basic Information"
              icon={Bot}
              defaultOpen={true}
              isComplete={!!botForm.name && botForm.assigned_stocks.length > 0}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    Bot Name *
                    <InfoTooltip tooltip={TOOLTIPS.botName} />
                  </label>
                  <input
                    type="text"
                    required
                    value={botForm.name}
                    onChange={(e) =>
                      setBotForm({ ...botForm, name: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="My Trading Bot"
                  />
                </div>

                <ThresholdInput
                  label="Analysis Period (Days)"
                  icon={LineChart}
                  value={botForm.period_days || "14"}
                  onChange={(value) =>
                    setBotForm({
                      ...botForm,
                      period_days: String(value),
                    })
                  }
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  required
                  tooltip="Number of days to look back for indicators and patterns calculation"
                />

                {/* Initial Budget Configuration */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    Initial Budget Configuration *
                    <InfoTooltip tooltip="You can set both cash and portfolio, or just one of them. At least one is required." />
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    You can set both cash and portfolio, or just one of them. At
                    least one is required.
                  </p>
                  {!botForm.budget_cash &&
                    botForm.budget_portfolio.length === 0 && (
                      <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-xs text-yellow-400">
                          ⚠️ Please provide at least one: cash budget or
                          portfolio positions
                        </p>
                      </div>
                    )}

                  {/* Cash Budget */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      Initial Cash Budget ($)
                      <InfoTooltip tooltip={TOOLTIPS.budgetCash} />
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
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      Initial Portfolio Positions
                      <InfoTooltip tooltip={TOOLTIPS.budgetPortfolio} />
                    </label>
                    {availablePortfolio.length === 0 ? (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                        <p className="text-yellow-400 text-sm text-center">
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
                              checked={botForm.budget_portfolio.includes(
                                pos.id
                              )}
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
                            <span className="text-white text-sm">
                              {pos.stock_symbol} - {pos.quantity} shares
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Select existing portfolio positions to assign to the bot
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    Assigned Stocks * (Select stocks bot can trade)
                    <InfoTooltip tooltip={TOOLTIPS.assignedStocks} />
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stocks..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-2"
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
                                  assigned_stocks:
                                    botForm.assigned_stocks.filter(
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
              </div>
            </SectionCard>

            {/* Risk Management Section */}
            <SectionCard
              title="Risk Management"
              icon={Shield}
              defaultOpen={false}
              isComplete={
                !!botForm.risk_per_trade &&
                (!!botForm.budget_cash || botForm.budget_portfolio.length > 0)
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ThresholdInput
                    label="Risk per Trade (%)"
                    icon={AlertTriangle}
                    value={botForm.risk_per_trade}
                    onChange={(value) =>
                      setBotForm({ ...botForm, risk_per_trade: String(value) })
                    }
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    required
                    tooltip={TOOLTIPS.riskPerTrade}
                  />
                  <ThresholdInput
                    label="Stop Loss (%)"
                    icon={TrendingDown}
                    value={botForm.stop_loss_percent || ""}
                    onChange={(value) =>
                      setBotForm({
                        ...botForm,
                        stop_loss_percent: String(value),
                      })
                    }
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    tooltip={TOOLTIPS.stopLoss}
                  />
                  <ThresholdInput
                    label="Take Profit (%)"
                    icon={TrendingUp}
                    value={botForm.take_profit_percent || ""}
                    onChange={(value) =>
                      setBotForm({
                        ...botForm,
                        take_profit_percent: String(value),
                      })
                    }
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    tooltip={TOOLTIPS.takeProfit}
                  />
                  <ThresholdInput
                    label="Max Position Size"
                    icon={Maximize}
                    value={botForm.max_position_size || ""}
                    onChange={(value) =>
                      setBotForm({
                        ...botForm,
                        max_position_size: String(value),
                      })
                    }
                    type="number"
                    min="0"
                    step="0.0001"
                    tooltip={TOOLTIPS.maxPositionSize}
                  />
                  <ThresholdInput
                    label="Max Daily Trades"
                    icon={Activity}
                    value={botForm.max_daily_trades || ""}
                    onChange={(value) =>
                      setBotForm({
                        ...botForm,
                        max_daily_trades: String(value),
                      })
                    }
                    type="number"
                    min="0"
                    tooltip={TOOLTIPS.maxDailyTrades}
                  />
                  <ThresholdInput
                    label="Max Daily Loss ($)"
                    icon={DollarSign}
                    value={botForm.max_daily_loss || ""}
                    onChange={(value) =>
                      setBotForm({
                        ...botForm,
                        max_daily_loss: String(value),
                      })
                    }
                    type="number"
                    min="0"
                    step="0.01"
                    tooltip={TOOLTIPS.maxDailyLoss}
                  />
                </div>
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
                    setBotForm({
                      ...botForm,
                      signal_aggregation_method: value,
                    })
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
                </div>
              </div>
            </SectionCard>

            {/* Enhanced Risk Management Section */}
            <SectionCard
              title="Enhanced Risk Management"
              icon={Gauge}
              defaultOpen={false}
              isComplete={!!botForm.risk_score_threshold}
            >
              <div className="space-y-4">
                <RiskScorePreview
                  riskScoreThreshold={botForm.risk_score_threshold}
                  riskAdjustmentFactor={botForm.risk_adjustment_factor}
                  riskBasedPositionScaling={botForm.risk_based_position_scaling}
                />
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
                    min="0"
                    max="100"
                    step="0.1"
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
                    min="0"
                    max="2"
                    step="0.1"
                    tooltip={TOOLTIPS.riskAdjustmentFactor}
                  />
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={botForm.risk_based_position_scaling}
                        onChange={(e) =>
                          setBotForm({
                            ...botForm,
                            risk_based_position_scaling: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-blue-600"
                      />
                      Risk-Based Position Scaling
                    </label>
                    <InfoTooltip tooltip={TOOLTIPS.riskBasedPositionScaling} />
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

            {/* Advanced Rules Section */}
            <SectionCard
              title="Advanced Rules (JSON)"
              icon={Activity}
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
