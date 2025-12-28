import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, BarChart3, Activity } from "lucide-react";
import type { StockPrice, IntradayPrice, StockTick } from "../../lib/api";
import { format, parseISO } from "date-fns";
import * as indicators from "../../utils/technicalIndicators";
import {
  AVAILABLE_INDICATORS,
  AVAILABLE_CHART_PATTERNS,
} from "../../utils/indicatorsConfig";
import type { PriceData } from "../../utils/technicalIndicators";
import {
  detectAllPatterns,
  type PatternMatch,
} from "../../utils/chartPatterns";

interface ProcessedDataPoint {
  time: string;
  fullTime: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change?: number;
  changePercent?: number;
  index: number;
  // Indicator values
  sma?: number | null;
  ema?: number | null;
  wma?: number | null;
  dema?: number | null;
  tema?: number | null;
  tma?: number | null;
  hma?: number | null;
  bb_upper?: number | null;
  bb_middle?: number | null;
  bb_lower?: number | null;
  psar?: number | null;
  supertrend?: number | null;
  alligator_jaw?: number | null;
  alligator_teeth?: number | null;
  alligator_lips?: number | null;
  ichimoku_tenkan?: number | null;
  ichimoku_kijun?: number | null;
  ichimoku_senkouA?: number | null;
  ichimoku_senkouB?: number | null;
  ichimoku_chikou?: number | null;
  atr_trailing?: number | null;
  donchian_upper?: number | null;
  donchian_middle?: number | null;
  donchian_lower?: number | null;
  fractal_upper?: number | null;
  fractal_lower?: number | null;
  linear_regression?: number | null;
  mcginley?: number | null;
  vwap?: number | null;
  vwap_ma?: number | null;
  keltner_upper?: number | null;
  keltner_middle?: number | null;
  keltner_lower?: number | null;
  // New indicators
  rsi?: number | null;
  adx?: number | null;
  cci?: number | null;
  mfi?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_histogram?: number | null;
  williams_r?: number | null;
  momentum?: number | null;
  proc?: number | null;
  obv?: number | null;
  bollinger_upper?: number | null;
  bollinger_middle?: number | null;
  bollinger_lower?: number | null;
  prev_n?: number | null;
  nth_candle?: number | null;
  opening_range_high?: number | null;
  opening_range_low?: number | null;
  number?: number | null;
  signal_candle?: number | null;
  trade_candle?: number | null;
  candle_time?: number | null;
  // Pattern matches at this index
  patterns?: PatternMatch[];
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ProcessedDataPoint;
  }>;
  label?: string;
  selectedIndicators?: string[];
  selectedPatterns?: string[];
}

interface StockChartProps {
  data: (StockPrice | IntradayPrice | StockTick)[];
  symbol: string;
  interval: string;
  period?: string;
  isLoading?: boolean;
  height?: number;
  showVolume?: boolean;
  chartType?: "line" | "area";
  selectedIndicators?: string[];
  selectedPatterns?: string[];
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

const formatVolume = (volume: number) => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toString();
};

const formatPercentage = (percent: number | string | null | undefined) => {
  const numPercent =
    typeof percent === "number" ? percent : parseFloat(percent || "0");
  return numPercent.toFixed(2);
};

