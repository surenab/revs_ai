import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { simulationAPI, type BotSimulationResult, api } from "../../lib/api";
import { InfoTooltip } from "../../components/bots/InfoTooltip";

interface BotSimulationDay {
  id: string;
  date: string;
  decisions: Record<string, any>;
  performance_metrics: Record<string, any>;
  signal_contributions?: Record<string, any>;
}

interface BotSimulationTick {
  id: string;
  date: string;
  tick_timestamp: string;
  stock_symbol: string;
  tick_price: number;
  decision: {
    action: string;
    reason: string;
    confidence: number;
    risk_score?: number;
    position_size?: number;
  };
  signal_contributions: {
    indicators?: Record<string, any>;
    indicator_signals?: number;
    indicator_signals_list?: Array<{
      source?: string;
      action?: string;
      confidence?: number;
      strength?: number;
      metadata?: Record<string, any>;
    }>;
    pattern_signals?: number;
    ml_signals?: Array<any>;
    social_signals?: any;
    news_signals?: any;
    aggregated_confidence?: number;
    action_scores?: Record<string, number>;
    patterns?: Array<any>;
  };
  portfolio_state: {
    cash: number;
    portfolio_value: number;
    total_value: number;
    positions?: Record<string, any>;
  };
  cumulative_profit: number;
  trade_executed: boolean;
  trade_details?: {
    action?: string;
    quantity?: number;
    price?: number;
    cost?: number;
  };
}

