import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  Stock,
  StockPrice,
  IntradayPrice,
  StockTick,
} from "../../lib/api";
import { stockAPI } from "../../lib/api";
import StockChart from "./StockChart";
import TimePeriodSelector, {
  type TimePeriod,
  TIME_PERIODS,
} from "./TimePeriodSelector";
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
import toast from "react-hot-toast";

interface StockChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stock: Stock;
}

const StockChartDialog: React.FC<StockChartDialogProps> = ({
  isOpen,
  onClose,
  stock,
}) => {
  const navigate = useNavigate();
  const [chartData, setChartData] = useState<
    (StockPrice | IntradayPrice | StockTick)[]
  >([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(
    TIME_PERIODS[2]
  );
  const [isChartLoading, setIsChartLoading] = useState(false);

  useEffect(() => {
    if (isOpen && stock.symbol) {
      fetchChartData();
    }
  }, [isOpen, stock.symbol, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchChartData = async () => {
    if (!stock.symbol || !selectedPeriod) return;

    setIsChartLoading(true);
    try {
      const startDate = calculateStartDate(selectedPeriod);
      const endDate = calculateEndDate();
      const limit = getDataLimit(selectedPeriod);

      if (shouldUseIntradayData(selectedPeriod)) {
        // For 1D period, use tick data from database
        const tradingDayStart = getTradingDayStart();

        const response = await stockAPI.getTickData(stock.symbol, {
          start_time: formatDateTimeForAPI(tradingDayStart),
          end_time: formatDateTimeForAPI(endDate),
          limit: 10000, // Get all ticks for the day
          market_hours_only: false,
        });
        setChartData(response.data.ticks);
      } else {
        // For other periods, use historical daily data
        const interval = getHistoricalInterval();

        const response = await stockAPI.getTimeSeries(stock.symbol, {
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
  };

  const handleViewDetails = () => {
    navigate(`/stocks/${stock.symbol}`);
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercentage = (percent: number) => {
    return percent.toFixed(2);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {stock.symbol} - {stock.name}
                </h2>
                <p className="text-white/60">{stock.exchange}</p>
              </div>

              {/* Latest Price Info */}
              {stock.latest_price && (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {formatPrice(stock.latest_price.close_price)}
                    </div>
                    <div
                      className={`flex items-center space-x-1 text-sm ${
                        stock.latest_price.price_change >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {stock.latest_price.price_change >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>
                        {stock.latest_price.price_change >= 0 ? "+" : ""}
                        {formatPrice(stock.latest_price.price_change)} (
                        {formatPercentage(
                          stock.latest_price.price_change_percent
                        )}
                        %)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* View Details Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleViewDetails}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Details</span>
              </motion.button>

              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Time Period Selector */}
          <div className="mb-6">
            <TimePeriodSelector
              selectedPeriod={selectedPeriod.value}
              onPeriodChange={handlePeriodChange}
            />
          </div>

          {/* Chart */}
          <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
            {chartData.length === 0 && !isChartLoading ? (
              <div className="flex items-center justify-center h-96 text-center">
                <div>
                  <BarChart3 className="w-12 h-12 text-white/40 mx-auto mb-4" />
                  <p className="text-white/60 text-lg font-medium mb-2">
                    No chart data available
                  </p>
                  <p className="text-white/40 text-sm">
                    Try selecting a different time period
                  </p>
                </div>
              </div>
            ) : (
              <StockChart
                data={chartData}
                symbol={stock.symbol}
                interval={
                  shouldUseIntradayData(selectedPeriod)
                    ? getIntradayInterval()
                    : getHistoricalInterval()
                }
                period={selectedPeriod.value}
                height={400}
                showVolume={true}
                isLoading={isChartLoading}
              />
            )}
          </div>

          {/* Stock Info */}
          {stock.description && (
            <div className="mt-6 bg-gray-800/30 backdrop-blur-md border border-white/10 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-2">About</h3>
              <p className="text-white/70 text-sm leading-relaxed line-clamp-3">
                {stock.description}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StockChartDialog;
