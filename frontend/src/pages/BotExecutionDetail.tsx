import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Brain,
  MessageSquare,
  Newspaper,
  GitMerge,
  BarChart3,
  Layers,
  Shield,
  CheckCircle,
  X,
  AlertTriangle,
  Calculator,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { botAPI } from "../lib/api";
import type { TradingBotExecution } from "../lib/api";
import BotSignalHistoryTab from "../components/bots/BotSignalHistoryTab";
import {
  INDICATORS,
  getIndicatorThresholds,
  getThresholdLabel,
  formatThresholdValue,
} from "../lib/botConstants";
import { useIndicatorThresholds } from "../contexts/IndicatorThresholdsContext";

interface TimelineStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "completed" | "pending" | "error";
  timestamp?: string;
  data?: any;
  details?: React.ReactNode;
}

// Simple tooltip component for formulas with smart positioning
const FormulaTooltip: React.FC<{
  formula: string;
  description?: string;
  children: React.ReactNode;
}> = ({ formula, description, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    side: "bottom" | "top" | "left" | "right";
    align: "left" | "right" | "center";
  }>({ side: "bottom", align: "left" });
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen && tooltipRef.current && containerRef.current) {
      const updatePosition = () => {
        if (!tooltipRef.current || !containerRef.current) return;

        const tooltip = tooltipRef.current;
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 10; // Padding from viewport edges

        let newSide: "bottom" | "top" | "left" | "right" = "bottom";
        let newAlign: "left" | "right" | "center" = "left";

        // Check if tooltip fits below
        const fitsBelow =
          containerRect.bottom + tooltipRect.height + padding <= viewportHeight;
        // Check if tooltip fits above
        const fitsAbove = containerRect.top - tooltipRect.height - padding >= 0;
        // Check if tooltip fits to the right
        const fitsRight =
          containerRect.right + tooltipRect.width + padding <= viewportWidth;
        // Check if tooltip fits to the left
        const fitsLeft = containerRect.left - tooltipRect.width - padding >= 0;

        // Determine best position
        if (fitsBelow) {
          newSide = "bottom";
          // Check horizontal alignment
          if (
            containerRect.left + tooltipRect.width >
            viewportWidth - padding
          ) {
            // Too wide for right side, align to right edge
            newAlign = "right";
          } else if (containerRect.left < padding) {
            // Too close to left edge
            newAlign = "left";
          } else {
            newAlign = "left";
          }
        } else if (fitsAbove) {
          newSide = "top";
          if (
            containerRect.left + tooltipRect.width >
            viewportWidth - padding
          ) {
            newAlign = "right";
          } else if (containerRect.left < padding) {
            newAlign = "left";
          } else {
            newAlign = "left";
          }
        } else if (fitsRight) {
          newSide = "right";
          newAlign = "center";
        } else if (fitsLeft) {
          newSide = "left";
          newAlign = "center";
        } else {
          // Default to bottom, but adjust alignment
          newSide = "bottom";
          if (containerRect.right > viewportWidth / 2) {
            newAlign = "right";
          } else {
            newAlign = "left";
          }
        }

        setPosition({ side: newSide, align: newAlign });
      };

      // Small delay to ensure tooltip is rendered
      const timeoutId = setTimeout(updatePosition, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  const getPositionClasses = () => {
    const sideClasses = {
      top: "bottom-full",
      bottom: "top-full",
      left: "right-full",
      right: "left-full",
    };

    const alignClasses = {
      left: "left-0",
      right: "right-0",
      center: "left-1/2 -translate-x-1/2",
    };

    const spacing = {
      top: "mb-2",
      bottom: "mt-2",
      left: "mr-2",
      right: "ml-2",
    };

    return `${sideClasses[position.side]} ${alignClasses[position.align]} ${
      spacing[position.side]
    }`;
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div
        className="inline-flex items-center gap-1 cursor-help"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children}
        {/* <Info className="w-3 h-3 text-gray-400 hover:text-blue-400 transition-colors" /> */}
      </div>
      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 max-w-sm w-80 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-xl ${getPositionClasses()}`}
          style={{
            maxWidth: "min(320px, calc(100vw - 20px))", // Ensure it doesn't exceed viewport
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {description && (
            <p className="text-xs text-gray-300 mb-2">{description}</p>
          )}
          <div className="mb-2">
            <p className="text-xs font-semibold text-blue-400 mb-1">Formula:</p>
            <p className="text-xs text-gray-400 font-mono bg-gray-900 p-2 rounded break-words overflow-wrap-anywhere">
              {formula}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const BotExecutionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { thresholds: defaultThresholds } = useIndicatorThresholds();
  const [execution, setExecution] = useState<TradingBotExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isLoadingPriceData, setIsLoadingPriceData] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "signals">(
    "timeline"
  );

  useEffect(() => {
    if (id) {
      fetchExecution();
    }
  }, [id]);

  const fetchExecution = async () => {
    try {
      setLoading(true);
      const response = await botAPI.getExecutionDetail(id!);
      setExecution(response.data);
    } catch (error) {
      console.error("Failed to fetch execution:", error);
      toast.error("Failed to load execution details");
      navigate("/bots");
    } finally {
      setLoading(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const toNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy":
        return "text-green-400 bg-green-500/20 border-green-500";
      case "sell":
        return "text-red-400 bg-red-500/20 border-red-500";
      default:
        return "text-yellow-400 bg-yellow-500/20 border-yellow-500";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "buy":
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case "sell":
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Activity className="w-5 h-5 text-yellow-400" />;
    }
  };

  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const buildTimeline = (): TimelineStep[] => {
    if (!execution) return [];

    const steps: TimelineStep[] = [];
    const signalHistory = execution.signal_history;
    const executionTimestamp = new Date(execution.timestamp);
    const signalTimestamp = signalHistory?.timestamp
      ? new Date(signalHistory.timestamp)
      : executionTimestamp;

    // Step 1: Execution Started
    steps.push({
      id: "start",
      title: "Execution Started",
      description: `Bot execution initiated for ${execution.stock_symbol}`,
      icon: <Zap className="w-5 h-5" />,
      status: "completed",
      timestamp: executionTimestamp.toISOString(),
    });

    // Step 2: Price Data Retrieved
    if (signalHistory?.price_data_snapshot) {
      // Use exact price data from snapshot (the data used during execution)
      const snapshotPriceData = signalHistory.price_data_snapshot.data || [];

      // Sort chronologically (oldest to newest) by date
      const sortedPriceData = [...snapshotPriceData].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });

      const chartData = sortedPriceData.map((price) => ({
        date: price.date ? format(new Date(price.date), "MMM dd") : "N/A",
        fullDate: price.date || "",
        close: parseFloat(String(price.close_price || 0)),
        open: parseFloat(String(price.open_price || 0)),
        high: parseFloat(String(price.high_price || 0)),
        low: parseFloat(String(price.low_price || 0)),
        volume: price.volume || 0,
      }));

      steps.push({
        id: "price_data",
        title: "Price Data Retrieved",
        description: `Fetched ${
          signalHistory.price_data_snapshot.count || "N/A"
        } price points`,
        icon: <BarChart3 className="w-5 h-5" />,
        status: "completed",
        timestamp: signalTimestamp.toISOString(),
        data: signalHistory.price_data_snapshot,
        details: (
          <div className="mt-4 space-y-4">
            {signalHistory.price_data_snapshot.latest && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Latest Close:</span>
                  <span className="text-white">
                    {formatPrice(
                      signalHistory.price_data_snapshot.latest.close_price || 0
                    )}
                  </span>
                </div>
                {signalHistory.price_data_snapshot.latest.volume && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volume:</span>
                    <span className="text-white">
                      {signalHistory.price_data_snapshot.latest.volume.toLocaleString()}
                    </span>
                  </div>
                )}
                {signalHistory.price_data_snapshot.tick_count !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tick Data (Last Day):</span>
                    <span className="text-white">
                      {signalHistory.price_data_snapshot.tick_count.toLocaleString()}{" "}
                      ticks
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Price Chart */}
            {chartData.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-white mb-2">
                  Price Chart (Exact Data Used for Execution -{" "}
                  {chartData.length} points)
                  {execution?.bot_config_settings?.period_days && (
                    <span className="text-gray-400 text-xs ml-2">
                      (Period: {execution.bot_config_settings.period_days} days)
                    </span>
                  )}
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      style={{ fontSize: "12px" }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      style={{ fontSize: "12px" }}
                      domain={["auto", "auto"]}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#F3F4F6",
                      }}
                      labelStyle={{ color: "#9CA3AF" }}
                      formatter={(value: number) => formatPrice(value)}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
                      name="Close Price"
                    />
                    <Line
                      type="monotone"
                      dataKey="high"
                      stroke="#3B82F6"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      dot={false}
                      name="High"
                    />
                    <Line
                      type="monotone"
                      dataKey="low"
                      stroke="#EF4444"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      dot={false}
                      name="Low"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4">
                No price data available in snapshot
              </div>
            )}
          </div>
        ),
      });
    }

    // Step 3: Technical Indicators Calculated
    if (
      execution.indicators_data &&
      Object.keys(execution.indicators_data).length > 0
    ) {
      const indicatorCount = Object.keys(execution.indicators_data).length;
      const isExpanded = expandedSteps.has("indicators");
      const indicatorsToShow = isExpanded
        ? Object.entries(execution.indicators_data)
        : Object.entries(execution.indicators_data).slice(0, 6);

      // Get indicator weight from decision details
      const decisionDetails = (execution as any).decision_details || {};
      const defaultWeights = {
        ml: 0.4,
        indicator: 0.3,
        pattern: 0.15,
        social_media: 0.1,
        news: 0.05,
      };
      const signalWeights = decisionDetails.signal_weights || defaultWeights;
      const indicatorWeight = signalWeights.indicator || 0.3;

      const renderIndicatorValue = (value: any): string | number | null => {
        if (value === null || value === undefined) {
          return null;
        } else if (typeof value === "object" && !Array.isArray(value)) {
          if (value.current !== null && value.current !== undefined) {
            return typeof value.current === "number"
              ? value.current
              : value.current;
          } else if (value.value !== null && value.value !== undefined) {
            return typeof value.value === "number" ? value.value : value.value;
          } else {
            const numericValue = Object.values(value).find(
              (v) => typeof v === "number" && v !== null
            );
            return numericValue as number | null;
          }
        } else if (typeof value === "number") {
          return value;
        } else if (Array.isArray(value) && value.length > 0) {
          const lastValue = value[value.length - 1];
          return typeof lastValue === "number" ? lastValue : null;
        }
        return null;
      };

      // Get indicator signals for reference
      // Backend stores as {signals: [...], count: ...}
      const indicatorSignals =
        signalHistory &&
        signalHistory.indicator_signals &&
        Array.isArray(signalHistory.indicator_signals.signals)
          ? signalHistory.indicator_signals.signals
          : signalHistory && Array.isArray(signalHistory.indicator_signals)
          ? signalHistory.indicator_signals
          : [];

      // Helper to find indicator definition
      const findIndicatorDefinition = (key: string) => {
        const normalizedKey = key.toLowerCase().replace(/_/g, "");
        return INDICATORS.find((ind) => {
          const indId = ind.id.toLowerCase().replace(/_/g, "");
          return normalizedKey.includes(indId) || indId.includes(normalizedKey);
        });
      };

      // Helper to get signal for this indicator
      const getIndicatorSignal = (key: string) => {
        return indicatorSignals.find(
          (sig: any) => sig.name && sig.name.toLowerCase() === key.toLowerCase()
        );
      };

      // Helper to interpret indicator value
      const interpretIndicatorValue = (
        key: string,
        value: number | null,
        indicatorDef: any
      ): { signal: "buy" | "sell" | "hold" | null; interpretation: string } => {
        if (value === null || value === undefined || !indicatorDef) {
          return {
            signal: null,
            interpretation: "No interpretation available",
          };
        }

        const keyLower = key.toLowerCase();

        // RSI interpretation
        if (keyLower.includes("rsi")) {
          if (value < 30) {
            return {
              signal: "buy",
              interpretation: `RSI ${value.toFixed(
                2
              )} is oversold (< 30). Strong buy signal.`,
            };
          } else if (value > 70) {
            return {
              signal: "sell",
              interpretation: `RSI ${value.toFixed(
                2
              )} is overbought (> 70). Strong sell signal.`,
            };
          } else {
            return {
              signal: "hold",
              interpretation: `RSI ${value.toFixed(
                2
              )} is neutral (30-70). No strong signal.`,
            };
          }
        }

        // Moving averages - check if price is above/below
        if (
          keyLower.includes("sma") ||
          keyLower.includes("ema") ||
          keyLower.includes("wma") ||
          keyLower.includes("dema") ||
          keyLower.includes("tema") ||
          keyLower.includes("tma") ||
          keyLower.includes("hma")
        ) {
          // For moving averages, we'd need current price to compare
          // For now, just show the value
          return {
            signal: null,
            interpretation: `Price ${
              indicatorDef.buySignal?.toLowerCase() || "above"
            } = Buy, ${
              indicatorDef.sellSignal?.toLowerCase() || "below"
            } = Sell`,
          };
        }

        // MACD
        if (keyLower.includes("macd")) {
          if (value > 0) {
            return {
              signal: "buy",
              interpretation: `MACD ${value.toFixed(
                2
              )} is positive. Bullish momentum.`,
            };
          } else {
            return {
              signal: "sell",
              interpretation: `MACD ${value.toFixed(
                2
              )} is negative. Bearish momentum.`,
            };
          }
        }

        // ADX - Note: ADX only indicates trend strength, not direction
        if (keyLower.includes("adx")) {
          const weakTrend = 25.0;
          const strongTrend = 50.0;
          if (value < weakTrend) {
            return {
              signal: "hold",
              interpretation: `ADX ${value.toFixed(
                2
              )} indicates weak or no trend (< ${weakTrend}).`,
            };
          } else if (value > strongTrend) {
            return {
              signal: "hold",
              interpretation: `ADX ${value.toFixed(
                2
              )} indicates very strong trend (> ${strongTrend}). Note: ADX does not indicate direction, only trend strength.`,
            };
          } else {
            return {
              signal: "hold",
              interpretation: `ADX ${value.toFixed(
                2
              )} indicates moderate trend (${weakTrend}-${strongTrend}).`,
            };
          }
        }

        // CCI
        if (keyLower.includes("cci")) {
          if (value > 100) {
            return {
              signal: "sell",
              interpretation: `CCI ${value.toFixed(
                2
              )} is overbought (> 100). Sell signal.`,
            };
          } else if (value < -100) {
            return {
              signal: "buy",
              interpretation: `CCI ${value.toFixed(
                2
              )} is oversold (< -100). Buy signal.`,
            };
          } else {
            return {
              signal: "hold",
              interpretation: `CCI ${value.toFixed(
                2
              )} is neutral (-100 to 100).`,
            };
          }
        }

        // Williams %R
        if (keyLower.includes("williams") || keyLower.includes("wr")) {
          if (value > -20) {
            return {
              signal: "sell",
              interpretation: `Williams %R ${value.toFixed(
                2
              )} is overbought (> -20). Sell signal.`,
            };
          } else if (value < -80) {
            return {
              signal: "buy",
              interpretation: `Williams %R ${value.toFixed(
                2
              )} is oversold (< -80). Buy signal.`,
            };
          } else {
            return {
              signal: "hold",
              interpretation: `Williams %R ${value.toFixed(
                2
              )} is neutral (-80 to -20).`,
            };
          }
        }

        // Default interpretation
        return {
          signal: null,
          interpretation:
            indicatorDef.interpretation ||
            "See indicator definition for interpretation.",
        };
      };

      steps.push({
        id: "indicators",
        title: "Technical Indicators Calculated",
        description: `${indicatorCount} indicator${
          indicatorCount !== 1 ? "s" : ""
        } computed`,
        icon: <Calculator className="w-5 h-5" />,
        status: "completed",
        timestamp: signalTimestamp.toISOString(),
        data: execution.indicators_data,
        details: (
          <div className="mt-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {indicatorsToShow.map(([key, value]: [string, any]) => {
                const displayValue = renderIndicatorValue(value);
                const indicatorDef = findIndicatorDefinition(key);
                const signal = getIndicatorSignal(key);
                const interpretation = interpretIndicatorValue(
                  key,
                  typeof displayValue === "number" ? displayValue : null,
                  indicatorDef
                );

                // Get threshold values for this indicator
                const botThresholds = execution.bot_config_settings
                  ?.indicator_thresholds as
                  | Record<string, Record<string, number>>
                  | undefined;
                const thresholds = getIndicatorThresholds(
                  key,
                  botThresholds,
                  defaultThresholds
                );

                return (
                  <div
                    key={key}
                    className="bg-gray-700/50 rounded p-3 border border-gray-600"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-300 mb-1">
                          {indicatorDef?.name ||
                            key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-white">
                            {displayValue !== null
                              ? typeof displayValue === "number"
                                ? displayValue.toFixed(2)
                                : displayValue
                              : "N/A"}
                          </p>
                          {signal ? (
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                signal.action === "buy"
                                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                  : signal.action === "sell"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : signal.action === "hold"
                                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                  : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                              }`}
                            >
                              ✓ {signal.action.toUpperCase()} SIGNAL
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded font-medium bg-gray-600/20 text-gray-400 border border-gray-600/30">
                              No Signal
                            </span>
                          )}
                        </div>
                      </div>
                      {indicatorDef && (
                        <FormulaTooltip
                          formula={
                            indicatorDef.calculation || "See description"
                          }
                          description={`${indicatorDef.description || ""} ${
                            indicatorDef.interpretation || ""
                          }`}
                        >
                          <Info className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors cursor-help" />
                        </FormulaTooltip>
                      )}
                    </div>

                    {/* Threshold Values */}
                    {thresholds && Object.keys(thresholds).length > 0 && (
                      <div className="mt-2 p-2 bg-gray-800/50 rounded border border-gray-700">
                        <p className="text-xs font-semibold text-gray-300 mb-1.5">
                          Threshold Values:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(thresholds)
                            .filter(
                              ([, val]) =>
                                val !== 0.0 ||
                                (typeof val === "number" && val !== 0)
                            )
                            .map(([thresholdKey, thresholdValue]) => (
                              <div
                                key={thresholdKey}
                                className="flex justify-between items-center text-xs"
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

                    {/* Interpretation */}
                    <div className="mt-2 p-2 bg-gray-800/50 rounded">
                      <p className="text-xs text-gray-400 mb-1">
                        Signal Interpretation:
                      </p>
                      <p className="text-xs text-white">
                        {interpretation.interpretation}
                      </p>
                      {thresholds &&
                        typeof displayValue === "number" &&
                        (() => {
                          // Show how value compares to thresholds
                          const keyLower = key.toLowerCase();
                          let thresholdComparison = "";
                          if (keyLower.includes("rsi")) {
                            const oversold = thresholds.oversold;
                            const overbought = thresholds.overbought;
                            if (displayValue < oversold) {
                              thresholdComparison = ` (${displayValue.toFixed(
                                2
                              )} < ${oversold.toFixed(2)} = Buy)`;
                            } else if (displayValue > overbought) {
                              thresholdComparison = ` (${displayValue.toFixed(
                                2
                              )} > ${overbought.toFixed(2)} = Sell)`;
                            } else {
                              thresholdComparison = ` (${displayValue.toFixed(
                                2
                              )} between ${oversold.toFixed(
                                2
                              )}-${overbought.toFixed(2)} = Hold)`;
                            }
                          } else if (
                            keyLower.includes("cci") ||
                            keyLower.includes("williams") ||
                            keyLower.includes("wr")
                          ) {
                            const oversold = thresholds.oversold;
                            const overbought = thresholds.overbought;
                            if (displayValue < oversold) {
                              thresholdComparison = ` (${displayValue.toFixed(
                                2
                              )} < ${oversold.toFixed(2)} = Buy)`;
                            } else if (displayValue > overbought) {
                              thresholdComparison = ` (${displayValue.toFixed(
                                2
                              )} > ${overbought.toFixed(2)} = Sell)`;
                            }
                          } else if (keyLower.includes("adx")) {
                            const weakTrend = thresholds.weak_trend;
                            const strongTrend = thresholds.strong_trend;
                            if (displayValue < weakTrend) {
                              thresholdComparison = ` (${displayValue.toFixed(
                                2
                              )} < ${weakTrend.toFixed(2)} = Weak Trend)`;
                            } else if (displayValue > strongTrend) {
                              thresholdComparison = ` (${displayValue.toFixed(
                                2
                              )} > ${strongTrend.toFixed(2)} = Strong Trend)`;
                            }
                          }
                          return thresholdComparison ? (
                            <p className="text-xs text-blue-400 mt-1 font-medium">
                              Threshold Check:{thresholdComparison}
                            </p>
                          ) : null;
                        })()}
                    </div>

                    {/* Signal Aggregator Usage */}
                    {signal ? (
                      <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                        <p className="text-xs font-semibold text-blue-400 mb-1">
                          Signal Generated:
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Action:</span>
                            <span
                              className={`font-medium ${
                                signal.action === "buy"
                                  ? "text-green-400"
                                  : signal.action === "sell"
                                  ? "text-red-400"
                                  : signal.action === "hold"
                                  ? "text-yellow-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {signal.action.toUpperCase()}
                            </span>
                          </div>
                          {signal.confidence !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Confidence:</span>
                              <span className="text-white">
                                {(
                                  (toNumber(signal.confidence) || 0) * 100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                          )}
                          {signal.strength !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Strength:</span>
                              <span className="text-white">
                                {(
                                  (toNumber(signal.strength) || 0) * 100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <p className="text-xs text-gray-500">
                              This signal contributes to the final decision with
                              weight:{" "}
                              {(
                                (toNumber(signal.confidence) || 0) *
                                (toNumber(signal.strength) || 0) *
                                indicatorWeight *
                                100
                              ).toFixed(2)}
                              %{" "}
                              <span className="text-gray-400">
                                (confidence × strength × indicator_weight ={" "}
                                {(
                                  (toNumber(signal.confidence) || 0) * 100
                                ).toFixed(1)}
                                % ×{" "}
                                {(
                                  (toNumber(signal.strength) || 0) * 100
                                ).toFixed(1)}
                                % × {(indicatorWeight * 100).toFixed(0)}%)
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 p-2 bg-gray-800/50 rounded border border-gray-700">
                        <p className="text-xs font-semibold text-gray-300 mb-1.5">
                          Signal Status: No Signal Generated
                        </p>
                        <p className="text-xs text-gray-400 mb-2">
                          This indicator was calculated, but did not generate a
                          formal signal because:
                        </p>
                        <ul className="text-xs text-gray-500 list-disc list-inside space-y-1 ml-2">
                          {thresholds &&
                            typeof displayValue === "number" &&
                            (() => {
                              const keyLower = key.toLowerCase();
                              const reasons: string[] = [];
                              if (keyLower.includes("rsi")) {
                                const oversold = thresholds.oversold;
                                const overbought = thresholds.overbought;
                                if (
                                  displayValue >= oversold &&
                                  displayValue <= overbought
                                ) {
                                  reasons.push(
                                    `Value (${displayValue.toFixed(
                                      2
                                    )}) is between oversold (${oversold.toFixed(
                                      2
                                    )}) and overbought (${overbought.toFixed(
                                      2
                                    )}) thresholds`
                                  );
                                }
                              } else if (
                                keyLower.includes("cci") ||
                                keyLower.includes("williams") ||
                                keyLower.includes("wr")
                              ) {
                                const oversold = thresholds.oversold;
                                const overbought = thresholds.overbought;
                                if (
                                  displayValue >= oversold &&
                                  displayValue <= overbought
                                ) {
                                  reasons.push(
                                    `Value (${displayValue.toFixed(
                                      2
                                    )}) is between oversold (${oversold.toFixed(
                                      2
                                    )}) and overbought (${overbought.toFixed(
                                      2
                                    )}) thresholds`
                                  );
                                }
                              } else if (keyLower.includes("adx")) {
                                const weakTrend = thresholds.weak_trend;
                                if (displayValue < weakTrend) {
                                  reasons.push(
                                    `Value (${displayValue.toFixed(
                                      2
                                    )}) is below weak trend threshold (${weakTrend.toFixed(
                                      2
                                    )})`
                                  );
                                }
                              } else {
                                reasons.push(
                                  "The indicator value did not cross any configured thresholds"
                                );
                              }
                              return reasons.length > 0
                                ? reasons.map((reason, idx) => (
                                    <li key={idx}>{reason}</li>
                                  ))
                                : [
                                    <li key="default">
                                      The indicator value did not meet the
                                      threshold conditions for signal generation
                                    </li>,
                                  ];
                            })()}
                        </ul>
                        {interpretation.signal && (
                          <p className="text-xs text-blue-400 mt-2 font-medium border-t border-gray-700 pt-2">
                            💡 Interpretation: This indicator suggests{" "}
                            {interpretation.signal.toUpperCase()} based on the
                            value, but it did not meet the formal threshold
                            requirements for signal generation.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {Object.keys(execution.indicators_data).length > 6 && (
              <button
                onClick={() => toggleStepExpansion("indicators")}
                className="mt-3 w-full bg-gray-700/50 hover:bg-gray-700 rounded p-2 flex items-center justify-center gap-2 transition-colors"
              >
                <span className="text-xs text-gray-300">
                  {isExpanded
                    ? "Show Less"
                    : `+${
                        Object.keys(execution.indicators_data).length - 6
                      } more`}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-300" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-300" />
                )}
              </button>
            )}
          </div>
        ),
      });
    }

    // Step 4: Patterns Detected
    if (
      execution.patterns_detected &&
      Object.keys(execution.patterns_detected).length > 0
    ) {
      // Get pattern weight from decision details
      const decisionDetails = (execution as any).decision_details || {};
      const defaultWeights = {
        ml: 0.4,
        indicator: 0.3,
        pattern: 0.15,
        social_media: 0.1,
        news: 0.05,
      };
      const signalWeights = decisionDetails.signal_weights || defaultWeights;
      const patternWeight = signalWeights.pattern || 0.15;

      // Get pattern signals from signal history to calculate contributions
      const patternSignalsFromHistory = signalHistory
        ? Array.isArray(signalHistory.pattern_signals?.patterns)
          ? signalHistory.pattern_signals.patterns
          : Array.isArray(signalHistory.pattern_signals)
          ? signalHistory.pattern_signals
          : []
        : [];

      // Create a map of pattern signals by pattern name for quick lookup
      const patternSignalMap = new Map();
      patternSignalsFromHistory.forEach((signal: any) => {
        const patternName =
          signal.pattern_name || signal.pattern || signal.name;
        if (patternName) {
          patternSignalMap.set(patternName.toLowerCase(), signal);
        }
      });

      steps.push({
        id: "patterns",
        title: "Chart Patterns Detected",
        description: `${
          Object.keys(execution.patterns_detected).length
        } pattern${
          Object.keys(execution.patterns_detected).length !== 1 ? "s" : ""
        } found`,
        icon: <Layers className="w-5 h-5" />,
        status: "completed",
        timestamp: signalTimestamp.toISOString(),
        data: execution.patterns_detected,
        details: (
          <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(execution.patterns_detected).map(
              ([key, pattern]: [string, any]) => {
                const patternName =
                  pattern.pattern_name ||
                  pattern.pattern ||
                  pattern.name ||
                  key;
                const patternSignal = patternSignalMap.get(
                  patternName.toLowerCase()
                );
                const confidence = toNumber(pattern.confidence) || 0;
                const strength = confidence; // For patterns, strength equals confidence
                const action =
                  pattern.signal || patternSignal?.signal || "hold";
                const contribution =
                  confidence !== null
                    ? (confidence * strength * patternWeight * 100).toFixed(2)
                    : "0.00";

                return (
                  <div
                    key={key}
                    className="bg-gray-700/50 rounded p-3 border border-gray-600"
                  >
                    <p className="text-sm font-medium text-white capitalize">
                      {patternName}
                    </p>
                    {pattern.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {pattern.description}
                      </p>
                    )}
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-4 flex-wrap">
                        {confidence !== null && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">
                              Confidence:
                            </span>
                            <span className="text-xs text-white font-medium">
                              {(confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {action && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">
                              Signal:
                            </span>
                            <span
                              className={`text-xs font-medium capitalize ${
                                action === "bullish" || action === "buy"
                                  ? "text-green-400"
                                  : action === "bearish" || action === "sell"
                                  ? "text-red-400"
                                  : "text-yellow-400"
                              }`}
                            >
                              {action}
                            </span>
                          </div>
                        )}
                        {pattern.candles && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">
                              Candles:
                            </span>
                            <span className="text-xs text-white">
                              {pattern.candles}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Pattern Contribution to Score */}
                      {confidence !== null && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          <p className="text-xs text-gray-500 mb-1">
                            This pattern contributes to the final decision:
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">
                                Contribution to{" "}
                                {action === "bullish" || action === "buy"
                                  ? "BUY"
                                  : action === "bearish" || action === "sell"
                                  ? "SELL"
                                  : "HOLD"}
                                :
                              </span>
                              <FormulaTooltip
                                formula={`contribution = confidence × strength × pattern_weight × 100`}
                                description={`Raw contribution before normalization. For patterns, strength equals confidence. This value is then divided by total_weight to get the final normalized percentage.`}
                              >
                                <span className="text-white font-medium">
                                  {contribution}%
                                </span>
                              </FormulaTooltip>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">
                                Pattern Weight:
                              </span>
                              <span className="text-white">
                                {(patternWeight * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 pt-1 border-t border-gray-700">
                              <span className="text-gray-400">
                                Calculation: {(confidence || 0).toFixed(2)} ×{" "}
                                {(strength || 0).toFixed(2)} ×{" "}
                                {patternWeight.toFixed(2)} × 100 ={" "}
                                <span className="text-white font-medium">
                                  {contribution}%
                                </span>
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        ),
      });
    }

    // Step 5: ML Model Predictions
    if (
      signalHistory?.ml_signals?.predictions &&
      signalHistory.ml_signals.predictions.length > 0
    ) {
      steps.push({
        id: "ml_signals",
        title: "ML Model Predictions",
        description: `${signalHistory.ml_signals.predictions.length} model${
          signalHistory.ml_signals.predictions.length !== 1 ? "s" : ""
        } analyzed`,
        icon: <Brain className="w-5 h-5" />,
        status: "completed",
        timestamp: signalTimestamp.toISOString(),
        data: signalHistory.ml_signals,
        details: (
          <div className="mt-2 space-y-2">
            {signalHistory.ml_signals.predictions.map(
              (pred: any, idx: number) => (
                <div key={idx} className="bg-gray-700/50 rounded p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">
                      {pred.model_name || `Model ${idx + 1}`}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded capitalize ${
                        pred.action === "buy"
                          ? "bg-green-500/20 text-green-400"
                          : pred.action === "sell"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {pred.action}
                    </span>
                  </div>
                  {pred.confidence &&
                    (() => {
                      const confidence = toNumber(pred.confidence);
                      return confidence !== null ? (
                        <p className="text-xs text-gray-400 mt-1">
                          Confidence: {(confidence * 100).toFixed(1)}%
                        </p>
                      ) : null;
                    })()}
                </div>
              )
            )}
          </div>
        ),
      });
    }

    // Step 6: Social Media Sentiment - only if enabled
    const socialEnabled = (execution as any).bot_config_settings
      ?.enable_social_analysis;
    if (
      socialEnabled &&
      signalHistory?.social_signals &&
      Object.keys(signalHistory.social_signals).length > 0 &&
      signalHistory.social_signals.action &&
      signalHistory.social_signals.confidence !== null &&
      signalHistory.social_signals.confidence !== undefined &&
      !isNaN(Number(signalHistory.social_signals.confidence))
    ) {
      steps.push({
        id: "social_signals",
        title: "Social Media Sentiment",
        description: "Analyzed social media sentiment",
        icon: <MessageSquare className="w-5 h-5" />,
        status: "completed",
        timestamp: signalTimestamp.toISOString(),
        data: signalHistory.social_signals,
        details: (
          <div className="mt-2 bg-gray-700/50 rounded p-2">
            {signalHistory.social_signals.action && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Sentiment:</span>
                <span className="text-sm font-medium text-white capitalize">
                  {signalHistory.social_signals.action}
                </span>
              </div>
            )}
            {(() => {
              const confidence = toNumber(
                signalHistory.social_signals.confidence
              );
              return confidence !== null ? (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-gray-400">Confidence:</span>
                  <span className="text-sm font-medium text-white">
                    {(confidence * 100).toFixed(1)}%
                  </span>
                </div>
              ) : null;
            })()}
          </div>
        ),
      });
    }

    // Step 7: News Sentiment - only if enabled
    const newsEnabled = (execution as any).bot_config_settings
      ?.enable_news_analysis;
    if (
      newsEnabled &&
      signalHistory?.news_signals &&
      Object.keys(signalHistory.news_signals).length > 0 &&
      signalHistory.news_signals.action &&
      signalHistory.news_signals.confidence !== null &&
      signalHistory.news_signals.confidence !== undefined &&
      !isNaN(Number(signalHistory.news_signals.confidence))
    ) {
      steps.push({
        id: "news_signals",
        title: "News Sentiment",
        description: "Analyzed news sentiment",
        icon: <Newspaper className="w-5 h-5" />,
        status: "completed",
        timestamp: signalTimestamp.toISOString(),
        data: signalHistory.news_signals,
        details: (
          <div className="mt-2 bg-gray-700/50 rounded p-2">
            {signalHistory.news_signals.action && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Sentiment:</span>
                <span className="text-sm font-medium text-white capitalize">
                  {signalHistory.news_signals.action}
                </span>
              </div>
            )}
            {(() => {
              const confidence = toNumber(
                signalHistory.news_signals.confidence
              );
              return confidence !== null ? (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-gray-400">Confidence:</span>
                  <span className="text-sm font-medium text-white">
                    {(confidence * 100).toFixed(1)}%
                  </span>
                </div>
              ) : null;
            })()}
          </div>
        ),
      });
    }

    // Step 8: Signal Aggregation
    if (signalHistory?.aggregated_signal) {
      const aggSignal = signalHistory.aggregated_signal;
      const decisionDetails = (execution as any).decision_details || {};

      steps.push({
        id: "aggregation",
        title: "Signal Aggregation",
        description: "Combined all signals into final decision",
        icon: <GitMerge className="w-5 h-5" />,
        status: "completed",
        timestamp: signalTimestamp.toISOString(),
        data: aggSignal,
        details: (
          <div className="mt-2 space-y-3">
            {/* Aggregation Method */}
            {decisionDetails.aggregation_method && (
              <div className="bg-gray-700/50 rounded p-2">
                <p className="text-xs text-gray-400 mb-1">Aggregation Method</p>
                <p className="text-sm font-medium text-white capitalize">
                  {decisionDetails.aggregation_method.replace("_", " ")}
                </p>
              </div>
            )}

            {/* Signals Used */}
            {decisionDetails.signals_used !== undefined && (
              <div className="bg-gray-700/50 rounded p-2">
                <p className="text-xs text-gray-400 mb-1">Signals Used</p>
                <p className="text-sm font-medium text-white">
                  {decisionDetails.signals_used} signal
                  {decisionDetails.signals_used !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* Action Scores */}
            {aggSignal.action_scores && (
              <div className="bg-gray-700/50 rounded p-2">
                <p className="text-xs text-gray-400 mb-2">Action Scores</p>
                <div className="space-y-2">
                  {Object.entries(aggSignal.action_scores).map(
                    ([action, score]: [string, any]) => {
                      const scoreNum = toNumber(score);
                      const percentage = scoreNum !== null ? scoreNum * 100 : 0;
                      return (
                        <div key={action} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-300 capitalize">
                              {action}:
                            </span>
                            <FormulaTooltip
                              formula={`Score_${action} = Σ(signal.confidence × signal.strength × weight) / total_weight`}
                              description={`Normalized weighted sum of all ${action} signals. Each signal contributes based on its confidence, strength, and type weight.`}
                            >
                              <span className="text-xs text-white font-medium">
                                {scoreNum !== null
                                  ? `${percentage.toFixed(2)}%`
                                  : "N/A"}
                              </span>
                            </FormulaTooltip>
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                action === "buy"
                                  ? "bg-green-500"
                                  : action === "sell"
                                  ? "bg-red-500"
                                  : "bg-gray-500"
                              }`}
                              style={{
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* Final Confidence */}
            {aggSignal.confidence !== undefined &&
              (() => {
                const confidence = toNumber(aggSignal.confidence);
                return confidence !== null ? (
                  <div className="bg-gray-700/50 rounded p-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        Final Confidence:
                      </span>
                      <FormulaTooltip
                        formula="Final Confidence = max(Buy_Score, Sell_Score, Hold_Score)"
                        description="The confidence of the winning action (the action with the highest normalized score)."
                      >
                        <span className="text-sm font-medium text-white">
                          {(confidence * 100).toFixed(2)}%
                        </span>
                      </FormulaTooltip>
                    </div>
                  </div>
                ) : null;
              })()}

            {/* Risk Adjustment */}
            {decisionDetails.position_scale_factor !== undefined && (
              <div className="bg-gray-700/50 rounded p-2">
                <p className="text-xs text-gray-400 mb-1">
                  Position Scale Factor
                </p>
                <div className="flex items-center gap-2">
                  <FormulaTooltip
                    formula="scale_factor = 1 - (risk_score / 100) × risk_adjustment_factor"
                    description="Position size is reduced when risk score is high. Higher risk = smaller position size."
                  >
                    <p className="text-sm font-medium text-white">
                      {(decisionDetails.position_scale_factor * 100).toFixed(1)}
                      %
                      {decisionDetails.position_scale_factor < 1.0 && (
                        <span className="text-yellow-400 ml-2 text-xs">
                          (Reduced due to risk)
                        </span>
                      )}
                    </p>
                  </FormulaTooltip>
                </div>
              </div>
            )}

            {/* Risk Override */}
            {decisionDetails.risk_override && (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded p-2">
                <p className="text-xs text-yellow-400 font-medium">
                  ⚠️ Risk Override: Decision modified due to risk score
                </p>
              </div>
            )}

            {/* Risk Score Threshold */}
            {decisionDetails.risk_score_threshold !== undefined && (
              <div className="bg-gray-700/50 rounded p-2">
                <p className="text-xs text-gray-400 mb-1">
                  Risk Score Threshold
                </p>
                <p className="text-sm font-medium text-white">
                  {decisionDetails.risk_score_threshold.toFixed(2)}
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="bg-gray-700/50 rounded p-2">
              <p className="text-xs text-gray-400 mb-1">Reason</p>
              <p className="text-sm text-white">
                {aggSignal.reason || "No reason provided"}
              </p>
            </div>

            {/* Prediction Analysis Section */}
            {(aggSignal.possible_gain !== undefined ||
              aggSignal.possible_loss !== undefined ||
              aggSignal.gain_probability !== undefined ||
              aggSignal.timeframe_prediction) && (
              <div className="bg-gray-700/50 rounded p-3 border border-gray-600 space-y-3">
                <p className="text-xs font-semibold text-gray-300 mb-2">
                  Prediction Analysis
                </p>

                {/* Gain/Loss Predictions */}
                {(aggSignal.possible_gain !== undefined ||
                  aggSignal.possible_loss !== undefined) && (
                  <div className="grid grid-cols-2 gap-2">
                    {aggSignal.possible_gain !== undefined && (
                      <div className="bg-green-900/30 border border-green-500/50 rounded p-2">
                        <p className="text-xs text-gray-400 mb-1">
                          Possible Gain
                        </p>
                        <p className="text-sm font-medium text-green-400">
                          +{aggSignal.possible_gain.toFixed(2)}%
                        </p>
                      </div>
                    )}
                    {aggSignal.possible_loss !== undefined && (
                      <div className="bg-red-900/30 border border-red-500/50 rounded p-2">
                        <p className="text-xs text-gray-400 mb-1">
                          Possible Loss
                        </p>
                        <p className="text-sm font-medium text-red-400">
                          -{aggSignal.possible_loss.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Probabilities */}
                {(aggSignal.gain_probability !== undefined ||
                  aggSignal.loss_probability !== undefined) && (
                  <div className="space-y-2">
                    {aggSignal.gain_probability !== undefined && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">
                            Gain Probability
                          </span>
                          <span className="text-xs text-green-400 font-medium">
                            {(aggSignal.gain_probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${aggSignal.gain_probability * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {aggSignal.loss_probability !== undefined && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">
                            Loss Probability
                          </span>
                          <span className="text-xs text-red-400 font-medium">
                            {(aggSignal.loss_probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${aggSignal.loss_probability * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeframe Prediction */}
                {aggSignal.timeframe_prediction && (
                  <div className="bg-gray-800/50 rounded p-2">
                    <p className="text-xs text-gray-400 mb-2">
                      Expected Timeframe
                    </p>
                    <div className="flex items-center gap-2">
                      {aggSignal.timeframe_prediction.min_timeframe && (
                        <span className="text-xs text-gray-500">
                          {aggSignal.timeframe_prediction.min_timeframe}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">-</span>
                      {aggSignal.timeframe_prediction.max_timeframe && (
                        <span className="text-xs text-gray-500">
                          {aggSignal.timeframe_prediction.max_timeframe}
                        </span>
                      )}
                      {aggSignal.timeframe_prediction.expected_timeframe && (
                        <>
                          <span className="text-xs text-gray-400">
                            (Expected:
                          </span>
                          <span className="text-xs text-blue-400 font-medium">
                            {aggSignal.timeframe_prediction.expected_timeframe}
                          </span>
                          <span className="text-xs text-gray-400">)</span>
                        </>
                      )}
                    </div>
                    {aggSignal.timeframe_prediction.timeframe_confidence !==
                      undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence:{" "}
                        {(
                          aggSignal.timeframe_prediction.timeframe_confidence *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    )}
                  </div>
                )}

                {/* Scenario Analysis */}
                {aggSignal.consequences && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 mb-2">
                      Scenario Analysis
                    </p>
                    {aggSignal.consequences.best_case && (
                      <div className="bg-green-900/20 border border-green-500/30 rounded p-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-green-400">
                            Best Case
                          </span>
                          {aggSignal.consequences.best_case.gain !==
                            undefined && (
                            <span className="text-xs text-green-400 font-medium">
                              +
                              {aggSignal.consequences.best_case.gain.toFixed(2)}
                              %
                            </span>
                          )}
                        </div>
                        {aggSignal.consequences.best_case.probability !==
                          undefined && (
                          <p className="text-xs text-gray-400">
                            Probability:{" "}
                            {(
                              aggSignal.consequences.best_case.probability * 100
                            ).toFixed(1)}
                            %
                          </p>
                        )}
                        {aggSignal.consequences.best_case.timeframe && (
                          <p className="text-xs text-gray-400">
                            Timeframe:{" "}
                            {aggSignal.consequences.best_case.timeframe}
                          </p>
                        )}
                      </div>
                    )}
                    {aggSignal.consequences.base_case && (
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded p-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-blue-400">
                            Base Case
                          </span>
                          {aggSignal.consequences.base_case.gain !==
                            undefined && (
                            <span className="text-xs text-blue-400 font-medium">
                              +
                              {aggSignal.consequences.base_case.gain.toFixed(2)}
                              %
                            </span>
                          )}
                        </div>
                        {aggSignal.consequences.base_case.probability !==
                          undefined && (
                          <p className="text-xs text-gray-400">
                            Probability:{" "}
                            {(
                              aggSignal.consequences.base_case.probability * 100
                            ).toFixed(1)}
                            %
                          </p>
                        )}
                        {aggSignal.consequences.base_case.timeframe && (
                          <p className="text-xs text-gray-400">
                            Timeframe:{" "}
                            {aggSignal.consequences.base_case.timeframe}
                          </p>
                        )}
                      </div>
                    )}
                    {aggSignal.consequences.worst_case && (
                      <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-red-400">
                            Worst Case
                          </span>
                          {aggSignal.consequences.worst_case.loss !==
                            undefined && (
                            <span className="text-xs text-red-400 font-medium">
                              -
                              {aggSignal.consequences.worst_case.loss.toFixed(
                                2
                              )}
                              %
                            </span>
                          )}
                        </div>
                        {aggSignal.consequences.worst_case.probability !==
                          undefined && (
                          <p className="text-xs text-gray-400">
                            Probability:{" "}
                            {(
                              aggSignal.consequences.worst_case.probability *
                              100
                            ).toFixed(1)}
                            %
                          </p>
                        )}
                        {aggSignal.consequences.worst_case.timeframe && (
                          <p className="text-xs text-gray-400">
                            Timeframe:{" "}
                            {aggSignal.consequences.worst_case.timeframe}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Detailed Signal Contribution Breakdown */}
            <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
              <p className="text-xs font-semibold text-gray-300 mb-3">
                Signal Contribution Breakdown
              </p>

              {/* Calculate and show signal weights */}
              {(() => {
                const decisionDetails =
                  (execution as any).decision_details || {};
                const defaultWeights = {
                  ml: 0.4,
                  indicator: 0.3,
                  pattern: 0.15,
                  social_media: 0.1,
                  news: 0.05,
                };
                // Get weights from decision details or use defaults
                const signalWeights =
                  decisionDetails.signal_weights || defaultWeights;

                // Calculate total contributions by action and source
                // Backend stores indicator_signals as {signals: [...], count: ...}
                const indicatorSignals = Array.isArray(
                  signalHistory.indicator_signals?.signals
                )
                  ? signalHistory.indicator_signals.signals
                  : Array.isArray(signalHistory.indicator_signals)
                  ? signalHistory.indicator_signals
                  : [];
                // Backend stores pattern_signals as {patterns: [...], count: ...}
                const patternSignals = Array.isArray(
                  signalHistory.pattern_signals?.patterns
                )
                  ? signalHistory.pattern_signals.patterns
                  : Array.isArray(signalHistory.pattern_signals)
                  ? signalHistory.pattern_signals
                  : [];
                // Backend stores ml_signals as {predictions: [...], count: ...}
                const mlSignals = Array.isArray(
                  signalHistory.ml_signals?.predictions
                )
                  ? signalHistory.ml_signals.predictions
                  : Array.isArray(signalHistory.ml_signals)
                  ? signalHistory.ml_signals
                  : [];

                const indicatorWeight = signalWeights.indicator || 0.3;
                const patternWeight = signalWeights.pattern || 0.15;
                const mlWeight = signalWeights.ml || 0.4;

                // Calculate contributions to each action (before normalization)
                // This matches the backend weighted_average calculation:
                // action_scores[action] += signal.confidence * signal.strength * weight
                // total_weight += weight (once per signal)
                const buyContrib = {
                  indicator: 0,
                  pattern: 0,
                  ml: 0,
                  social: 0,
                  news: 0,
                };
                const sellContrib = {
                  indicator: 0,
                  pattern: 0,
                  ml: 0,
                  social: 0,
                  news: 0,
                };
                const holdContrib = {
                  indicator: 0,
                  pattern: 0,
                  ml: 0,
                  social: 0,
                  news: 0,
                };

                // Track total contribution for normalization (matching backend fix)
                // Backend now normalizes by total_contribution (sum of all confidence * strength * weight)
                // instead of total_weight (sum of weights)
                let totalContribution = 0;

                indicatorSignals.forEach((signal: any) => {
                  const conf = toNumber(signal.confidence) || 0;
                  const strength = toNumber(signal.strength) || conf || 0;
                  const contrib = conf * strength * indicatorWeight;
                  totalContribution += contrib; // Add contribution, not just weight
                  const action = signal.action || "hold";
                  if (action === "buy") buyContrib.indicator += contrib;
                  else if (action === "sell") sellContrib.indicator += contrib;
                  else holdContrib.indicator += contrib;
                });

                patternSignals.forEach((signal: any) => {
                  const conf = toNumber(signal.confidence) || 0;
                  const strength = conf;
                  const contrib = conf * strength * patternWeight;
                  totalContribution += contrib; // Add contribution, not just weight
                  const action = signal.signal || "hold";
                  // Map pattern signals to actions
                  if (action === "bullish" || action === "buy")
                    buyContrib.pattern += contrib;
                  else if (action === "bearish" || action === "sell")
                    sellContrib.pattern += contrib;
                  else holdContrib.pattern += contrib;
                });

                mlSignals.forEach((signal: any) => {
                  const conf = toNumber(signal.confidence) || 0;
                  const strength = conf;
                  const contrib = conf * strength * mlWeight;
                  totalContribution += contrib; // Add contribution, not just weight
                  const action = signal.action || "hold";
                  if (action === "buy") buyContrib.ml += contrib;
                  else if (action === "sell") sellContrib.ml += contrib;
                  else holdContrib.ml += contrib;
                });

                // Add social and news signals if available
                const socialEnabled = (execution as any).bot_config_settings
                  ?.enable_social_analysis;
                const socialData = signalHistory.social_signals;
                if (
                  socialEnabled &&
                  socialData &&
                  socialData.action &&
                  socialData.confidence
                ) {
                  const conf = toNumber(socialData.confidence) || 0;
                  const strength = toNumber(socialData.strength) || conf || 0;
                  const socialWeight = signalWeights.social_media || 0.1;
                  const contrib = conf * strength * socialWeight;
                  totalContribution += contrib; // Add contribution, not just weight
                  const action = socialData.action || "hold";
                  if (action === "buy") buyContrib.social += contrib;
                  else if (action === "sell") sellContrib.social += contrib;
                  else holdContrib.social += contrib;
                }

                const newsEnabled = (execution as any).bot_config_settings
                  ?.enable_news_analysis;
                const newsData = signalHistory.news_signals;
                if (
                  newsEnabled &&
                  newsData &&
                  newsData.action &&
                  newsData.confidence
                ) {
                  const conf = toNumber(newsData.confidence) || 0;
                  const strength = toNumber(newsData.strength) || conf || 0;
                  const newsWeight = signalWeights.news || 0.05;
                  const contrib = conf * strength * newsWeight;
                  totalContribution += contrib; // Add contribution, not just weight
                  const action = newsData.action || "hold";
                  if (action === "buy") buyContrib.news += contrib;
                  else if (action === "sell") sellContrib.news += contrib;
                  else holdContrib.news += contrib;
                }

                // Normalize contributions by total_contribution (matching backend fix)
                // This ensures scores sum to 1.0 and properly respect all signals
                const normalize = (value: number) =>
                  totalContribution > 0 ? value / totalContribution : 0;

                const buyTotal =
                  buyContrib.indicator +
                  buyContrib.pattern +
                  buyContrib.ml +
                  buyContrib.social +
                  buyContrib.news;
                const sellTotal =
                  sellContrib.indicator +
                  sellContrib.pattern +
                  sellContrib.ml +
                  sellContrib.social +
                  sellContrib.news;
                const holdTotal =
                  holdContrib.indicator +
                  holdContrib.pattern +
                  holdContrib.ml +
                  holdContrib.social +
                  holdContrib.news;

                const buyNormalized = normalize(buyTotal);
                const sellNormalized = normalize(sellTotal);
                const holdNormalized = normalize(holdTotal);

                return (
                  <div className="mb-4 space-y-3">
                    {/* Signal Type Weights */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">
                        Signal Type Weights:
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">ML Models:</span>
                          <span className="text-white">
                            {(mlWeight * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Indicators:</span>
                          <span className="text-white">
                            {(indicatorWeight * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Patterns:</span>
                          <span className="text-white">
                            {(patternWeight * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Social:</span>
                          <span className="text-white">
                            {(
                              (signalWeights.social_media || 0.1) * 100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Score Contributions Summary */}
                    <div className="bg-gray-800/50 rounded p-2 border border-gray-700">
                      <p className="text-xs text-gray-400 mb-2 font-medium">
                        Final Action Scores (Normalized):
                      </p>
                      <div className="space-y-2 text-xs">
                        {/* Buy Contributions */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-green-400 font-medium">
                              Buy Score:
                            </span>
                            <FormulaTooltip
                              formula="Buy_Score = (Buy_Indicators + Buy_Patterns + Buy_ML + Buy_Social + Buy_News) / total_weight"
                              description="Total normalized contribution from all signal sources for buy action."
                            >
                              <span className="text-white">
                                {(buyNormalized * 100).toFixed(2)}%
                              </span>
                            </FormulaTooltip>
                          </div>
                          <div className="pl-2 space-y-0.5 text-gray-400">
                            <div className="flex justify-between items-center">
                              <span>Indicators:</span>
                              <FormulaTooltip
                                formula="Σ(indicator.confidence × indicator.strength × indicator_weight) / total_weight"
                                description="Sum of all indicator signals contributing to buy, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(
                                    normalize(buyContrib.indicator) * 100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Patterns:</span>
                              <FormulaTooltip
                                formula="Σ(pattern.confidence × pattern.confidence × pattern_weight) / total_weight"
                                description="Sum of all pattern signals contributing to buy, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(
                                    normalize(buyContrib.pattern) * 100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>ML Models:</span>
                              <FormulaTooltip
                                formula="Σ(ml.confidence × ml.confidence × ml_weight) / total_weight"
                                description="Sum of all ML model predictions contributing to buy, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(normalize(buyContrib.ml) * 100).toFixed(2)}%
                                </span>
                              </FormulaTooltip>
                            </div>
                            {buyContrib.social > 0 && (
                              <div className="flex justify-between items-center">
                                <span>Social:</span>
                                <FormulaTooltip
                                  formula="social.confidence × social.strength × social_weight / total_weight"
                                  description="Social media sentiment signal contribution to buy, normalized by total weight."
                                >
                                  <span className="text-white">
                                    {(
                                      normalize(buyContrib.social) * 100
                                    ).toFixed(2)}
                                    %
                                  </span>
                                </FormulaTooltip>
                              </div>
                            )}
                            {buyContrib.news > 0 && (
                              <div className="flex justify-between items-center">
                                <span>News:</span>
                                <FormulaTooltip
                                  formula="news.confidence × news.strength × news_weight / total_weight"
                                  description="News sentiment signal contribution to buy, normalized by total weight."
                                >
                                  <span className="text-white">
                                    {(normalize(buyContrib.news) * 100).toFixed(
                                      2
                                    )}
                                    %
                                  </span>
                                </FormulaTooltip>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sell Contributions */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-red-400 font-medium">
                              Sell Score:
                            </span>
                            <FormulaTooltip
                              formula="Sell_Score = (Sell_Indicators + Sell_Patterns + Sell_ML + Sell_Social + Sell_News) / total_weight"
                              description="Total normalized contribution from all signal sources for sell action."
                            >
                              <span className="text-white">
                                {(sellNormalized * 100).toFixed(2)}%
                              </span>
                            </FormulaTooltip>
                          </div>
                          <div className="pl-2 space-y-0.5 text-gray-400">
                            <div className="flex justify-between items-center">
                              <span>Indicators:</span>
                              <FormulaTooltip
                                formula="Σ(indicator.confidence × indicator.strength × indicator_weight) / total_weight"
                                description="Sum of all indicator signals contributing to sell, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(
                                    normalize(sellContrib.indicator) * 100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Patterns:</span>
                              <FormulaTooltip
                                formula="Σ(pattern.confidence × pattern.confidence × pattern_weight) / total_weight"
                                description="Sum of all pattern signals contributing to sell, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(
                                    normalize(sellContrib.pattern) * 100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>ML Models:</span>
                              <FormulaTooltip
                                formula="Σ(ml.confidence × ml.confidence × ml_weight) / total_weight"
                                description="Sum of all ML model predictions contributing to sell, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(normalize(sellContrib.ml) * 100).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            {sellContrib.social > 0 && (
                              <div className="flex justify-between items-center">
                                <span>Social:</span>
                                <FormulaTooltip
                                  formula="social.confidence × social.strength × social_weight / total_weight"
                                  description="Social media sentiment signal contribution to sell, normalized by total weight."
                                >
                                  <span className="text-white">
                                    {(
                                      normalize(sellContrib.social) * 100
                                    ).toFixed(2)}
                                    %
                                  </span>
                                </FormulaTooltip>
                              </div>
                            )}
                            {sellContrib.news > 0 && (
                              <div className="flex justify-between items-center">
                                <span>News:</span>
                                <FormulaTooltip
                                  formula="news.confidence × news.strength × news_weight / total_weight"
                                  description="News sentiment signal contribution to sell, normalized by total weight."
                                >
                                  <span className="text-white">
                                    {(
                                      normalize(sellContrib.news) * 100
                                    ).toFixed(2)}
                                    %
                                  </span>
                                </FormulaTooltip>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Hold Contributions */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-yellow-400 font-medium">
                              Hold Score:
                            </span>
                            <FormulaTooltip
                              formula="Hold_Score = (Hold_Indicators + Hold_Patterns + Hold_ML + Hold_Social + Hold_News) / total_weight"
                              description="Total normalized contribution from all signal sources for hold action."
                            >
                              <span className="text-white">
                                {(holdNormalized * 100).toFixed(2)}%
                              </span>
                            </FormulaTooltip>
                          </div>
                          <div className="pl-2 space-y-0.5 text-gray-400">
                            <div className="flex justify-between items-center">
                              <span>Indicators:</span>
                              <FormulaTooltip
                                formula="Σ(indicator.confidence × indicator.strength × indicator_weight) / total_weight"
                                description="Sum of all indicator signals contributing to hold, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(
                                    normalize(holdContrib.indicator) * 100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Patterns:</span>
                              <FormulaTooltip
                                formula="Σ(pattern.confidence × pattern.confidence × pattern_weight) / total_weight"
                                description="Sum of all pattern signals contributing to hold, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(
                                    normalize(holdContrib.pattern) * 100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>ML Models:</span>
                              <FormulaTooltip
                                formula="Σ(ml.confidence × ml.confidence × ml_weight) / total_weight"
                                description="Sum of all ML model predictions contributing to hold, normalized by total weight."
                              >
                                <span className="text-white">
                                  {(normalize(holdContrib.ml) * 100).toFixed(2)}
                                  %
                                </span>
                              </FormulaTooltip>
                            </div>
                            {holdContrib.social > 0 && (
                              <div className="flex justify-between">
                                <span>Social:</span>
                                <span className="text-white">
                                  {(
                                    normalize(holdContrib.social) * 100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </div>
                            )}
                            {holdContrib.news > 0 && (
                              <div className="flex justify-between items-center">
                                <span>News:</span>
                                <FormulaTooltip
                                  formula="news.confidence × news.strength × news_weight / total_weight"
                                  description="News sentiment signal contribution to hold, normalized by total weight."
                                >
                                  <span className="text-white">
                                    {(
                                      normalize(holdContrib.news) * 100
                                    ).toFixed(2)}
                                    %
                                  </span>
                                </FormulaTooltip>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Indicator Signals Contribution */}
              {(() => {
                // Backend stores indicator_signals as {signals: [...], count: ...}
                const indicatorSignalsList = Array.isArray(
                  signalHistory.indicator_signals?.signals
                )
                  ? signalHistory.indicator_signals.signals
                  : Array.isArray(signalHistory.indicator_signals)
                  ? signalHistory.indicator_signals
                  : [];
                return indicatorSignalsList.length > 0 ? (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-2 font-medium">
                      Indicator Signals Contribution (
                      {indicatorSignalsList.length})
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {indicatorSignalsList.map((signal: any, idx: number) => {
                        const confidence = toNumber(signal.confidence);
                        const strength =
                          toNumber(signal.strength) || confidence || 0;
                        const action = signal.action || "hold";
                        const indicatorWeight = 0.3; // Default weight for indicators
                        const contribution =
                          confidence !== null
                            ? (
                                confidence *
                                strength *
                                indicatorWeight *
                                100
                              ).toFixed(2)
                            : "0.00";

                        return (
                          <div
                            key={idx}
                            className="bg-gray-800/50 rounded p-2 border border-gray-700"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-white">
                                {signal.name || `Indicator ${idx + 1}`}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded capitalize ${
                                  action === "buy"
                                    ? "bg-green-900/30 text-green-300"
                                    : action === "sell"
                                    ? "bg-red-900/30 text-red-300"
                                    : "bg-gray-700 text-gray-300"
                                }`}
                              >
                                {action}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                              <div>
                                <span className="text-gray-400">
                                  Confidence:
                                </span>
                                <span className="text-white ml-1">
                                  {confidence !== null
                                    ? `${(confidence * 100).toFixed(1)}%`
                                    : "N/A"}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Weight:</span>
                                <span className="text-white ml-1">
                                  {(indicatorWeight * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="col-span-2 flex justify-between items-center">
                                <span className="text-gray-400">
                                  Contribution to {action}:
                                </span>
                                <FormulaTooltip
                                  formula={`contribution = confidence × strength × indicator_weight × 100`}
                                  description={`Raw contribution before normalization. This value is then divided by total_weight to get the final normalized percentage.`}
                                >
                                  <span className="text-white ml-1 font-medium">
                                    {contribution}%
                                  </span>
                                </FormulaTooltip>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Pattern Signals Contribution */}
              {(() => {
                const patternSignals = Array.isArray(
                  signalHistory.pattern_signals?.patterns
                )
                  ? signalHistory.pattern_signals.patterns
                  : Array.isArray(signalHistory.pattern_signals)
                  ? signalHistory.pattern_signals
                  : [];

                if (patternSignals.length === 0) return null;

                const decisionDetails =
                  (execution as any).decision_details || {};
                const defaultWeights = {
                  ml: 0.4,
                  indicator: 0.3,
                  pattern: 0.15,
                  social_media: 0.1,
                  news: 0.05,
                };
                const signalWeights =
                  decisionDetails.signal_weights || defaultWeights;
                const patternWeight = signalWeights.pattern || 0.15;

                return (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-2 font-medium">
                      Pattern Signals Contribution ({patternSignals.length})
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {patternSignals.map((signal: any, idx: number) => {
                        const confidence = toNumber(signal.confidence) || 0;
                        const strength = confidence; // For patterns, strength equals confidence
                        const action = signal.signal || "hold";
                        const contribution =
                          confidence !== null
                            ? (
                                confidence *
                                strength *
                                patternWeight *
                                100
                              ).toFixed(2)
                            : "0.00";

                        return (
                          <div
                            key={idx}
                            className="bg-gray-800/50 rounded p-2 border border-gray-700"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white">
                                  {signal.pattern_name ||
                                    signal.pattern ||
                                    `Pattern ${idx + 1}`}
                                </span>
                                {/* Regime pattern indicator */}
                                {(signal.pattern === "trending_regime" ||
                                  signal.pattern === "ranging_regime" ||
                                  signal.pattern === "volatile_regime" ||
                                  signal.pattern === "regime_transition") && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-900/30 text-blue-300 rounded">
                                    Regime
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-xs px-2 py-0.5 rounded capitalize ${
                                  action === "bullish" || action === "buy"
                                    ? "bg-green-900/30 text-green-300"
                                    : action === "bearish" || action === "sell"
                                    ? "bg-red-900/30 text-red-300"
                                    : "bg-gray-700 text-gray-300"
                                }`}
                              >
                                {action}
                              </span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">
                                    Confidence:
                                  </span>
                                  <span className="text-white font-medium">
                                    {confidence !== null
                                      ? (confidence * 100).toFixed(1)
                                      : "N/A"}
                                    %
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">
                                    Strength:
                                  </span>
                                  <span className="text-white font-medium">
                                    {strength !== null
                                      ? (strength * 100).toFixed(1)
                                      : "N/A"}
                                    %
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">
                                    Pattern Weight:
                                  </span>
                                  <span className="text-white font-medium">
                                    {(patternWeight * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">
                                    Contribution to{" "}
                                    {action === "bullish" || action === "buy"
                                      ? "BUY"
                                      : action === "bearish" ||
                                        action === "sell"
                                      ? "SELL"
                                      : "HOLD"}
                                    :
                                  </span>
                                  <FormulaTooltip
                                    formula={`contribution = confidence × strength × pattern_weight × 100`}
                                    description={`Raw contribution before normalization. For patterns, strength equals confidence. This value is then divided by total_weight to get the final normalized percentage.`}
                                  >
                                    <span className="text-white font-bold">
                                      {contribution}%
                                    </span>
                                  </FormulaTooltip>
                                </div>
                              </div>
                              {/* Regime pattern metadata */}
                              {(signal.pattern === "trending_regime" ||
                                signal.pattern === "ranging_regime" ||
                                signal.pattern === "volatile_regime" ||
                                signal.pattern === "regime_transition") &&
                                signal.description && (
                                  <div className="pt-2 border-t border-gray-600">
                                    <p className="text-xs text-gray-400 mb-1">
                                      Regime Characteristics:
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {signal.description}
                                    </p>
                                  </div>
                                )}
                              <div className="pt-2 border-t border-gray-600">
                                <p className="text-xs text-gray-500">
                                  <span className="text-gray-400">
                                    Calculation:{" "}
                                  </span>
                                  {(confidence || 0).toFixed(2)} ×{" "}
                                  {(strength || 0).toFixed(2)} ×{" "}
                                  {patternWeight.toFixed(2)} × 100 ={" "}
                                  <span className="text-white font-medium">
                                    {contribution}%
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ML Signals - Enhanced for Transformer Models */}
              {(() => {
                const mlSignals = signalHistory.ml_signals?.predictions
                  ? signalHistory.ml_signals.predictions
                  : Array.isArray(signalHistory.ml_signals)
                  ? signalHistory.ml_signals
                  : [];

                if (mlSignals.length === 0) return null;

                return (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-2 font-medium">
                      ML Signals ({mlSignals.length})
                    </p>
                    <div className="space-y-2">
                      {mlSignals.map((signal: any, idx: number) => {
                        const isTransformer =
                          signal.metadata?.model_type?.includes(
                            "Transformer"
                          ) ||
                          signal.model_name?.includes("Transformer") ||
                          signal.model_name?.includes("PatchTST") ||
                          signal.model_name?.includes("Informer") ||
                          signal.model_name?.includes("Autoformer") ||
                          signal.metadata?.model_type === "Transformer+RL";

                        return (
                          <div
                            key={idx}
                            className="bg-gray-800/50 rounded p-2 border border-gray-700"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4 text-purple-400" />
                                <span className="text-xs font-medium text-white">
                                  {signal.model_name || `Model ${idx + 1}`}
                                </span>
                                {isTransformer && (
                                  <span className="text-xs px-1.5 py-0.5 bg-purple-900/30 text-purple-300 rounded">
                                    Transformer
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-xs px-2 py-0.5 rounded capitalize ${
                                  signal.action === "buy"
                                    ? "bg-green-900/30 text-green-300"
                                    : signal.action === "sell"
                                    ? "bg-red-900/30 text-red-300"
                                    : "bg-gray-700 text-gray-300"
                                }`}
                              >
                                {signal.action}
                              </span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">
                                    Confidence:
                                  </span>
                                  <span className="text-white font-medium">
                                    {((signal.confidence || 0) * 100).toFixed(
                                      1
                                    )}
                                    %
                                  </span>
                                </div>
                                {signal.predicted_gain !== undefined && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Pred. Gain:
                                    </span>
                                    <span className="text-green-400 font-medium">
                                      +
                                      {(
                                        (signal.predicted_gain || 0) * 100
                                      ).toFixed(2)}
                                      %
                                    </span>
                                  </div>
                                )}
                                {signal.predicted_loss !== undefined && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Pred. Loss:
                                    </span>
                                    <span className="text-red-400 font-medium">
                                      -
                                      {(
                                        (signal.predicted_loss || 0) * 100
                                      ).toFixed(2)}
                                      %
                                    </span>
                                  </div>
                                )}
                                {signal.gain_probability !== undefined && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Gain Prob:
                                    </span>
                                    <span className="text-white font-medium">
                                      {(
                                        (signal.gain_probability || 0) * 100
                                      ).toFixed(1)}
                                      %
                                    </span>
                                  </div>
                                )}
                              </div>
                              {/* Transformer-specific metadata */}
                              {isTransformer && signal.metadata && (
                                <div className="pt-2 border-t border-gray-600 space-y-1">
                                  <p className="text-xs text-gray-400 font-medium">
                                    Model Details:
                                  </p>
                                  {signal.metadata.sequence_length && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">
                                        Sequence Length:
                                      </span>
                                      <span className="text-gray-300">
                                        {signal.metadata.sequence_length}
                                      </span>
                                    </div>
                                  )}
                                  {signal.metadata.prediction_horizon && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">
                                        Prediction Horizon:
                                      </span>
                                      <span className="text-gray-300">
                                        {signal.metadata.prediction_horizon}{" "}
                                        days
                                      </span>
                                    </div>
                                  )}
                                  {signal.metadata.rl_algorithm && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">
                                        RL Algorithm:
                                      </span>
                                      <span className="text-gray-300">
                                        {signal.metadata.rl_algorithm.toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  {signal.metadata.use_dummy !== undefined && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">
                                        Mode:
                                      </span>
                                      <span className="text-yellow-400">
                                        {signal.metadata.use_dummy
                                          ? "Dummy"
                                          : "Trained"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Social Media Signal - only show if enabled and has valid data */}
            {(() => {
              const socialEnabled = (execution as any).bot_config_settings
                ?.enable_social_analysis;
              const socialData = signalHistory.social_signals;
              const hasValidSocial =
                socialData &&
                socialData.action &&
                socialData.confidence !== null &&
                socialData.confidence !== undefined &&
                !isNaN(Number(socialData.confidence));

              if (socialEnabled && hasValidSocial) {
                return (
                  <div className="bg-gray-700/50 rounded p-2">
                    <p className="text-xs text-gray-400 mb-1">
                      Social Media Signal
                    </p>
                    <div className="text-xs text-gray-300">
                      {socialData.action}:{" "}
                      {(Number(socialData.confidence) * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* News Signal - only show if enabled and has valid data */}
            {(() => {
              const newsEnabled = (execution as any).bot_config_settings
                ?.enable_news_analysis;
              const newsData = signalHistory.news_signals;
              const hasValidNews =
                newsData &&
                newsData.action &&
                newsData.confidence !== null &&
                newsData.confidence !== undefined &&
                !isNaN(Number(newsData.confidence));

              if (newsEnabled && hasValidNews) {
                return (
                  <div className="bg-gray-700/50 rounded p-2">
                    <p className="text-xs text-gray-400 mb-1">News Signal</p>
                    <div className="text-xs text-gray-300">
                      {newsData.action}:{" "}
                      {(Number(newsData.confidence) * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ),
      });
    }

    // Step 9: Risk Assessment
    if (execution.risk_score !== null && execution.risk_score !== undefined) {
      const riskScore = toNumber(execution.risk_score);

      if (riskScore !== null) {
        // Get position size and price data for risk breakdown
        const executedOrder = (execution as any).executed_order;
        const positionSize = executedOrder?.quantity
          ? toNumber(executedOrder.quantity)
          : null;
        const price = executedOrder?.executed_price
          ? toNumber(executedOrder.executed_price)
          : null;
        const decisionDetails = (execution as any).decision_details || {};
        const positionScaleFactor =
          decisionDetails.position_scale_factor || 1.0;
        const riskScoreThreshold = decisionDetails.risk_score_threshold || null;

        // Calculate risk components (estimates based on formula)
        // Note: These are approximations since we don't have all component values
        // The actual calculation is: risk_score = volatility×0.30 + concentration×0.20 + drawdown×0.25 + position×0.25
        const volatilityWeight = 0.3;
        const concentrationWeight = 0.2;
        const drawdownWeight = 0.25;
        const positionWeight = 0.25;

        // Estimate components (we'll show the formula structure)
        // In reality, these would come from the backend, but we'll show the calculation method
        const volatilityPoints = riskScore * (volatilityWeight / 1.0); // Simplified estimate
        const concentrationPoints = riskScore * (concentrationWeight / 1.0);
        const drawdownPoints = riskScore * (drawdownWeight / 1.0);
        const positionPoints = riskScore * (positionWeight / 1.0);

        steps.push({
          id: "risk",
          title: "Risk Assessment",
          description: `Risk score calculated: ${riskScore.toFixed(2)}`,
          icon: <Shield className="w-5 h-5" />,
          status: "completed",
          timestamp: signalTimestamp.toISOString(),
          data: { risk_score: riskScore },
          details: (
            <div className="mt-2 space-y-3">
              {/* Overall Risk Score */}
              <div className="bg-gray-700/50 rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">
                    Overall Risk Score:
                  </span>
                  <FormulaTooltip
                    formula="risk_score = volatility_score×0.30 + concentration_score×0.20 + drawdown_score×0.25 + position_score×0.25"
                    description="Risk score is the weighted sum of four components, capped between 0-100. Higher scores indicate higher risk."
                  >
                    <span
                      className={`text-lg font-bold ${
                        riskScore > 70
                          ? "text-red-400"
                          : riskScore > 50
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {riskScore.toFixed(2)} / 100
                    </span>
                  </FormulaTooltip>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      riskScore > 70
                        ? "bg-red-500"
                        : riskScore > 50
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(100, riskScore)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400">
                  {riskScore <= 30
                    ? "Low Risk"
                    : riskScore <= 50
                    ? "Moderate Risk"
                    : riskScore <= 70
                    ? "High Risk"
                    : "Very High Risk"}
                </div>
              </div>

              {/* Risk Score Breakdown */}
              <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                <p className="text-xs font-semibold text-gray-300 mb-3">
                  Risk Score Components
                </p>
                <div className="space-y-2">
                  {/* Volatility Component */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Volatility:</span>
                      <FormulaTooltip
                        formula="volatility_points = volatility_score × 0.30"
                        description="Measures stock price volatility (0-30 points). Higher volatility = higher risk. Based on ATR or standard deviation of price movements."
                      >
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </FormulaTooltip>
                    </div>
                    <span className="text-xs text-white">
                      {volatilityPoints.toFixed(2)} / 30
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (volatilityPoints / 30) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  {/* Concentration Component */}
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        Portfolio Concentration:
                      </span>
                      <FormulaTooltip
                        formula="concentration_points = concentration_score × 0.20"
                        description="Measures how much of the portfolio is in this stock (0-20 points). Higher concentration = higher risk. Calculated as: (position_value / total_budget) × 2.0, capped at 1.0."
                      >
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </FormulaTooltip>
                    </div>
                    <span className="text-xs text-white">
                      {concentrationPoints.toFixed(2)} / 20
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-purple-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (concentrationPoints / 20) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  {/* Drawdown Component */}
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        Current Drawdown:
                      </span>
                      <FormulaTooltip
                        formula="drawdown_points = drawdown_score × 0.25"
                        description="Measures current portfolio drawdown from peak (0-25 points). Higher drawdown = higher risk. Based on peak-to-trough decline percentage."
                      >
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </FormulaTooltip>
                    </div>
                    <span className="text-xs text-white">
                      {drawdownPoints.toFixed(2)} / 25
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-orange-500"
                      style={{
                        width: `${Math.min(100, (drawdownPoints / 25) * 100)}%`,
                      }}
                    />
                  </div>

                  {/* Position Size Component */}
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        Position Size Relative to Budget:
                      </span>
                      <FormulaTooltip
                        formula="position_points = position_score × 0.25"
                        description="Measures position size relative to total budget (0-25 points). Larger positions = higher risk. Calculated as: min(1.0, (position_value / total_budget) × 5.0)."
                      >
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </FormulaTooltip>
                    </div>
                    <span className="text-xs text-white">
                      {positionPoints.toFixed(2)} / 25
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-pink-500"
                      style={{
                        width: `${Math.min(100, (positionPoints / 25) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Position Details */}
              {positionSize !== null && price !== null && (
                <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                  <p className="text-xs font-semibold text-gray-300 mb-2">
                    Position Details
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Position Size:</span>
                      <span className="text-white">
                        {positionSize.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-white">${price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Position Value:</span>
                      <span className="text-white">
                        ${(positionSize * price).toFixed(2)}
                      </span>
                    </div>
                    {positionScaleFactor < 1.0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Scale Factor:</span>
                        <FormulaTooltip
                          formula="scale_factor = 1 - (risk_score / 100) × risk_adjustment_factor"
                          description="Position size is reduced when risk score is high. Higher risk = smaller position size."
                        >
                          <span className="text-yellow-400">
                            {(positionScaleFactor * 100).toFixed(1)}% (Reduced)
                          </span>
                        </FormulaTooltip>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Risk Threshold */}
              {riskScoreThreshold !== null && (
                <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      Risk Score Threshold:
                    </span>
                    <FormulaTooltip
                      formula="If risk_score > risk_score_threshold, decision may be modified or position scaled down."
                      description="When risk score exceeds this threshold, the bot may override the decision or reduce position size to manage risk."
                    >
                      <span
                        className={`text-sm font-medium ${
                          riskScore > riskScoreThreshold
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {riskScoreThreshold.toFixed(2)}
                        {riskScore > riskScoreThreshold && (
                          <span className="ml-1 text-xs">⚠️ Exceeded</span>
                        )}
                      </span>
                    </FormulaTooltip>
                  </div>
                </div>
              )}

              {/* Risk Impact */}
              <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                <p className="text-xs font-semibold text-gray-300 mb-2">
                  Risk Impact on Decision
                </p>
                <div className="space-y-1 text-xs text-gray-400">
                  {riskScore > 70 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Very high risk detected. Position size may be
                        significantly reduced or trade may be skipped.
                      </span>
                    </div>
                  )}
                  {riskScore > 50 && riskScore <= 70 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <span>
                        High risk detected. Position size may be reduced to
                        manage risk.
                      </span>
                    </div>
                  )}
                  {riskScore <= 50 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>
                        Risk level acceptable. Position size calculated based on
                        risk per trade and stop loss settings.
                      </span>
                    </div>
                  )}
                  {decisionDetails.risk_override && (
                    <div className="flex items-start gap-2 mt-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <span className="text-yellow-400">
                        Risk override applied: Decision was modified due to risk
                        score exceeding threshold.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
        });
      }
    }

    // Step 9.5: Signal Persistence (if applicable)
    if (
      execution.persistence_met !== null ||
      execution.persistence_count !== null ||
      (execution.persistence_signal_history &&
        execution.persistence_signal_history.length > 0)
    ) {
      const persistenceMet = execution.persistence_met;
      const persistenceCount = execution.persistence_count;
      const persistenceHistory = execution.persistence_signal_history || [];

      steps.push({
        id: "persistence",
        title: "Signal Persistence",
        description: persistenceMet
          ? `Persistence criteria met (${persistenceCount} ticks/minutes)`
          : `Persistence criteria not met (${
              persistenceCount || 0
            } ticks/minutes)`,
        icon: <Activity className="w-5 h-5" />,
        status: persistenceMet ? "completed" : "pending",
        timestamp: signalTimestamp.toISOString(),
        data: {
          persistence_met: persistenceMet,
          persistence_count: persistenceCount,
          persistence_history: persistenceHistory,
        },
        details: (
          <div className="mt-2 space-y-3">
            <div className="bg-gray-700/50 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">
                  Persistence Status
                </span>
                <span
                  className={`text-sm font-semibold ${
                    persistenceMet ? "text-green-400" : "text-yellow-400"
                  }`}
                >
                  {persistenceMet ? "✓ Met" : "⏳ Not Met"}
                </span>
              </div>
              {persistenceCount !== null && (
                <div className="text-xs text-gray-400 mt-1">
                  Count: {persistenceCount} ticks/minutes
                </div>
              )}
            </div>

            {persistenceHistory.length > 0 && (
              <div className="bg-gray-700/50 rounded p-3">
                <p className="text-sm font-medium text-gray-300 mb-2">
                  Signal History ({persistenceHistory.length} entries)
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {persistenceHistory
                    .slice(-10)
                    .map((entry: any, idx: number) => (
                      <div
                        key={idx}
                        className="text-xs text-gray-400 flex justify-between items-center py-1 border-b border-gray-600/50"
                      >
                        <span className="capitalize">
                          {entry.action || "hold"}
                        </span>
                        <span className="text-gray-500">
                          {entry.timestamp
                            ? new Date(entry.timestamp).toLocaleTimeString()
                            : `Tick ${
                                entry.tick_number || entry.counter || idx + 1
                              }`}
                        </span>
                      </div>
                    ))}
                  {persistenceHistory.length > 10 && (
                    <div className="text-xs text-gray-500 text-center pt-1">
                      ... and {persistenceHistory.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ),
      });
    }

    // Step 10: Final Decision
    // All values come from backend aggregated_signal (stored in signal_history)
    const aggregatedSignal = signalHistory?.aggregated_signal || {};
    const finalConfidence =
      toNumber(aggregatedSignal.confidence) ||
      toNumber(signalHistory?.decision_confidence) ||
      0;
    // Action scores are normalized and come directly from backend
    const actionScores = aggregatedSignal.action_scores || {};
    const buyScore = toNumber(actionScores.buy) || 0;
    const sellScore = toNumber(actionScores.sell) || 0;
    const holdScore = toNumber(actionScores.hold) || 0;
    const maxScore = Math.max(buyScore, sellScore, holdScore);
    // Risk-related values from backend aggregated_signal
    const riskOverride = aggregatedSignal.risk_override || false;
    const positionScaleFactor = aggregatedSignal.position_scale_factor || 1.0;
    const riskScore =
      toNumber(execution.risk_score) ||
      toNumber(signalHistory?.risk_score) ||
      null;
    // Bot config settings (passed via execution)
    const botConfigSettings = (execution as any).bot_config_settings || {};
    const riskScoreThreshold = botConfigSettings.risk_score_threshold || null;
    const riskBasedScaling =
      botConfigSettings.risk_based_position_scaling !== undefined
        ? botConfigSettings.risk_based_position_scaling
        : true; // Default to true if not specified
    // Decision details metadata from aggregated_signal (backend values)
    const aggregationMethod = aggregatedSignal.aggregation_method || "unknown";
    const signalsUsed = aggregatedSignal.signals_used || 0;

    steps.push({
      id: "decision",
      title: "Final Decision",
      description: `Decision: ${execution.action.toUpperCase()}`,
      icon: getActionIcon(execution.action),
      status: execution.action === "skip" ? "pending" : "completed",
      timestamp: executionTimestamp.toISOString(),
      details: (
        <div className="mt-2 space-y-3">
          {/* Action */}
          <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400">Final Action:</span>
              <span
                className={`text-lg font-bold px-4 py-2 rounded inline-block ${getActionColor(
                  execution.action
                )}`}
              >
                {execution.action.toUpperCase()}
              </span>
            </div>
            {riskOverride && (
              <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-400">
                    <p className="font-semibold mb-1">Risk Override Applied</p>
                    <p>
                      Decision was modified due to risk score exceeding
                      threshold. Original signals were overridden for risk
                      management.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confidence Level */}
          <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400">
                Decision Confidence:
              </span>
              <FormulaTooltip
                formula="confidence = max(buy_score, sell_score, hold_score) after normalization and risk adjustment"
                description="Final confidence in the decision, after all signals are aggregated, normalized, and risk-adjusted. Higher confidence = stronger signal."
              >
                <span
                  className={`text-lg font-bold ${
                    finalConfidence > 0.7
                      ? "text-green-400"
                      : finalConfidence > 0.4
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {(finalConfidence * 100).toFixed(1)}%
                </span>
              </FormulaTooltip>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  finalConfidence > 0.7
                    ? "bg-green-500"
                    : finalConfidence > 0.4
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, finalConfidence * 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {finalConfidence > 0.7
                ? "High Confidence"
                : finalConfidence > 0.4
                ? "Moderate Confidence"
                : "Low Confidence"}
            </div>
          </div>

          {/* Action Scores Breakdown */}
          {maxScore > 0 && (
            <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
              <p className="text-xs font-semibold text-gray-300 mb-3">
                Action Scores (Normalized)
              </p>
              <p className="text-xs text-gray-500 mb-2">
                Scores are normalized and sum to 1.0. Values come directly from
                backend aggregation.
              </p>
              <div className="space-y-2">
                {/* Buy Score */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Buy Score:</span>
                      <FormulaTooltip
                        formula="buy_score = Σ(indicator_buy × weight) + Σ(pattern_buy × weight) + Σ(ml_buy × weight) + social_buy × weight + news_buy × weight"
                        description="Sum of all buy signals weighted by their importance. Higher score = stronger buy signal."
                      >
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </FormulaTooltip>
                    </div>
                    <span className="text-xs text-white font-medium">
                      {buyScore.toFixed(4)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-green-500"
                      style={{
                        width: `${Math.min(100, (buyScore / maxScore) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Sell Score */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Sell Score:</span>
                      <FormulaTooltip
                        formula="sell_score = Σ(indicator_sell × weight) + Σ(pattern_sell × weight) + Σ(ml_sell × weight) + social_sell × weight + news_sell × weight"
                        description="Sum of all sell signals weighted by their importance. Higher score = stronger sell signal."
                      >
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </FormulaTooltip>
                    </div>
                    <span className="text-xs text-white font-medium">
                      {sellScore.toFixed(4)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-red-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (sellScore / maxScore) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Hold Score */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Hold Score:</span>
                      <FormulaTooltip
                        formula="hold_score = Σ(indicator_hold × weight) + Σ(pattern_hold × weight) + Σ(ml_hold × weight) + social_hold × weight + news_hold × weight"
                        description="Sum of all hold signals weighted by their importance. Higher score = stronger hold signal."
                      >
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </FormulaTooltip>
                    </div>
                    <span className="text-xs text-white font-medium">
                      {holdScore.toFixed(4)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gray-400"
                      style={{
                        width: `${Math.min(
                          100,
                          (holdScore / maxScore) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Selected Action: {execution.action.toUpperCase()} (Score:{" "}
                {execution.action === "buy"
                  ? buyScore.toFixed(4)
                  : execution.action === "sell"
                  ? sellScore.toFixed(4)
                  : holdScore.toFixed(4)}
                )
              </div>
            </div>
          )}

          {/* Risk Impact on Decision */}
          {riskScore !== null && (
            <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
              <p className="text-xs font-semibold text-gray-300 mb-2">
                Risk Impact on Decision
              </p>
              <div className="space-y-2 text-xs">
                {riskScoreThreshold !== null &&
                  riskScore > riskScoreThreshold && (
                    <div className="flex items-start gap-2 p-2 bg-red-900/30 border border-red-500/50 rounded">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-red-400 font-semibold mb-1">
                          Risk Threshold Exceeded
                        </p>
                        <p className="text-gray-300">
                          Risk score ({riskScore.toFixed(2)}) exceeds threshold
                          ({riskScoreThreshold.toFixed(2)}).
                          {riskOverride
                            ? " Decision overridden to SKIP/HOLD for risk management."
                            : " Position may be scaled down or decision modified."}
                        </p>
                      </div>
                    </div>
                  )}
                {riskBasedScaling && positionScaleFactor < 1.0 && (
                  <div className="flex items-start gap-2 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-400 font-semibold mb-1">
                        Position Scaled Down
                      </p>
                      <p className="text-gray-300">
                        Risk-based position scaling is enabled. Position size
                        reduced to {(positionScaleFactor * 100).toFixed(1)}% of
                        calculated size due to risk score of{" "}
                        {riskScore?.toFixed(2)}.
                      </p>
                      <FormulaTooltip
                        formula="scale_factor = 1 - (risk_score / 100) × risk_adjustment_factor"
                        description="Position size is automatically reduced when risk score is high. This protects capital while still allowing trades."
                      >
                        <span className="text-xs text-blue-400 mt-1 inline-block cursor-help">
                          Learn more about risk-based position scaling
                        </span>
                      </FormulaTooltip>
                    </div>
                  </div>
                )}
                {riskScore !== null &&
                  riskScore <= (riskScoreThreshold || 50) &&
                  !riskOverride && (
                    <div className="flex items-start gap-2 p-2 bg-green-900/30 border border-green-500/50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-green-400 font-semibold mb-1">
                          Risk Level Acceptable
                        </p>
                        <p className="text-gray-300">
                          Risk score ({riskScore.toFixed(2)}) is within
                          acceptable limits.
                          {riskBasedScaling
                            ? " Position size calculated normally with risk-based scaling applied."
                            : " Position size calculated based on risk per trade and stop loss settings."}
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Decision Factors */}
          <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
            <p className="text-xs font-semibold text-gray-300 mb-2">
              Decision Factors
            </p>
            <div className="space-y-1 text-xs text-gray-400">
              {aggregationMethod && aggregationMethod !== "unknown" && (
                <div className="flex justify-between">
                  <span>Aggregation Method:</span>
                  <span className="text-white">
                    {aggregationMethod.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              )}
              {signalsUsed !== undefined && signalsUsed > 0 && (
                <div className="flex justify-between">
                  <span>Signals Used:</span>
                  <span className="text-white">
                    {signalsUsed} signal{signalsUsed !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {riskScore !== null && (
                <div className="flex justify-between">
                  <span>Risk Score:</span>
                  <span className="text-white">{riskScore.toFixed(2)}</span>
                </div>
              )}
              {riskScoreThreshold !== null && (
                <div className="flex justify-between">
                  <span>Risk Threshold:</span>
                  <span className="text-white">
                    {riskScoreThreshold.toFixed(2)}
                  </span>
                </div>
              )}
              {riskBasedScaling && (
                <div className="flex justify-between">
                  <span>Risk-Based Scaling:</span>
                  <span className="text-green-400">Enabled</span>
                </div>
              )}
              {!riskBasedScaling && (
                <div className="flex justify-between">
                  <span>Risk-Based Scaling:</span>
                  <span className="text-gray-500">Disabled</span>
                </div>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
            <p className="text-xs font-semibold text-gray-300 mb-2">Reason</p>
            <p className="text-sm text-white leading-relaxed">
              {execution.reason}
            </p>
          </div>
        </div>
      ),
    });

    // Step 11: Order Execution (if applicable)
    if (execution.executed_order) {
      const orderTimestamp = execution.executed_order.executed_at
        ? new Date(execution.executed_order.executed_at)
        : execution.executed_order.created_at
        ? new Date(execution.executed_order.created_at)
        : executionTimestamp;

      steps.push({
        id: "order",
        title: "Order Executed",
        description: `Order ${execution.executed_order.status}`,
        icon: <CheckCircle className="w-5 h-5 text-green-400" />,
        status:
          execution.executed_order.status === "done" ? "completed" : "pending",
        timestamp: orderTimestamp.toISOString(),
        details: (
          <div className="mt-2 space-y-2">
            <div className="bg-gray-700/50 rounded p-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Quantity:</span>
                  <p className="text-white">
                    {execution.executed_order.quantity}
                  </p>
                </div>
                {execution.executed_order.executed_price && (
                  <div>
                    <span className="text-gray-400">Price:</span>
                    <p className="text-white">
                      {formatPrice(execution.executed_order.executed_price)}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Type:</span>
                  <p className="text-white capitalize">
                    {execution.executed_order.transaction_type}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <p className="text-green-400 capitalize">
                    {execution.executed_order.status}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ),
      });
    }

    return steps;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-gray-400">Execution not found</p>
        </div>
      </div>
    );
  }

  const timeline = buildTimeline();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => {
              // If opened in new tab (window.opener exists) or no history, go to bots page
              // Otherwise go back in history
              if (window.opener || window.history.length <= 1) {
                navigate("/trading-bots");
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Execution Details
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{execution.bot_config_name}</span>
                <span>•</span>
                <span>{execution.stock_symbol}</span>
                <span>•</span>
                <span>{formatDate(execution.timestamp)}</span>
              </div>
            </div>
            <div
              className={`px-4 py-2 rounded-lg border ${getActionColor(
                execution.action
              )}`}
            >
              <div className="flex items-center gap-2">
                {getActionIcon(execution.action)}
                <span className="font-semibold">
                  {execution.action.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === "timeline"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab("signals")}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === "signals"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              All Signals
            </button>
          </div>
        </div>

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6" />
              Execution Timeline
            </h2>

            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-700"></div>

              {/* Timeline Steps */}
              <div className="space-y-8">
                {timeline.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative flex gap-4"
                  >
                    {/* Timeline Dot */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                          step.status === "completed"
                            ? "bg-green-500/20 border-green-500 text-green-400"
                            : step.status === "error"
                            ? "bg-red-500/20 border-red-500 text-red-400"
                            : "bg-gray-500/20 border-gray-500 text-gray-400"
                        }`}
                      >
                        {step.icon}
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 bg-gray-700/50 rounded-lg border border-gray-600 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-white">
                              {step.title}
                            </h3>
                            {step.timestamp && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span className="font-mono">
                                  {formatDate(step.timestamp)}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {step.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          {step.status === "completed" && (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          )}
                          {step.status === "error" && (
                            <X className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                      </div>
                      {step.details && (
                        <div className="mt-3 border-t border-gray-600 pt-3">
                          {step.details}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Signals Tab */}
        {activeTab === "signals" && execution && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <GitMerge className="w-6 h-6" />
              All Signal Histories
            </h2>
            <BotSignalHistoryTab botId={execution.bot_config} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BotExecutionDetail;