const CustomTooltip: React.FC<TooltipProps> = ({
  active,
  payload,
  label,
  selectedIndicators = [],
  selectedPatterns = [],
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    // Format date with year from fullTime, data timestamp, or label
    let formattedDate = label;

    // Try to get the original timestamp from the data
    const timestamp = data.fullTime;

    if (timestamp) {
      try {
        const date = parseISO(timestamp);
        // Format with year: "MMM dd, yyyy" for dates, or "MMM dd, yyyy HH:mm" for times
        if (timestamp.includes("T") || timestamp.includes(" ")) {
          // Has time component
          formattedDate = format(date, "MMM dd, yyyy HH:mm");
        } else {
          // Date only
          formattedDate = format(date, "MMM dd, yyyy");
        }
      } catch {
        // If parsing fails, check if label already has year
        const hasYear = label && (label.includes(",") || /\d{4}/.test(label));
        if (!hasYear && label) {
          // Label doesn't have year, but we can't parse timestamp
          // Use label as fallback
          formattedDate = label;
        }
      }
    } else if (label) {
      // Check if label already has year
      const hasYear = label.includes(",") || /\d{4}/.test(label);
      if (!hasYear) {
        // Label doesn't have year, use as-is (shouldn't happen if data processing is correct)
        formattedDate = label;
      }
    }

    return (
      <div className="bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-lg p-3 shadow-xl">
        <p className="text-white/60 text-sm mb-2">{formattedDate}</p>
        <div className="space-y-1">
          <div className="flex justify-between space-x-4">
            <span className="text-white/80">Price:</span>
            <span className="text-white font-medium">
              {formatPrice(data.price)}
            </span>
          </div>
          {data.change !== undefined && (
            <div className="flex justify-between space-x-4">
              <span className="text-white/80">Change:</span>
              <span
                className={`font-medium ${
                  data.change >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {data.change >= 0 ? "+" : ""}
                {formatPrice(data.change)} (
                {formatPercentage(data.changePercent)}%)
              </span>
            </div>
          )}
          <div className="flex justify-between space-x-4">
            <span className="text-white/80">Volume:</span>
            <span className="text-white font-medium">
              {formatVolume(data.volume)}
            </span>
          </div>
          {data.high !== undefined && (
            <>
              <div className="flex justify-between space-x-4">
                <span className="text-white/80">High:</span>
                <span className="text-white font-medium">
                  {formatPrice(data.high)}
                </span>
              </div>
              <div className="flex justify-between space-x-4">
                <span className="text-white/80">Low:</span>
                <span className="text-white font-medium">
                  {formatPrice(data.low)}
                </span>
              </div>
            </>
          )}
          {/* Indicator values */}
          {selectedIndicators.length > 0 && (
            <>
              <div className="border-t border-white/10 my-2"></div>
              {selectedIndicators.map((indicatorId) => {
                const indicator = AVAILABLE_INDICATORS.find(
                  (ind) => ind.id === indicatorId
                );
                if (!indicator) return null;

                // Handle single value indicators
                const singleValueFields: Record<
                  string,
                  keyof ProcessedDataPoint
                > = {
                  sma: "sma",
                  ema: "ema",
                  wma: "wma",
                  dema: "dema",
                  tema: "tema",
                  tma: "tma",
                  hma: "hma",
                  psar: "psar",
                  supertrend: "supertrend",
                  atr_trailing: "atr_trailing",
                  linear_regression: "linear_regression",
                  mcginley: "mcginley",
                  vwap: "vwap",
                  vwap_ma: "vwap_ma",
                  rsi: "rsi",
                  adx: "adx",
                  cci: "cci",
                  mfi: "mfi",
                  williams_r: "williams_r",
                  momentum: "momentum",
                  proc: "proc",
                  obv: "obv",
                  prev_n: "prev_n",
                  nth_candle: "nth_candle",
                  number: "number",
                  signal_candle: "signal_candle",
                  trade_candle: "trade_candle",
                  candle_time: "candle_time",
                };

                // Indicators that should be formatted as percentages
                const percentageIndicators = [
                  "rsi",
                  "adx",
                  "mfi",
                  "williams_r",
                  "proc",
                ];

                // Indicators that should be formatted as numbers (not currency)
                const numberIndicators = [
                  "cci",
                  "momentum",
                  "obv",
                  "candle_time",
                ];

                // Handle band indicators (upper, middle, lower)
                const bandIndicators: Record<
                  string,
                  {
                    upper: keyof ProcessedDataPoint;
                    middle?: keyof ProcessedDataPoint;
                    lower: keyof ProcessedDataPoint;
                  }
                > = {
                  bollinger: {
                    upper: "bb_upper",
                    middle: "bb_middle",
                    lower: "bb_lower",
                  },
                  bollinger_upper: {
                    upper: "bollinger_upper",
                    lower: "bollinger_upper",
                  },
                  bollinger_middle: {
                    upper: "bollinger_middle",
                    middle: "bollinger_middle",
                    lower: "bollinger_middle",
                  },
                  bollinger_lower: {
                    upper: "bollinger_lower",
                    lower: "bollinger_lower",
                  },
                  donchian: {
                    upper: "donchian_upper",
                    middle: "donchian_middle",
                    lower: "donchian_lower",
                  },
                  keltner: {
                    upper: "keltner_upper",
                    middle: "keltner_middle",
                    lower: "keltner_lower",
                  },
                  fractal: {
                    upper: "fractal_upper",
                    lower: "fractal_lower",
                  },
                  opening_range: {
                    upper: "opening_range_high",
                    lower: "opening_range_low",
                  },
                };

                // Handle special indicators
                if (indicatorId === "alligator") {
                  const jaw = data.alligator_jaw;
                  const teeth = data.alligator_teeth;
                  const lips = data.alligator_lips;
                  if (jaw == null && teeth == null && lips == null) return null;
                  return (
                    <div key={indicatorId} className="space-y-1">
                      <div className="text-white/60 text-xs font-semibold mb-1">
                        {indicator.name}:
                      </div>
                      {jaw != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Jaw:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(jaw)}
                          </span>
                        </div>
                      )}
                      {teeth != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Teeth:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(teeth)}
                          </span>
                        </div>
                      )}
                      {lips != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Lips:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(lips)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                if (indicatorId === "macd") {
                  const macd = data.macd;
                  const signal = data.macd_signal;
                  const histogram = data.macd_histogram;
                  if (macd == null && signal == null && histogram == null)
                    return null;
                  return (
                    <div key={indicatorId} className="space-y-1">
                      <div className="text-white/60 text-xs font-semibold mb-1">
                        {indicator.name}:
                      </div>
                      {macd != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">MACD:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {macd.toFixed(4)}
                          </span>
                        </div>
                      )}
                      {signal != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Signal:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {signal.toFixed(4)}
                          </span>
                        </div>
                      )}
                      {histogram != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">
                            Histogram:
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              histogram >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {histogram.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                if (indicatorId === "ichimoku") {
                  const tenkan = data.ichimoku_tenkan;
                  const kijun = data.ichimoku_kijun;
                  const senkouA = data.ichimoku_senkouA;
                  const senkouB = data.ichimoku_senkouB;
                  const chikou = data.ichimoku_chikou;
                  if (
                    tenkan == null &&
                    kijun == null &&
                    senkouA == null &&
                    senkouB == null &&
                    chikou == null
                  )
                    return null;
                  return (
                    <div key={indicatorId} className="space-y-1">
                      <div className="text-white/60 text-xs font-semibold mb-1">
                        {indicator.name}:
                      </div>
                      {tenkan != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Tenkan:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(tenkan)}
                          </span>
                        </div>
                      )}
                      {kijun != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Kijun:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(kijun)}
                          </span>
                        </div>
                      )}
                      {senkouA != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">
                            Senkou A:
                          </span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(senkouA)}
                          </span>
                        </div>
                      )}
                      {senkouB != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">
                            Senkou B:
                          </span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(senkouB)}
                          </span>
                        </div>
                      )}
                      {chikou != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Chikou:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(chikou)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                // Handle band indicators
                if (bandIndicators[indicatorId]) {
                  const bands = bandIndicators[indicatorId];
                  const upper = data[bands.upper];
                  const middle = data[bands.middle!];
                  const lower = data[bands.lower];
                  if (upper == null && middle == null && lower == null)
                    return null;
                  return (
                    <div key={indicatorId} className="space-y-1">
                      <div className="text-white/60 text-xs font-semibold mb-1">
                        {indicator.name}:
                      </div>
                      {upper != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Upper:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(upper as number)}
                          </span>
                        </div>
                      )}
                      {middle != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Middle:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(middle as number)}
                          </span>
                        </div>
                      )}
                      {lower != null && (
                        <div className="flex justify-between space-x-4 ml-2">
                          <span className="text-white/70 text-xs">Lower:</span>
                          <span
                            className="text-white text-xs font-medium"
                            style={{ color: indicator.color }}
                          >
                            {formatPrice(lower as number)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                // Handle single value indicators
                if (singleValueFields[indicatorId]) {
                  const value = data[singleValueFields[indicatorId]];
                  if (value == null) return null;
                  return (
                    <div
                      key={indicatorId}
                      className="flex justify-between space-x-4"
                    >
                      <span
                        className="text-white/80 text-xs"
                        style={{ color: indicator.color }}
                      >
                        {indicator.name}:
                      </span>
                      <span
                        className="text-white text-xs font-medium"
                        style={{ color: indicator.color }}
                      >
                        {(() => {
                          if (percentageIndicators.includes(indicatorId)) {
                            return `${formatPercentage(value as number)}%`;
                          } else if (numberIndicators.includes(indicatorId)) {
                            return (value as number).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            });
                          } else {
                            return formatPrice(value as number);
                          }
                        })()}
                      </span>
                    </div>
                  );
                }

                return null;
              })}
            </>
          )}
          {/* Pattern matches */}
          {selectedPatterns.length > 0 &&
            data.patterns &&
            data.patterns.length > 0 && (
              <>
                <div className="border-t border-white/10 my-2"></div>
                <div className="text-white/60 text-xs font-semibold mb-1">
                  Chart Patterns:
                </div>
                {data.patterns.map((pattern: PatternMatch, idx: number) => {
                  const patternConfig = AVAILABLE_CHART_PATTERNS.find(
                    (p) => p.id === pattern.pattern
                  );
                  if (!patternConfig) return null;
                  return (
                    <div
                      key={`pattern-${pattern.pattern}-${idx}`}
                      className="space-y-1 mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: patternConfig.color || "#3B82F6",
                          }}
                        />
                        <span className="text-white/80 text-xs font-medium">
                          {pattern.patternName}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            pattern.signal === "bullish"
                              ? "bg-green-500/20 text-green-400"
                              : pattern.signal === "bearish"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {pattern.signal}
                        </span>
                      </div>
                      <p className="text-white/60 text-xs ml-4 line-clamp-2">
                        {pattern.description}
                      </p>
                      <div className="flex items-center gap-3 ml-4 text-xs text-white/50">
                        <span>
                          Confidence: {Math.round(pattern.confidence * 100)}%
                        </span>
                        <span>•</span>
                        <span>{pattern.candles} candles</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
        </div>
      </div>
    );
  }
  return null;
};

const StockChart: React.FC<StockChartProps> = ({
  data,
  symbol,
  interval,
  period = "1D",
  isLoading = false,
  height = 400,
  showVolume = false, // Reserved for future volume chart implementation
  chartType = "area",
  selectedIndicators = [],
  selectedPatterns = [],
}) => {
  // Prevent unused variable warnings
  void showVolume;
  void interval;
  const [priceChange, setPriceChange] = useState<{
    absolute: number;
    percentage: number;
    isPositive: boolean;
  } | null>(null);

  const processedData = useMemo(() => {
    if (data.length === 0) return [];

    // Sort data by timestamp/date
    const sortedData = [...data].sort((a, b) => {
      const timeA = "timestamp" in a ? a.timestamp : a.date;
      const timeB = "timestamp" in b ? b.timestamp : b.date;
      if (!timeA || !timeB) return 0;
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });

    // Filter data for MAX period: show only 1st, 15th, and last day of each month
    let dataToProcess = sortedData;
    if (period === "MAX") {
      // Group data by year-month
      const dataByMonth = new Map<string, typeof sortedData>();

      sortedData.forEach((item) => {
        const timestamp = "timestamp" in item ? item.timestamp : item.date;
        if (!timestamp) return;

        const date = parseISO(timestamp);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

        if (!dataByMonth.has(monthKey)) {
          dataByMonth.set(monthKey, []);
        }
        dataByMonth.get(monthKey)!.push(item);
      });

      // For each month, keep only 1st, 15th, and last day
      const filteredData: typeof sortedData = [];
      const addedItems = new Set<string>(); // Track added items to prevent duplicates

      dataByMonth.forEach((monthData) => {
        // Sort month data by date
        monthData.sort((a, b) => {
          const timeA = "timestamp" in a ? a.timestamp : a.date;
          const timeB = "timestamp" in b ? b.timestamp : b.date;
          if (!timeA || !timeB) return 0;
          return new Date(timeA).getTime() - new Date(timeB).getTime();
        });

        // Helper to get item key for deduplication
        const getItemKey = (item: (typeof sortedData)[0]): string => {
          const timestamp = "timestamp" in item ? item.timestamp : item.date;
          return timestamp || "";
        };

        // Get 1st day
        if (monthData.length > 0) {
          const firstItem = monthData[0];
          const firstTimestamp =
            "timestamp" in firstItem ? firstItem.timestamp : firstItem.date;
          if (firstTimestamp) {
            const firstDate = parseISO(firstTimestamp);
            const itemKey = getItemKey(firstItem);
            if (!addedItems.has(itemKey)) {
              if (firstDate.getDate() === 1) {
                filteredData.push(firstItem);
                addedItems.add(itemKey);
              } else {
                // If no exact 1st, use the earliest available
                filteredData.push(firstItem);
                addedItems.add(itemKey);
              }
            }
          }
        }

        // Get 15th day (closest to 15th)
        const fifteenthItem = monthData.find((item) => {
          const itemTimestamp =
            "timestamp" in item ? item.timestamp : item.date;
          if (!itemTimestamp) return false;
          const itemDate = parseISO(itemTimestamp);
          return itemDate.getDate() === 15;
        });
        if (fifteenthItem) {
          const itemKey = getItemKey(fifteenthItem);
          if (!addedItems.has(itemKey)) {
            filteredData.push(fifteenthItem);
            addedItems.add(itemKey);
          }
        } else {
          // Find closest to 15th
          const closestTo15 = monthData.reduce((closest, item) => {
            const itemTimestamp =
              "timestamp" in item ? item.timestamp : item.date;
            const closestTimestamp =
              "timestamp" in closest ? closest.timestamp : closest.date;
            if (!itemTimestamp || !closestTimestamp) return closest;

            const itemDate = parseISO(itemTimestamp);
            const closestDate = parseISO(closestTimestamp);
            const itemDiff = Math.abs(itemDate.getDate() - 15);
            const closestDiff = Math.abs(closestDate.getDate() - 15);
            return itemDiff < closestDiff ? item : closest;
          });
          if (closestTo15 && monthData.indexOf(closestTo15) !== 0) {
            const itemKey = getItemKey(closestTo15);
            if (!addedItems.has(itemKey)) {
              filteredData.push(closestTo15);
              addedItems.add(itemKey);
            }
          }
        }

        // Get last day
        if (monthData.length > 0) {
          const lastItem = monthData[monthData.length - 1];
          const lastTimestamp =
            "timestamp" in lastItem ? lastItem.timestamp : lastItem.date;
          if (lastTimestamp) {
            const lastDate = parseISO(lastTimestamp);
            // Check if it's the last day of the month
            const nextDay = new Date(lastDate);
            nextDay.setDate(nextDay.getDate() + 1);
            if (
              nextDay.getMonth() !== lastDate.getMonth() ||
              lastDate.getDate() >= 28
            ) {
              const itemKey = getItemKey(lastItem);
              if (!addedItems.has(itemKey)) {
                filteredData.push(lastItem);
                addedItems.add(itemKey);
              }
            }
          }
        }
      });

      // Sort filtered data again
      dataToProcess = filteredData.sort((a, b) => {
        const timeA = "timestamp" in a ? a.timestamp : a.date;
        const timeB = "timestamp" in b ? b.timestamp : b.date;
        if (!timeA || !timeB) return 0;
        return new Date(timeA).getTime() - new Date(timeB).getTime();
      });
    }

    // Process data for chart
    const processed = dataToProcess.map((item, index) => {
      const timestamp = "timestamp" in item ? item.timestamp : item.date;
      let formattedTime: string;

      // Format time based on period and interval
      if (!timestamp) {
        formattedTime = "Unknown";
      } else {
        const date = parseISO(timestamp);

        // For 1D period, show date and time (with seconds for tick data)
        if (period === "1D") {
          // Check if this is tick data (has 'price' field instead of 'close_price')
          const isTickData = "price" in item && !("close_price" in item);
          // Show date and time with year: "MMM dd, yyyy HH:mm:ss" or "MMM dd, yyyy HH:mm"
          formattedTime = isTickData
            ? format(date, "MMM dd, yyyy HH:mm:ss")
            : format(date, "MMM dd, yyyy HH:mm");
        }
        // For periods up to 1 month, show date with year
        else if (["5D", "1M"].includes(period)) {
          formattedTime = format(date, "MMM dd, yyyy");
        }
        // For longer periods, show month/day with year
        else if (["6M", "YTD", "1Y"].includes(period)) {
          formattedTime = format(date, "MMM dd, yyyy");
        }
        // For very long periods, show month/year (already has year)
        else if (["5Y", "10Y"].includes(period)) {
          formattedTime = format(date, "MMM yyyy");
        }
        // Default format with year
        else {
          formattedTime = format(date, "MMM dd, yyyy");
        }
      }

      // Handle different data types: StockTick vs StockPrice/IntradayPrice
      const isTickData = "price" in item && !("close_price" in item);

      if (isTickData) {
        // StockTick data
        const tickItem = item as StockTick;
        return {
          time: formattedTime,
          fullTime: timestamp || "",
          price: tickItem.price,
          open: tickItem.price, // Use price as open for ticks
          high: tickItem.price, // Use price as high for ticks
          low: tickItem.price, // Use price as low for ticks
          close: tickItem.price, // Use price as close for ticks
          volume: tickItem.volume,
          change: undefined, // Ticks don't have price_change
          changePercent: undefined, // Ticks don't have price_change_percent
          index,
        };
      } else {
        // StockPrice or IntradayPrice data
        const priceItem = item as StockPrice | IntradayPrice;
        return {
          time: formattedTime,
          fullTime: timestamp || "",
          price: priceItem.close_price,
          open: priceItem.open_price,
          high: priceItem.high_price,
          low: priceItem.low_price,
          close: priceItem.close_price,
          volume: priceItem.volume,
          change: priceItem.price_change,
          changePercent: priceItem.price_change_percent,
          index,
        };
      }
    });

    return processed;
  }, [data, period]);

  // Calculate indicators and add to processed data
  const dataWithIndicators = useMemo(() => {
    if (processedData.length === 0 || selectedIndicators.length === 0) {
      return processedData;
    }

    // Convert processed data to PriceData format for indicator calculations
    // Helper to convert string numbers to actual numbers
    const toNumber = (val: number | string | undefined | null): number => {
      if (val === null || val === undefined) return NaN;
      if (typeof val === "number")
        return isNaN(val) || !isFinite(val) ? NaN : val;
      if (typeof val === "string") {
        const num = parseFloat(val);
        return isNaN(num) || !isFinite(num) ? NaN : num;
      }
      return NaN;
    };

    const priceData: PriceData[] = processedData.map((d) => ({
      close: toNumber(d.close),
      open: toNumber(d.open),
      high: toNumber(d.high),
      low: toNumber(d.low),
      volume: toNumber(d.volume),
    }));

    const enrichedData: ProcessedDataPoint[] = processedData.map((d) => ({
      ...d,
    }));

    selectedIndicators.forEach((indicatorId) => {
      const indicator = AVAILABLE_INDICATORS.find(
        (ind) => ind.id === indicatorId
      );
      if (!indicator) return;

      const period = indicator.defaultPeriod || 20;

      try {
        switch (indicatorId) {
          case "sma": {
            const values = indicators.calculateSMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) {
                enrichedData[idx].sma = val;
              }
            });
            break;
          }
          case "ema": {
            const values = indicators.calculateEMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].ema = val;
            });
            break;
          }
          case "wma": {
            const values = indicators.calculateWMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].wma = val;
            });
            break;
          }
          case "dema": {
            const values = indicators.calculateDEMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].dema = val;
            });
            break;
          }
          case "tema": {
            const values = indicators.calculateTEMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].tema = val;
            });
            break;
          }
          case "tma": {
            const values = indicators.calculateTMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].tma = val;
            });
            break;
          }
          case "hma": {
            const values = indicators.calculateHMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].hma = val;
            });
            break;
          }
          case "bollinger": {
            const bands = indicators.calculateBollingerBands(priceData, period);
            bands.upper.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].bb_upper = val;
            });
            bands.middle.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].bb_middle = val;
            });
            bands.lower.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].bb_lower = val;
            });
            break;
          }
          case "psar": {
            const values = indicators.calculatePSAR(priceData);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].psar = val;
            });
            break;
          }
          case "supertrend": {
            const result = indicators.calculateSupertrend(priceData, period);
            result.value.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].supertrend = val;
            });
            break;
          }
          case "alligator": {
            const result = indicators.calculateAlligator(priceData);
            result.jaw.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].alligator_jaw = val;
            });
            result.teeth.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].alligator_teeth = val;
            });
            result.lips.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].alligator_lips = val;
            });
            break;
          }
          case "ichimoku": {
            const result = indicators.calculateIchimoku(priceData);
            result.tenkan.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].ichimoku_tenkan = val;
            });
            result.kijun.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].ichimoku_kijun = val;
            });
            result.senkouA.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].ichimoku_senkouA = val;
            });
            result.senkouB.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].ichimoku_senkouB = val;
            });
            result.chikou.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].ichimoku_chikou = val;
            });
            break;
          }
          case "atr_trailing": {
            const values = indicators.calculateATRTrailingStop(
              priceData,
              period
            );
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].atr_trailing = val;
            });
            break;
          }
          case "donchian": {
            const result = indicators.calculateDonchianChannel(
              priceData,
              period
            );
            result.upper.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].donchian_upper = val;
            });
            result.lower.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].donchian_lower = val;
            });
            result.middle.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].donchian_middle = val;
            });
            break;
          }
          case "fractal": {
            const result = indicators.calculateFractalChaosBands(
              priceData,
              period
            );
            result.upper.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].fractal_upper = val;
            });
            result.lower.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].fractal_lower = val;
            });
            break;
          }
          case "linear_regression": {
            const values = indicators.calculateLinearRegressionForecast(
              priceData,
              period
            );
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].linear_regression = val;
            });
            break;
          }
          case "mcginley": {
            const values = indicators.calculateMcGinleyDynamic(
              priceData,
              period
            );
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].mcginley = val;
            });
            break;
          }
          case "vwap": {
            const values = indicators.calculateVWAP(priceData);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].vwap = val;
            });
            break;
          }
          case "vwap_ma": {
            const values = indicators.calculateVWAPMA(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].vwap_ma = val;
            });
            break;
          }
          case "keltner": {
            const result = indicators.calculateKeltnerChannel(
              priceData,
              period
            );
            result.upper.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].keltner_upper = val;
            });
            result.middle.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].keltner_middle = val;
            });
            result.lower.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].keltner_lower = val;
            });
            break;
          }
          case "rsi": {
            const values = indicators.calculateRSI(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].rsi = val;
            });
            break;
          }
          case "adx": {
            const values = indicators.calculateADX(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].adx = val;
            });
            break;
          }
          case "cci": {
            const values = indicators.calculateCCI(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].cci = val;
            });
            break;
          }
          case "mfi": {
            const values = indicators.calculateMFI(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].mfi = val;
            });
            break;
          }
          case "macd": {
            const result = indicators.calculateMACD(priceData, 12, 26, 9);
            result.macd.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].macd = val;
            });
            result.signal.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].macd_signal = val;
            });
            result.histogram.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].macd_histogram = val;
            });
            break;
          }
          case "williams_r": {
            const values = indicators.calculateWilliamsR(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].williams_r = val;
            });
            break;
          }
          case "momentum": {
            const values = indicators.calculateMomentum(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].momentum = val;
            });
            break;
          }
          case "proc": {
            const values = indicators.calculatePROC(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].proc = val;
            });
            break;
          }
          case "obv": {
            const values = indicators.calculateOBV(priceData);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].obv = val;
            });
            break;
          }
          case "bollinger_upper": {
            const values = indicators.calculateBollingerUpper(
              priceData,
              period
            );
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].bollinger_upper = val;
            });
            break;
          }
          case "bollinger_middle": {
            const values = indicators.calculateBollingerMiddle(
              priceData,
              period
            );
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].bollinger_middle = val;
            });
            break;
          }
          case "bollinger_lower": {
            const values = indicators.calculateBollingerLower(
              priceData,
              period
            );
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].bollinger_lower = val;
            });
            break;
          }
          case "prev_n": {
            const values = indicators.calculatePrevN(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].prev_n = val;
            });
            break;
          }
          case "nth_candle": {
            const values = indicators.calculateNthCandle(priceData, period);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].nth_candle = val;
            });
            break;
          }
          case "opening_range": {
            const result = indicators.calculateOpeningRange(priceData, period);
            result.high.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].opening_range_high = val;
            });
            result.low.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].opening_range_low = val;
            });
            break;
          }
          case "number": {
            // Number indicator uses a default value of 0, but could be configurable
            const values = indicators.calculateNumber(priceData, 0);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].number = val;
            });
            break;
          }
          case "signal_candle": {
            const values = indicators.calculateSignalCandle(priceData);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].signal_candle = val;
            });
            break;
          }
          case "trade_candle": {
            const values = indicators.calculateTradeCandle(priceData);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].trade_candle = val;
            });
            break;
          }
          case "candle_time": {
            const values = indicators.calculateCandleTime(priceData);
            values.forEach((val, idx) => {
              if (enrichedData[idx]) enrichedData[idx].candle_time = val;
            });
            break;
          }
        }
      } catch (error) {
        console.error(`Error calculating ${indicatorId}:`, error);
      }
    });

    return enrichedData;
  }, [processedData, selectedIndicators]);

  // Detect patterns and add to data
  const dataWithPatterns = useMemo(() => {
    if (selectedPatterns.length === 0) {
      return dataWithIndicators.map((d) => ({ ...d, patterns: [] }));
    }

    // Convert to PriceData format for pattern detection
    const priceData: PriceData[] = dataWithIndicators.map((d) => ({
      close: d.close,
      open: d.open,
      high: d.high,
      low: d.low,
      volume: d.volume,
    }));

    // Detect patterns
    const patternMatches = detectAllPatterns(priceData, selectedPatterns);

    // Group patterns by index
    const patternsByIndex = new Map<number, PatternMatch[]>();
    patternMatches.forEach((match) => {
      if (!patternsByIndex.has(match.index)) {
        patternsByIndex.set(match.index, []);
      }
      patternsByIndex.get(match.index)!.push(match);
    });

    // Add patterns to data points
    return dataWithIndicators.map((d, idx) => ({
      ...d,
      patterns: patternsByIndex.get(idx) || [],
    }));
  }, [dataWithIndicators, selectedPatterns]);

  const priceChangeData = useMemo(() => {
    // Calculate overall price change
    if (processedData.length >= 2) {
      const firstPrice = processedData[0].price;
      const lastPrice = processedData[processedData.length - 1].price;
      const absoluteChange = lastPrice - firstPrice;
      const percentageChange = (absoluteChange / firstPrice) * 100;

      return {
        absolute: absoluteChange,
        percentage: percentageChange,
        isPositive: absoluteChange >= 0,
      };
    }
    return null;
  }, [processedData]);

  useEffect(() => {
    setPriceChange(priceChangeData);
  }, [priceChangeData]);

  // Render indicator lines and bands
  const renderIndicators = () => {
    if (selectedIndicators.length === 0) return null;

    const indicatorElements: React.ReactNode[] = [];

    selectedIndicators.forEach((indicatorId) => {
      const indicator = AVAILABLE_INDICATORS.find(
        (ind) => ind.id === indicatorId
      );
      if (!indicator) return;

      const color = indicator.color || "#3B82F6";
      const strokeWidth = 1.5;
      const strokeDasharray =
        indicator.category === "moving_average" ? undefined : "5 5";

      switch (indicatorId) {
        case "sma":
        case "ema":
        case "wma":
        case "dema":
        case "tema":
        case "tma":
        case "hma":
        case "mcginley":
        case "vwap":
        case "vwap_ma":
        case "rsi":
        case "adx":
        case "cci":
        case "mfi":
        case "williams_r":
        case "momentum":
        case "proc":
        case "obv":
        case "prev_n":
        case "nth_candle":
        case "number":
        case "signal_candle":
        case "trade_candle":
        case "candle_time":
          indicatorElements.push(
            <Line
              key={indicatorId}
              type="monotone"
              dataKey={indicatorId}
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={true}
              isAnimationActive={false}
              name={indicator.name}
            />
          );
          break;

        case "bollinger":
          indicatorElements.push(
            <Line
              key="bb_upper"
              type="monotone"
              dataKey="bb_upper"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="bb_middle"
              type="monotone"
              dataKey="bb_middle"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="bb_lower"
              type="monotone"
              dataKey="bb_lower"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          break;

        case "bollinger_upper":
          indicatorElements.push(
            <Line
              key="bollinger_upper"
              type="monotone"
              dataKey="bollinger_upper"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
              name={indicator.name}
            />
          );
          break;

        case "bollinger_middle":
          indicatorElements.push(
            <Line
              key="bollinger_middle"
              type="monotone"
              dataKey="bollinger_middle"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
              name={indicator.name}
            />
          );
          break;

        case "bollinger_lower":
          indicatorElements.push(
            <Line
              key="bollinger_lower"
              type="monotone"
              dataKey="bollinger_lower"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
              name={indicator.name}
            />
          );
          break;

        case "macd":
          indicatorElements.push(
            <Line
              key="macd"
              type="monotone"
              dataKey="macd"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
              name="MACD"
            />
          );
          indicatorElements.push(
            <Line
              key="macd_signal"
              type="monotone"
              dataKey="macd_signal"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={false}
              name="MACD Signal"
            />
          );
          break;

        case "opening_range":
          indicatorElements.push(
            <Line
              key="opening_range_high"
              type="monotone"
              dataKey="opening_range_high"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
              name="Opening Range High"
            />
          );
          indicatorElements.push(
            <Line
              key="opening_range_low"
              type="monotone"
              dataKey="opening_range_low"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
              name="Opening Range Low"
            />
          );
          break;

        case "psar":
        case "supertrend":
        case "atr_trailing":
        case "linear_regression":
          indicatorElements.push(
            <Line
              key={indicatorId}
              type="monotone"
              dataKey={indicatorId}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          break;

        case "alligator":
          indicatorElements.push(
            <Line
              key="alligator_jaw"
              type="monotone"
              dataKey="alligator_jaw"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="alligator_teeth"
              type="monotone"
              dataKey="alligator_teeth"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="alligator_lips"
              type="monotone"
              dataKey="alligator_lips"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          break;

        case "ichimoku":
          indicatorElements.push(
            <Line
              key="ichimoku_tenkan"
              type="monotone"
              dataKey="ichimoku_tenkan"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="ichimoku_kijun"
              type="monotone"
              dataKey="ichimoku_kijun"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="ichimoku_senkouA"
              type="monotone"
              dataKey="ichimoku_senkouA"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="ichimoku_senkouB"
              type="monotone"
              dataKey="ichimoku_senkouB"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="ichimoku_chikou"
              type="monotone"
              dataKey="ichimoku_chikou"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          break;

        case "donchian":
          indicatorElements.push(
            <Line
              key="donchian_upper"
              type="monotone"
              dataKey="donchian_upper"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="donchian_middle"
              type="monotone"
              dataKey="donchian_middle"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="donchian_lower"
              type="monotone"
              dataKey="donchian_lower"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          break;

        case "fractal":
          indicatorElements.push(
            <Line
              key="fractal_upper"
              type="monotone"
              dataKey="fractal_upper"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="fractal_lower"
              type="monotone"
              dataKey="fractal_lower"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          break;

        case "keltner":
          indicatorElements.push(
            <Line
              key="keltner_upper"
              type="monotone"
              dataKey="keltner_upper"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="keltner_middle"
              type="monotone"
              dataKey="keltner_middle"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              connectNulls={false}
            />
          );
          indicatorElements.push(
            <Line
              key="keltner_lower"
              type="monotone"
              dataKey="keltner_lower"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              dot={false}
              connectNulls={false}
            />
          );
          break;
      }
    });

    return <>{indicatorElements}</>;
  };

  const chartColor = priceChange?.isPositive ? "#10b981" : "#ef4444";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-800/50 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="text-white/60">Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-800/50 rounded-xl">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-white/40 mx-auto mb-4" />
          <p className="text-white/60">No chart data available</p>
          <p className="text-white/40 text-sm mt-2">
            Try selecting a different time interval
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>
              {symbol} - {period}
            </span>
          </h3>
          <p className="text-white/60 text-sm">
            {processedData.length} data points
            {period === "1D" && processedData.length > 0 && (
              <>
                {" • "}
                {(() => {
                  const firstTimestamp = processedData[0]?.fullTime;
                  if (firstTimestamp) {
                    const date = parseISO(firstTimestamp);
                    return format(date, "MMM dd, yyyy");
                  }
                  return "";
                })()}
              </>
            )}
          </p>
        </div>

        {priceChange && (
          <div className="text-right">
            <div
              className={`flex items-center space-x-1 ${
                priceChange.isPositive ? "text-green-400" : "text-red-400"
              }`}
            >
              {priceChange.isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="font-medium">
                {priceChange.isPositive ? "+" : ""}
                {formatPrice(priceChange.absolute)}
              </span>
            </div>
            <div
              className={`text-sm ${
                priceChange.isPositive ? "text-green-400" : "text-red-400"
              }`}
            >
              {priceChange.isPositive ? "+" : ""}
              {formatPercentage(priceChange.percentage)}%
            </div>
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <ResponsiveContainer width="100%" height={height}>
          {chartType === "area" ? (
            <AreaChart data={dataWithPatterns}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip
                content={
                  <CustomTooltip selectedIndicators={selectedIndicators} />
                }
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#colorPrice)"
                dot={(props: {
                  payload: ProcessedDataPoint;
                  cx?: number;
                  cy?: number;
                }) => {
                  const { payload, cx, cy } = props;
                  if (
                    !payload.patterns ||
                    payload.patterns.length === 0 ||
                    !cx ||
                    !cy
                  ) {
                    return null;
                  }
                  return (
                    <g>
                      {payload.patterns.map(
                        (pattern: PatternMatch, idx: number) => {
                          const patternConfig = AVAILABLE_CHART_PATTERNS.find(
                            (p: { id: string }) => p.id === pattern.pattern
                          );
                          const color = patternConfig?.color || "#3B82F6";
                          const signal = pattern.signal;
                          const offsetY =
                            signal === "bullish"
                              ? -12
                              : signal === "bearish"
                              ? 12
                              : 0;
                          return (
                            <g key={`pattern-dot-${pattern.pattern}-${idx}`}>
                              <circle
                                cx={cx}
                                cy={cy + offsetY}
                                r={6}
                                fill={color}
                                stroke="rgba(255, 255, 255, 0.8)"
                                strokeWidth={1.5}
                                opacity={0.9}
                                className="cursor-pointer"
                              />
                            </g>
                          );
                        }
                      )}
                    </g>
                  );
                }}
                activeDot={{ r: 4, stroke: chartColor, strokeWidth: 2 }}
              />
              {/* Render selected indicators */}
              {renderIndicators()}
            </AreaChart>
          ) : (
            <LineChart data={dataWithPatterns}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip
                content={
                  <CustomTooltip
                    selectedIndicators={selectedIndicators}
                    selectedPatterns={selectedPatterns}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                dot={(props: {
                  payload: ProcessedDataPoint;
                  cx?: number;
                  cy?: number;
                }) => {
                  const { payload, cx, cy } = props;
                  if (
                    !payload.patterns ||
                    payload.patterns.length === 0 ||
                    !cx ||
                    !cy
                  ) {
                    return null;
                  }
                  return (
                    <g>
                      {payload.patterns.map(
                        (pattern: PatternMatch, idx: number) => {
                          const patternConfig = AVAILABLE_CHART_PATTERNS.find(
                            (p: { id: string }) => p.id === pattern.pattern
                          );
                          const color = patternConfig?.color || "#3B82F6";
                          const signal = pattern.signal;
                          const offsetY =
                            signal === "bullish"
                              ? -12
                              : signal === "bearish"
                              ? 12
                              : 0;
                          return (
                            <g key={`pattern-dot-${pattern.pattern}-${idx}`}>
                              <circle
                                cx={cx}
                                cy={cy + offsetY}
                                r={6}
                                fill={color}
                                stroke="rgba(255, 255, 255, 0.8)"
                                strokeWidth={1.5}
                                opacity={0.9}
                                className="cursor-pointer"
                              />
                            </g>
                          );
                        }
                      )}
                    </g>
                  );
                }}
                activeDot={{ r: 4, stroke: chartColor, strokeWidth: 2 }}
              />
              {/* Render selected indicators */}
              {renderIndicators()}
            </LineChart>
          )}
        </ResponsiveContainer>
      </motion.div>
    </motion.div>
  );
};

export default StockChart;
