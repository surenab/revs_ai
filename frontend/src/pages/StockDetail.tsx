import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Clock,
  Star,
  Plus,
  Bell,
  Zap,
} from "lucide-react";
import type { Stock, StockPrice, IntradayPrice, StockTick } from "../lib/api";
import { stockAPI, watchlistAPI, alertAPI } from "../lib/api";
import StockChart from "../components/stocks/StockChart";
import RealTimeQuote from "../components/stocks/RealTimeQuote";
import MarketDepth from "../components/stocks/MarketDepth";
import TimePeriodSelector, {
  type TimePeriod,
  TIME_PERIODS,
} from "../components/stocks/TimePeriodSelector";
import IndicatorSelector from "../components/stocks/IndicatorSelector";
import ChartPatternSelector from "../components/stocks/ChartPatternSelector";
import SelectedItemsCards from "../components/stocks/SelectedItemsCards";
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
} from "../utils/dateUtils";
import toast from "react-hot-toast";

const StockDetail: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [stock, setStock] = useState<Stock | null>(null);
  const [chartData, setChartData] = useState<
    (StockPrice | IntradayPrice | StockTick)[]
  >([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(
    TIME_PERIODS[2]
  ); // Default to 1M
  const [selectedView, setSelectedView] = useState<
    "chart" | "realtime" | "depth"
  >("chart");
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);

  const views = [
    { value: "chart", label: "Chart", icon: BarChart3 },
    { value: "realtime", label: "Real-time", icon: Zap },
    { value: "depth", label: "Market Depth", icon: Activity },
  ];

  useEffect(() => {
    if (symbol) {
      fetchStockData();
      checkWatchlistStatus();
    }
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (symbol && selectedPeriod) {
      fetchChartData();
    }
  }, [symbol, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStockData = async () => {
    if (!symbol) return;

    try {
      const response = await stockAPI.getStock(symbol);
      setStock(response.data);
    } catch (error) {
      console.error("Failed to load stock data:", error);
      toast.error("Failed to load stock data");
      navigate("/stocks");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChartData = async () => {
    if (!symbol || !selectedPeriod) return;

    setIsChartLoading(true);
    try {
      const startDate = calculateStartDate(selectedPeriod);
      const endDate = calculateEndDate();
      const limit = getDataLimit(selectedPeriod);

      if (shouldUseIntradayData(selectedPeriod)) {
        // For 1D period, use tick data from database
        const tradingDayStart = getTradingDayStart();

        const response = await stockAPI.getTickData(symbol, {
          start_time: formatDateTimeForAPI(tradingDayStart),
          end_time: formatDateTimeForAPI(endDate),
          limit: 10000, // Get all ticks for the day
          market_hours_only: false,
        });
        setChartData(response.data.ticks);
      } else {
        // For other periods, use historical daily data
        const interval = getHistoricalInterval();

        const response = await stockAPI.getTimeSeries(symbol, {
          interval,
          start_date: formatDateForAPI(startDate),
          end_date: formatDateForAPI(endDate),
          limit,
        });
        setChartData(response.data.prices);
      }
    } catch (error) {
      toast.error(`Failed to load ${selectedPeriod.label} chart data`);
      console.error("Chart data error:", error);
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  };

  const handlePeriodChange = (period: TimePeriod) => {
    setSelectedPeriod(period);
    // Optionally clear indicators when period changes
    // setSelectedIndicators([]);
  };

  const checkWatchlistStatus = async () => {
    try {
      const response = await watchlistAPI.getWatchlist();
      const isWatched = response.data.results.some(
        (item) => item.stock_symbol === symbol
      );
      setIsInWatchlist(isWatched);
    } catch (error) {
      console.error("Failed to check watchlist status:", error);
    }
  };

  const handleAddToWatchlist = async () => {
    if (!symbol) return;

    try {
      await watchlistAPI.addToWatchlist({ stock_symbol: symbol });
      setIsInWatchlist(true);
      toast.success(`${symbol} added to watchlist`);
    } catch (error) {
      console.error("Failed to add to watchlist:", error);
      toast.error("Failed to add to watchlist");
    }
  };

  const handleCreateAlert = async () => {
    if (!symbol || !stock?.latest_price) return;

    try {
      await alertAPI.createAlert({
        stock_symbol: symbol,
        alert_type: "above",
        threshold_value: stock.latest_price.close_price * 1.05, // 5% above current price
      });
      toast.success(`Price alert created for ${symbol}`);
    } catch (error) {
      console.error("Failed to create alert:", error);
      toast.error("Failed to create alert");
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center text-white/60">
          <Activity className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-lg">Loading stock data...</p>
        </div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center text-white/60">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Stock not found</p>
        </div>
      </div>
    );
  }

  const latestPrice = stock.latest_price;
  const isPositive = latestPrice ? latestPrice.price_change >= 0 : null;

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0"
      >
        <div className="flex items-center space-x-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/stocks")}
            className="p-2 rounded-lg bg-gray-800/50 text-white/80 hover:text-white hover:bg-gray-800/70 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>

          <div>
            <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
              <span>{stock.symbol}</span>
              {isInWatchlist && (
                <Star className="w-6 h-6 text-yellow-500 fill-current" />
              )}
            </h1>
            <p className="text-white/60">{stock.name}</p>
            <p className="text-sm text-white/40">
              {stock.exchange} • {stock.sector}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {!isInWatchlist && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddToWatchlist}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Watchlist</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateAlert}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-600/20 text-orange-400 rounded-lg hover:bg-orange-600/30 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span>Create Alert</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Price Summary */}
      {latestPrice && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
              <div className="flex items-baseline space-x-4">
                <span className="text-4xl font-bold text-white">
                  {formatPrice(latestPrice.close_price)}
                </span>
                <div
                  className={`flex items-center space-x-2 ${
                    isPositive ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  <span className="text-xl font-semibold">
                    {isPositive ? "+" : ""}
                    {formatPrice(latestPrice.price_change)}
                  </span>
                  <span className="text-lg">
                    ({isPositive ? "+" : ""}
                    {formatPercentage(latestPrice.price_change_percent)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2 mt-2 text-white/60">
                <Clock className="w-4 h-4" />
                <span>
                  Last updated:{" "}
                  {new Date(latestPrice.date).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-white/60">Market Cap</div>
              <div className="text-xl font-semibold text-white">
                {stock.market_cap_formatted || "N/A"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-white/60">Sector</div>
              <div className="text-xl font-semibold text-white">
                {stock.sector || "N/A"}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* View Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0"
      >
        <div className="flex items-center space-x-2">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <motion.button
                key={view.value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  setSelectedView(view.value as "chart" | "realtime" | "depth")
                }
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedView === view.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800/50 text-white/80 hover:text-white hover:bg-gray-800/70"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{view.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {selectedView === "chart" && (
          <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <TimePeriodSelector
                  selectedPeriod={selectedPeriod.value}
                  onPeriodChange={handlePeriodChange}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <IndicatorSelector
                    selectedIndicators={selectedIndicators}
                    onIndicatorsChange={setSelectedIndicators}
                  />
                  <ChartPatternSelector
                    selectedPatterns={selectedPatterns}
                    onPatternsChange={setSelectedPatterns}
                  />
                </div>
              </div>
              <SelectedItemsCards
                selectedIndicators={selectedIndicators}
                selectedPatterns={selectedPatterns}
                onRemoveIndicator={(id) =>
                  setSelectedIndicators(
                    selectedIndicators.filter((ind) => ind !== id)
                  )
                }
                onRemovePattern={(id) =>
                  setSelectedPatterns(
                    selectedPatterns.filter((pat) => pat !== id)
                  )
                }
              />
            </div>
            <StockChart
              data={chartData}
              symbol={stock.symbol}
              interval={
                shouldUseIntradayData(selectedPeriod)
                  ? getIntradayInterval()
                  : getHistoricalInterval()
              }
              period={selectedPeriod?.value || "1D"}
              height={500}
              showVolume={true}
              isLoading={isChartLoading}
              selectedIndicators={selectedIndicators}
              selectedPatterns={selectedPatterns}
            />
          </div>
        )}

        {selectedView === "realtime" && symbol && (
          <RealTimeQuote symbol={symbol} />
        )}

        {selectedView === "depth" && symbol && <MarketDepth symbol={symbol} />}
      </motion.div>

      {/* Stock Info */}
      {stock.description && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-3">
            About {stock.name}
          </h3>
          <p className="text-white/80 leading-relaxed">{stock.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <div className="text-sm text-white/60 mb-1">Industry</div>
              <div className="text-white font-medium">
                {stock.industry || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/60 mb-1">Exchange</div>
              <div className="text-white font-medium">{stock.exchange}</div>
            </div>
            <div>
              <div className="text-sm text-white/60 mb-1">Market Cap</div>
              <div className="text-white font-medium">
                {stock.market_cap_formatted || "N/A"}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default StockDetail;