const BotSimulationResultDetail: React.FC = () => {
  const { id, configId } = useParams<{ id: string; configId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<BotSimulationResult | null>(null);
  const [dailyResults, setDailyResults] = useState<BotSimulationDay[] | null>(null);
  const [ticks, setTicks] = useState<BotSimulationTick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedTicks, setExpandedTicks] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (id && configId) {
      loadData();
    }
  }, [id, configId]);

  const loadData = async () => {
    if (!id || !configId) return;

    try {
      setIsLoading(true);

      // Load result detail
      const resultResponse = await simulationAPI.getSimulationResults(id);
      const foundResult = resultResponse.data.results.find(
        (r) => r.simulation_config.id === configId
      );
      if (foundResult) {
        setResult(foundResult);
      }

      // Load daily results (handle pagination)
      try {
        const dailyResponse = await simulationAPI.getDailyResults(configId);
        console.log("Daily results response:", dailyResponse.data);

        // Handle paginated response
        let allDailyResults: BotSimulationDay[] = [];
        const dailyData = dailyResponse.data;

        if (Array.isArray(dailyData)) {
          // Direct array response
          allDailyResults = dailyData;
        } else if (dailyData?.results) {
          // Paginated response - start with first page
          allDailyResults = dailyData.results;

          // Load remaining pages if any
          let nextUrl = dailyData.next;
          while (nextUrl) {
            try {
              // Extract the relative path from the full URL to use with axios instance
              // nextUrl is like: http://localhost:8080/api/v1/simulations/daily-results/.../?page=2
              // We need: /simulations/daily-results/.../?page=2 (without /api/v1 prefix)
              const urlObj = new URL(nextUrl);
              let relativePath = urlObj.pathname + urlObj.search;

              // Remove /api/v1 prefix if present (since axios instance already has it in baseURL)
              if (relativePath.startsWith('/api/v1/')) {
                relativePath = relativePath.replace('/api/v1', '');
              }

              // Use axios instance which includes auth headers
              const nextResponse = await api.get(relativePath);
              const nextData = nextResponse.data;
              if (nextData.results && Array.isArray(nextData.results)) {
                allDailyResults = [...allDailyResults, ...nextData.results];
              }
              nextUrl = nextData.next;
            } catch (pageError: any) {
              console.error("Error loading paginated daily results:", pageError);
              // If it's a 401, we might have auth issues - break to avoid infinite loop
              if (pageError.response?.status === 401) {
                console.error("Unauthorized - stopping pagination");
                break;
              }
              break;
            }
          }
        } else if (dailyData?.data) {
          allDailyResults = Array.isArray(dailyData.data) ? dailyData.data : [];
        }

        setDailyResults(allDailyResults);
      } catch (error: any) {
        console.error("Error loading daily results:", error);
        console.error("Error details:", error.response?.data);
        toast.error(
          error.response?.data?.error || "Failed to load daily results"
        );
        // Continue even if daily results fail
        setDailyResults([]);
      }

      // Load ticks
      try {
        const ticksResponse = await simulationAPI.getTicks(id, {
          bot_config_id: configId,
        });
        // Ensure we have an array
        const ticksData = ticksResponse.data?.ticks || ticksResponse.data || [];
        setTicks(Array.isArray(ticksData) ? ticksData : []);
      } catch (error: any) {
        console.error("Error loading ticks:", error);
        setTicks([]);
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error(
        error.response?.data?.error || "Failed to load result details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
      setSelectedDay(null);
    } else {
      newExpanded.add(date);
      setSelectedDay(date);
    }
    setExpandedDays(newExpanded);
  };

  const toggleTick = (tickId: string) => {
    const newExpanded = new Set(expandedTicks);
    if (newExpanded.has(tickId)) {
      newExpanded.delete(tickId);
    } else {
      newExpanded.add(tickId);
    }
    setExpandedTicks(newExpanded);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy":
        return "text-green-400 bg-green-400/20 border-green-400/30";
      case "sell":
        return "text-red-400 bg-red-400/20 border-red-400/30";
      case "hold":
        return "text-yellow-400 bg-yellow-400/20 border-yellow-400/30";
      default:
        return "text-white/60 bg-white/5 border-white/10";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const toNumber = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return parseFloat(value) || 0;
    return 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="card p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-white/70">Loading result details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="card p-8 text-center">
            <p className="text-white/70">Result not found</p>
            <button
              onClick={() => navigate(`/simulations/${id}`)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Simulation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group ticks by date
  const ticksByDate = (Array.isArray(ticks) ? ticks : []).reduce((acc, tick) => {
    if (!acc[tick.date]) {
      acc[tick.date] = [];
    }
    acc[tick.date].push(tick);
    return acc;
  }, {} as Record<string, BotSimulationTick[]>);

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/simulations/${id}`)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Bot {result.simulation_config.bot_index} - Detailed Results
              </h1>
              <p className="text-white/70 mt-1 text-sm sm:text-base">
                Complete tick-by-tick execution details
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-white/60 text-sm">Total Profit</span>
              <InfoTooltip
                text="Net profit or loss from all trades during the simulation. Positive values (green) indicate profit, negative values (red) indicate loss."
              />
            </div>
            <p
              className={`text-2xl font-bold ${
                Number(result.total_profit) >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              ${Number(result.total_profit).toFixed(2)}
            </p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-white/60 text-sm">Win Rate</span>
              <InfoTooltip
                text="Percentage of profitable trades out of total trades. Calculated as (Winning Trades / Total Trades) × 100. Higher values indicate better trade selection."
              />
            </div>
            <p className="text-2xl font-bold text-white">
              {Number(result.win_rate).toFixed(1)}%
            </p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-white/60 text-sm">Total Trades</span>
              <InfoTooltip
                text="Total number of buy and sell trades executed during the simulation period. Includes both profitable and losing trades."
              />
            </div>
            <p className="text-2xl font-bold text-white">
              {result.total_trades}
            </p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <span className="text-white/60 text-sm">Final Value</span>
              <InfoTooltip
                text="Total portfolio value at the end of the simulation. Includes remaining cash plus the current value of all stock positions."
              />
            </div>
            <p className="text-2xl font-bold text-white">
              ${(Number(result.final_cash) + Number(result.final_portfolio_value)).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Daily Results */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Daily Execution Results
          </h2>

          {dailyResults === null ? (
            <div className="card p-6 text-center">
              <p className="text-white/70">Loading daily results...</p>
            </div>
          ) : !Array.isArray(dailyResults) || dailyResults.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-white/70">No daily results available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dailyResults.map((day) => {
                const isExpanded = expandedDays.has(day.date);
                const dayTicks = ticksByDate[day.date] || [];
                const dayTrades = dayTicks.filter((t) => t.trade_executed);

                return (
                  <div key={day.id} className="card">
                    <div
                      onClick={() => toggleDay(day.date)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleDay(day.date);
                        }
                      }}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="text-white font-medium">
                          {new Date(day.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <span className="text-white/60 flex items-center gap-1">
                            Ticks: {dayTicks.length}
                            <InfoTooltip
                              text="Number of price ticks processed on this day. Each tick represents a price update that the bot analyzed."
                              className="inline-flex"
                              asSpan={true}
                            />
                          </span>
                          <span className="text-white/60 flex items-center gap-1">
                            Trades: {dayTrades.length}
                            <InfoTooltip
                              text="Number of trades executed on this day. Only ticks where a buy or sell order was actually executed are counted."
                              className="inline-flex"
                              asSpan={true}
                            />
                          </span>
                          {day.performance_metrics?.daily_profit !== undefined && (
                            <span
                              className={`flex items-center gap-1 ${
                                day.performance_metrics.daily_profit >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              Profit: $
                              {toNumber(day.performance_metrics.daily_profit).toFixed(2)}
                              <InfoTooltip
                                text="Net profit or loss for this specific day. Calculated as the change in total portfolio value from the previous day."
                                className="inline-flex"
                                asSpan={true}
                              />
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-white/60" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/60" />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-white/10">
                        {/* Daily Summary */}
                        <div className="pt-4">
                          <h3 className="text-sm font-semibold text-white mb-3">
                            Daily Summary
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(day.performance_metrics || {}).map(
                              ([key, value]) => {
                                const metricLabels: Record<string, string> = {
                                  daily_profit: "Daily Profit",
                                  total_value: "Total Value",
                                  cash: "Cash",
                                  portfolio_value: "Portfolio Value",
                                  trades_count: "Trades Count",
                                  phase: "Phase",
                                };
                                const metricTooltips: Record<string, string> = {
                                  daily_profit: "Profit or loss for this specific day. Calculated as the change in total portfolio value from the previous day.",
                                  total_value: "Total portfolio value at the end of this day (cash + stock positions value).",
                                  cash: "Available cash remaining after all trades on this day.",
                                  portfolio_value: "Current market value of all stock positions held at the end of this day.",
                                  trades_count: "Number of trades executed on this day.",
                                  phase: "Simulation phase: 'training' (historical data) or 'testing' (execution period).",
                                };
                                const label = metricLabels[key] || key.replace(/_/g, " ");
                                const tooltip = metricTooltips[key];
                                return (
                                  <div key={key} className="bg-white/5 p-2 rounded">
                                    <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
                                      <span className="capitalize">{label}</span>
                                      {tooltip && (
                                        <InfoTooltip text={tooltip} className="inline-flex" />
                                      )}
                                    </div>
                                    <div className="text-white font-medium">
                                      {typeof value === "number"
                                        ? toNumber(value).toFixed(2)
                                        : String(value)}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* Decisions */}
                        {day.decisions && Object.keys(day.decisions).length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              Stock Decisions
                              <InfoTooltip
                                text="Trading decisions made for each stock on this day. Shows the action (buy/sell/hold), reasoning, and confidence level for each stock in the simulation."
                              />
                            </h3>
                            <div className="space-y-2">
                              {Object.entries(day.decisions).map(
                                ([symbol, decision]: [string, any]) => (
                                  <div
                                    key={symbol}
                                    className="bg-white/5 p-3 rounded border border-white/10"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-white font-medium">
                                        {symbol}
                                      </span>
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium border ${getActionColor(
                                          decision.action
                                        )}`}
                                      >
                                        {decision.action.toUpperCase()}
                                      </span>
                                    </div>
                                    {decision.reason && (
                                      <p className="text-sm text-white/70">
                                        {decision.reason}
                                      </p>
                                    )}
                                    {decision.confidence !== undefined && (
                                      <div className="mt-2 text-xs text-white/60 flex items-center gap-1">
                                        Confidence: {toNumber(decision.confidence).toFixed(1)}%
                                        <InfoTooltip
                                          text="Confidence level in this decision, calculated from all signal sources. Higher values indicate stronger agreement among indicators, patterns, and ML models."
                                        />
                                      </div>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Ticks for this day */}
                        {dayTicks.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              Tick-by-Tick Execution ({dayTicks.length} ticks)
                              <InfoTooltip
                                text="Detailed execution log showing every price tick processed during this day. Each tick shows the bot's decision, signal analysis, portfolio state, and any trades executed. Expand a tick to see full details."
                              />
                            </h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {dayTicks.map((tick) => {
                                const isTickExpanded = expandedTicks.has(tick.id);
                                return (
                                  <div
                                    key={tick.id}
                                    className="bg-white/5 border border-white/10 rounded p-3"
                                  >
                                    <div
                                      onClick={() => toggleTick(tick.id)}
                                      className="w-full flex items-center justify-between text-left cursor-pointer"
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          toggleTick(tick.id);
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-1">
                                          <Clock className="w-4 h-4 text-white/60" />
                                          <span className="text-white text-sm">
                                            {formatTimestamp(tick.tick_timestamp)}
                                          </span>
                                          <InfoTooltip
                                            text="Exact timestamp when this tick data was processed. Each tick represents a price update during the trading day."
                                            className="inline-flex"
                                            asSpan={true}
                                          />
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-white/60 text-sm">
                                            {tick.stock_symbol}
                                          </span>
                                          <InfoTooltip
                                            text="Stock symbol for this tick. The bot analyzes each stock independently and makes decisions per stock."
                                            className="inline-flex"
                                            asSpan={true}
                                          />
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-white font-medium">
                                            ${toNumber(tick.tick_price).toFixed(2)}
                                          </span>
                                          <InfoTooltip
                                            text="Stock price at this specific tick. This is the price used for decision-making and trade execution."
                                            className="inline-flex"
                                            asSpan={true}
                                          />
                                        </div>
                                        <span
                                          className={`px-2 py-1 rounded text-xs font-medium border ${getActionColor(
                                            tick.decision.action
                                          )}`}
                                        >
                                          {tick.decision.action.toUpperCase()}
                                        </span>
                                        {tick.trade_executed && (
                                          <div className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4 text-green-400" />
                                            <InfoTooltip
                                              text="A trade was executed at this tick. Click to expand and see trade details (quantity, price, cost)."
                                              className="inline-flex"
                                              asSpan={true}
                                            />
                                          </div>
                                        )}
                                      </div>
                                      {isTickExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-white/60" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-white/60" />
                                      )}
                                    </div>

                                    {isTickExpanded && (
                                      <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                                        {/* Decision Details */}
                                        <div>
                                          <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                                            Decision Details
                                            <InfoTooltip
                                              text="The bot's trading decision for this specific tick, including the action taken, reasoning, confidence level, and risk assessment."
                                            />
                                          </h4>
                                          <div className="bg-white/5 p-2 rounded text-sm space-y-1">
                                            <div className="flex justify-between items-center">
                                              <span className="text-white/60 flex items-center gap-1">
                                                Action
                                                <InfoTooltip
                                                  text="The trading action decided by the bot: 'buy' (purchase stock), 'sell' (sell holdings), or 'hold' (no action)."
                                                />
                                              </span>
                                              <span className="text-white">
                                                {tick.decision.action}
                                              </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-white/60 flex items-center gap-1">
                                                Reason
                                                <InfoTooltip
                                                  text="Explanation of why the bot made this decision, based on signal analysis and risk assessment."
                                                />
                                              </span>
                                              <span className="text-white text-right max-w-[60%]">
                                                {tick.decision.reason}
                                              </span>
                                            </div>
                                            {tick.decision.confidence !== undefined && (
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Confidence
                                                  <InfoTooltip
                                                    text="Confidence level (0-100%) in this decision. Higher values indicate stronger signal agreement. Calculated from aggregated signals (indicators, patterns, ML models)."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  {toNumber(tick.decision.confidence).toFixed(1)}%
                                                </span>
                                              </div>
                                            )}
                                            {tick.decision.risk_score !== undefined && (
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Risk Score
                                                  <InfoTooltip
                                                    text="Risk assessment score (0-100). Higher values indicate higher risk. The bot may reduce position size or skip trades if risk exceeds the configured threshold."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  {toNumber(tick.decision.risk_score).toFixed(1)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Signal Contributions */}
                                        {tick.signal_contributions && (
                                          <div>
                                            <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                                              Signal Contributions
                                              <InfoTooltip
                                                text="Breakdown of all signals that contributed to the bot's decision. Includes technical indicators, chart patterns, ML model predictions, and sentiment analysis."
                                              />
                                            </h4>
                                            <div className="bg-white/5 p-2 rounded text-sm space-y-2">
                                              {tick.signal_contributions.aggregated_confidence !==
                                                undefined && (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-white/60 flex items-center gap-1">
                                                    Aggregated Confidence
                                                    <InfoTooltip
                                                      text="Combined confidence from all signal sources (indicators, patterns, ML, social, news) after applying weights and aggregation method."
                                                    />
                                                  </span>
                                                  <span className="text-white">
                                                    {toNumber(tick.signal_contributions.aggregated_confidence).toFixed(
                                                      1
                                                    )}
                                                    %
                                                  </span>
                                                </div>
                                              )}
                                              {tick.signal_contributions.indicator_signals !==
                                                undefined && (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-white/60 flex items-center gap-1">
                                                    Indicator Signals
                                                    <InfoTooltip
                                                      text="Number of technical indicators that generated trading signals (e.g., RSI, MACD, Bollinger Bands). Each indicator analyzes price/volume patterns to suggest buy/sell/hold."
                                                    />
                                                  </span>
                                                  <span className="text-white">
                                                    {
                                                      tick.signal_contributions
                                                        .indicator_signals
                                                    }
                                                  </span>
                                                </div>
                                              )}
                                              {tick.signal_contributions.pattern_signals !==
                                                undefined && (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-white/60 flex items-center gap-1">
                                                    Pattern Signals
                                                    <InfoTooltip
                                                      text="Number of chart patterns detected (e.g., head and shoulders, double top, engulfing patterns). Patterns identify potential trend reversals or continuations."
                                                    />
                                                  </span>
                                                  <span className="text-white">
                                                    {
                                                      tick.signal_contributions
                                                        .pattern_signals
                                                    }
                                                  </span>
                                                </div>
                                              )}
                                              {tick.signal_contributions.ml_signals &&
                                                tick.signal_contributions.ml_signals.length >
                                                  0 && (
                                                <div>
                                                  <span className="text-white/60 text-xs">
                                                    ML Signals:
                                                  </span>
                                                  <div className="mt-1 space-y-1">
                                                    {tick.signal_contributions.ml_signals.map(
                                                      (signal: any, idx: number) => (
                                                        <div
                                                          key={idx}
                                                          className="text-xs text-white/80 bg-white/5 p-1 rounded"
                                                        >
                                                          {signal.model || "Model"}:{" "}
                                                          {signal.prediction || "N/A"}
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                              {tick.signal_contributions.action_scores && (
                                                <div>
                                                  <span className="text-white/60 text-xs flex items-center gap-1">
                                                    Action Scores
                                                    <InfoTooltip
                                                      text="Probability scores for each possible action (buy, sell, hold) based on aggregated signals. The action with the highest score is typically chosen, subject to risk constraints."
                                                    />
                                                  </span>
                                                  <div className="mt-1 grid grid-cols-3 gap-2">
                                                    {Object.entries(
                                                      tick.signal_contributions
                                                        .action_scores
                                                    ).map(([action, score]: [string, any]) => (
                                                      <div
                                                        key={action}
                                                        className="text-xs bg-white/5 p-1 rounded text-center"
                                                      >
                                                        <div className="text-white/60 capitalize">
                                                          {action}
                                                        </div>
                                                        <div className="text-white font-medium">
                                                          {(toNumber(score) * 100).toFixed(1)}%
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                              {/* Indicator Signals */}
                                              {tick.signal_contributions.indicator_signals_list &&
                                                tick.signal_contributions.indicator_signals_list.length > 0 && (
                                                <div>
                                                  <span className="text-white/60 text-xs flex items-center gap-1">
                                                    Indicator Signals
                                                    <InfoTooltip
                                                      text="Trading signals generated by technical indicators. Each signal shows the indicator name, recommended action (buy/sell/hold), confidence level, and strength. These signals are combined to form the final trading decision."
                                                    />
                                                  </span>
                                                  <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                                                    {tick.signal_contributions.indicator_signals_list.map(
                                                      (signal: any, idx: number) => (
                                                        <div
                                                          key={idx}
                                                          className="text-xs bg-white/5 p-2 rounded border border-white/10"
                                                        >
                                                          <div className="flex items-center justify-between mb-1">
                                                            <span className="text-white font-medium">
                                                              {signal.source?.replace(/_/g, " ").toUpperCase() || `Indicator ${idx + 1}`}
                                                            </span>
                                                            <span
                                                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                                                signal.action === "buy"
                                                                  ? "bg-green-400/20 text-green-400"
                                                                  : signal.action === "sell"
                                                                  ? "bg-red-400/20 text-red-400"
                                                                  : "bg-yellow-400/20 text-yellow-400"
                                                              }`}
                                                            >
                                                              {signal.action?.toUpperCase() || "HOLD"}
                                                            </span>
                                                          </div>
                                                          <div className="space-y-0.5 text-white/80">
                                                            {signal.confidence !== undefined && (
                                                              <div className="flex justify-between text-xs">
                                                                <span className="text-white/60">Confidence:</span>
                                                                <span className="text-white">
                                                                  {(toNumber(signal.confidence) * 100).toFixed(1)}%
                                                                </span>
                                                              </div>
                                                            )}
                                                            {signal.strength !== undefined && (
                                                              <div className="flex justify-between text-xs">
                                                                <span className="text-white/60">Strength:</span>
                                                                <span className="text-white">
                                                                  {(toNumber(signal.strength) * 100).toFixed(1)}%
                                                                </span>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                              {/* Indicators (Raw Values) */}
                                              {tick.signal_contributions.indicators &&
                                                Object.keys(
                                                  tick.signal_contributions.indicators
                                                ).length > 0 && (
                                                <div>
                                                  <span className="text-white/60 text-xs flex items-center gap-1">
                                                    Indicator Values
                                                    <InfoTooltip
                                                      text="Raw technical indicator values calculated at this tick. Numbers (0, 1, 2, 3, 4) represent the last 5 calculated values, where 0 is the most recent (current tick) and 4 is 4 ticks ago. This shows the indicator's trend over recent ticks."
                                                    />
                                                  </span>
                                                  <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                                                    {Object.entries(
                                                      tick.signal_contributions.indicators
                                                    ).map(
                                                      ([
                                                        indicatorName,
                                                        indicatorData,
                                                      ]: [string, any]) => (
                                                        <div
                                                          key={indicatorName}
                                                          className="text-xs bg-white/5 p-2 rounded"
                                                        >
                                                          <div className="text-white font-medium mb-1 flex items-center gap-1">
                                                            {indicatorName.replace(/_/g, " ").toUpperCase()}
                                                            <InfoTooltip
                                                              text={`${indicatorName.replace(/_/g, " ")} indicator values. The numbers (0-4) are array indices showing historical values: 0 = current tick, 1 = 1 tick ago, 2 = 2 ticks ago, etc. This helps visualize the indicator's trend direction.`}
                                                            />
                                                          </div>
                                                          {typeof indicatorData === "object" &&
                                                            indicatorData !== null && (
                                                            <div className="text-white/80 space-y-1">
                                                              {Object.entries(
                                                                indicatorData
                                                              ).map(
                                                                ([
                                                                  key,
                                                                  value,
                                                                ]: [
                                                                  string,
                                                                  any
                                                                ]) => {
                                                                  const isIndex = /^\d+$/.test(key);
                                                                  const indexTooltip = isIndex
                                                                    ? `Indicator value ${key === "0" ? "at current tick (most recent)" : `${key} tick${key === "1" ? "" : "s"} ago`}. Lower numbers are more recent.`
                                                                    : undefined;
                                                                  return (
                                                                    <div
                                                                      key={key}
                                                                      className="flex justify-between text-xs items-center"
                                                                    >
                                                                      <span className="text-white/60 flex items-center gap-1">
                                                                        {isIndex ? `Value ${key === "0" ? "(Current)" : `(-${key})`}` : key}:
                                                                        {indexTooltip && (
                                                                          <InfoTooltip
                                                                            text={indexTooltip}
                                                                          />
                                                                        )}
                                                                      </span>
                                                                      <span className="text-white">
                                                                      {typeof value ===
                                                                      "number"
                                                                        ? toNumber(value).toFixed(
                                                                            2
                                                                          )
                                                                        : String(
                                                                            value
                                                                          )}
                                                                      </span>
                                                                    </div>
                                                                  );
                                                                }
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Portfolio State */}
                                        {tick.portfolio_state && (
                                          <div>
                                            <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                                              Portfolio State
                                              <InfoTooltip
                                                text="Current state of the bot's portfolio at this tick, including available cash, stock positions, and total portfolio value."
                                              />
                                            </h4>
                                            <div className="bg-white/5 p-2 rounded text-sm space-y-1">
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Cash
                                                  <InfoTooltip
                                                    text="Available cash remaining after all trades. Used to purchase new positions."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  $
                                                  {toNumber(tick.portfolio_state.cash).toFixed(2)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Portfolio Value
                                                  <InfoTooltip
                                                    text="Current market value of all stock positions held. Calculated as sum of (quantity × current price) for each position."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  $
                                                  {toNumber(tick.portfolio_state.portfolio_value).toFixed(
                                                    2
                                                  )}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Total Value
                                                  <InfoTooltip
                                                    text="Total portfolio value = Cash + Portfolio Value. This is the complete worth of the bot's holdings at this tick."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  $
                                                  {toNumber(tick.portfolio_state.total_value).toFixed(2)}
                                                </span>
                                              </div>
                                              {tick.portfolio_state.positions &&
                                                Object.keys(
                                                  tick.portfolio_state.positions
                                                ).length > 0 && (
                                                <div className="mt-2">
                                                  <span className="text-white/60 text-xs flex items-center gap-1">
                                                    Positions
                                                    <InfoTooltip
                                                      text="Current stock holdings. Shows stock symbol, quantity owned, and average purchase price per share."
                                                    />
                                                  </span>
                                                  <div className="mt-1 space-y-1">
                                                    {Object.entries(
                                                      tick.portfolio_state.positions
                                                    ).map(
                                                      ([symbol, pos]: [
                                                        string,
                                                        any
                                                      ]) => (
                                                        <div
                                                          key={symbol}
                                                          className="text-xs text-white/80"
                                                        >
                                                          {symbol}: {pos.quantity} @ $
                                                          {pos.avg_price ? toNumber(pos.avg_price).toFixed(2) : "N/A"}
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Trade Details */}
                                        {tick.trade_executed && tick.trade_details && (
                                          <div>
                                            <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                                              <CheckCircle className="w-4 h-4 text-green-400" />
                                              Trade Executed
                                              <InfoTooltip
                                                text="Details of the trade that was executed at this tick. A trade is executed when the bot's decision (buy/sell) meets risk criteria and sufficient funds/positions are available."
                                              />
                                            </h4>
                                            <div className="bg-green-400/10 border border-green-400/30 p-2 rounded text-sm space-y-1">
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Action
                                                  <InfoTooltip
                                                    text="Type of trade executed: 'BUY' (purchased shares) or 'SELL' (sold shares)."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  {tick.trade_details.action?.toUpperCase()}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Quantity
                                                  <InfoTooltip
                                                    text="Number of shares bought or sold in this trade. Position size is determined by risk settings, available cash, and risk score."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  {tick.trade_details.quantity}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center">
                                                <span className="text-white/60 flex items-center gap-1">
                                                  Price
                                                  <InfoTooltip
                                                    text="Price per share at which the trade was executed (the tick price at this moment)."
                                                  />
                                                </span>
                                                <span className="text-white">
                                                  ${tick.trade_details.price ? toNumber(tick.trade_details.price).toFixed(2) : "N/A"}
                                                </span>
                                              </div>
                                              {tick.trade_details.cost !== undefined && (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-white/60 flex items-center gap-1">
                                                    Cost
                                                    <InfoTooltip
                                                      text="Total cost of this trade = Quantity × Price. For buys, this is deducted from cash. For sells, this is added to cash."
                                                    />
                                                  </span>
                                                  <span className="text-white">
                                                    ${toNumber(tick.trade_details.cost).toFixed(2)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Cumulative Profit */}
                                        <div className="flex justify-between items-center pt-2 border-t border-white/10">
                                          <span className="text-white/60 text-sm flex items-center gap-1">
                                            Cumulative Profit
                                            <InfoTooltip
                                              text="Total profit or loss accumulated from the start of the simulation up to this tick. Includes realized gains/losses from closed positions and unrealized gains/losses from current holdings."
                                            />
                                          </span>
                                          <span
                                            className={`text-sm font-medium ${
                                              tick.cumulative_profit >= 0
                                                ? "text-green-400"
                                                : "text-red-400"
                                            }`}
                                          >
                                            ${toNumber(tick.cumulative_profit).toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BotSimulationResultDetail;
