import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, BarChart3, Loader2 } from "lucide-react";
import { useWatchlist } from "../../contexts/WatchlistContext";
import { stockAPI } from "../../lib/api";
import type { StockPrice, IntradayPrice } from "../../lib/api";
import { TIME_PERIODS } from "../../components/stocks/TimePeriodSelector";
import type { TimePeriod } from "../../components/stocks/TimePeriodSelector";
import { format, parseISO } from "date-fns";
import {
  calculateStartDate,
  calculateEndDate,
  formatDateForAPI,
  formatDateTimeForAPI,
  getIntradayInterval,
  getHistoricalInterval,
  shouldUseIntradayData,
  getTradingDayStart,
  getDataLimit,
} from "../../utils/dateUtils";

interface ProcessedDataPoint {
  time: string;
  date: string;
  [key: string]: string | number; // Dynamic keys for each stock symbol
}

interface StockChartData {
  symbol: string;
  data: (StockPrice | IntradayPrice)[];
  color: string;
  latestPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
}

const CHART_COLORS = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#F97316", // orange-500
  "#84CC16", // lime-500
];

const WatchlistPortfolioChart: React.FC = () => {
  const { watchlist, isLoading: watchlistLoading } = useWatchlist();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(
    TIME_PERIODS[2]
  ); // Default to 1M
  const [stocksData, setStocksData] = useState<StockChartData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get top 5 watchlist stocks for the chart
  const topWatchlistStocks = useMemo(() => {
    return watchlist.slice(0, 5);
  }, [watchlist]);

  const fetchStockData = async (
    symbol: string,
    period: TimePeriod
  ): Promise<(StockPrice | IntradayPrice)[]> => {
    try {
      const startDate = calculateStartDate(period);
      const endDate = calculateEndDate();
      const limit = getDataLimit(period);

      if (shouldUseIntradayData(period)) {
        // For 1D period, use intraday data
        const interval = getIntradayInterval();
        const tradingDayStart = getTradingDayStart();

        const response = await stockAPI.getIntradayData(symbol, {
          interval,
          start_time: formatDateTimeForAPI(tradingDayStart),
          end_time: formatDateTimeForAPI(endDate),
          limit,
          session_type: "regular",
        });
        return response.data.prices || [];
      } else {
        // For other periods, use historical daily data
        const interval = getHistoricalInterval();

        const response = await stockAPI.getTimeSeries(symbol, {
          interval,
          start_date: formatDateForAPI(startDate),
          end_date: formatDateForAPI(endDate),
          limit,
        });
        return response.data.prices || [];
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      return [];
    }
  };

  const fetchAllStocksData = async () => {
    if (topWatchlistStocks.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const promises = topWatchlistStocks.map(async (item, index) => {
        const data = await fetchStockData(item.stock_symbol, selectedPeriod);
        const latestPrice = item.stock_details?.latest_price;

        return {
          symbol: item.stock_symbol,
          data,
          color: CHART_COLORS[index % CHART_COLORS.length],
          latestPrice: latestPrice?.close_price,
          priceChange: latestPrice?.price_change,
          priceChangePercent: latestPrice?.price_change_percent,
        };
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((stock) => stock.data.length > 0);
      setStocksData(validResults);
    } catch (error) {
      console.error("Failed to fetch stocks data:", error);
      setError("Failed to load portfolio data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!watchlistLoading && topWatchlistStocks.length > 0) {
      fetchAllStocksData();
    }
  }, [selectedPeriod, topWatchlistStocks, watchlistLoading]);

  // Process data for the chart
  const chartData = useMemo(() => {
    if (stocksData.length === 0) return [];

    // Create a map of all unique timestamps
    const timeMap = new Map<string, ProcessedDataPoint>();

    stocksData.forEach((stock) => {
      stock.data.forEach((point) => {
        // Handle both StockPrice (has date) and IntradayPrice (has timestamp)
        const dateOrTimestamp = 'date' in point ? point.date : point.timestamp;
        const timeKey = shouldUseIntradayData(selectedPeriod)
          ? format(parseISO(dateOrTimestamp), "HH:mm")
          : format(parseISO(dateOrTimestamp), "MM/dd");

        if (!timeMap.has(timeKey)) {
          timeMap.set(timeKey, {
            time: timeKey,
            date: dateOrTimestamp,
          });
        }

        const dataPoint = timeMap.get(timeKey)!;
        dataPoint[stock.symbol] = point.close_price;
      });
    });

    const sortedData = Array.from(timeMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sortedData;
  }, [stocksData, selectedPeriod]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercentage = (percent: number | string | null | undefined) => {
    const numPercent =
      typeof percent === "number" ? percent : parseFloat(percent || "0");
    return numPercent.toFixed(2);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-white/20 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between space-x-4"
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-white/80 text-sm">{entry.dataKey}</span>
              </div>
              <span className="text-white font-medium">
                {formatPrice(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (watchlistLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white/40 mx-auto mb-2 animate-spin" />
          <p className="text-white/60">Loading watchlist...</p>
        </div>
      </div>
    );
  }

  if (topWatchlistStocks.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <p className="text-white/60 mb-2">No stocks in watchlist</p>
          <p className="text-white/40 text-sm">
            Add stocks to your watchlist to see portfolio performance
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Period Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <h3 className="text-lg sm:text-xl font-semibold text-white">
          Portfolio Performance
        </h3>
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-1 sm:pb-0">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period)}
              className={`text-xs sm:text-sm py-1 px-2 sm:px-3 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                selectedPeriod.value === period.value
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Performance Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-3 sm:mb-4">
        {stocksData.map((stock, index) => (
          <motion.div
            key={stock.symbol}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white/5 rounded-lg p-2 sm:p-3"
          >
            <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
              <div
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stock.color }}
              />
              <span className="text-white font-medium text-xs sm:text-sm truncate">
                {stock.symbol}
              </span>
            </div>
            {stock.latestPrice && (
              <>
                <p className="text-white text-xs sm:text-sm font-semibold truncate">
                  {formatPrice(stock.latestPrice)}
                </p>
                {stock.priceChangePercent && (
                  <div
                    className={`flex items-center space-x-1 text-xs ${
                      (stock.priceChange || 0) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {(stock.priceChange || 0) >= 0 ? (
                      <TrendingUp className="w-2 h-2 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-2 h-2 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {(stock.priceChange || 0) >= 0 ? "+" : ""}
                      {formatPercentage(stock.priceChangePercent)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48 sm:h-56 md:h-64 min-h-[192px] sm:min-h-[224px] md:min-h-[256px] w-full">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-white/40 mx-auto mb-2 animate-spin" />
              <p className="text-white/60 text-sm sm:text-base">Loading chart data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-red-400/60 mx-auto mb-2" />
              <p className="text-red-400 text-sm sm:text-base">{error}</p>
            </div>
          </div>
        ) : chartData.length > 0 && stocksData.length > 0 ? (
          <div
            className="w-full h-full"
            style={{
              width: "100%",
              height: "100%",
              minHeight: "192px",
              minWidth: 0,
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minHeight={192}
              minWidth={0}
              aspect={undefined}
            >
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#9CA3AF"
                  fontSize={10}
                  tick={{ fill: "#9CA3AF" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={10}
                  tick={{ fill: "#9CA3AF" }}
                  tickFormatter={(value: number) =>
                    `$${Number(value).toFixed(0)}`
                  }
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                {stocksData.map((stock) => (
                  <Line
                    key={stock.symbol}
                    type="monotone"
                    dataKey={stock.symbol}
                    stroke={stock.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    activeDot={{ r: 4, fill: stock.color }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-2">
              <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-white/40 mx-auto mb-2" />
              <p className="text-white/60 text-sm sm:text-base">No chart data available</p>
              <p className="text-white/40 text-xs sm:text-sm">
                {stocksData.length === 0
                  ? "No stock data loaded"
                  : `${stocksData.length} stocks loaded, ${chartData.length} data points`}
              </p>
              <p className="text-white/40 text-xs mt-1">
                Try selecting a different time period
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistPortfolioChart;
