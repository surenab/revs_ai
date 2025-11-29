import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { RealTimeQuote as RealTimeQuoteType } from "../../lib/api";
import { stockAPI } from "../../lib/api";
import { format } from "date-fns";

interface RealTimeQuoteProps {
  symbol: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const RealTimeQuote: React.FC<RealTimeQuoteProps> = ({
  symbol,
  autoRefresh = true,
  refreshInterval = 5000, // 5 seconds
}) => {
  const [quote, setQuote] = useState<RealTimeQuoteType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchQuote = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) setIsRefreshing(true);

        const response = await stockAPI.getRealTimeQuote(symbol);
        setQuote(response.data);
        setLastUpdated(new Date());
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch quote");
      } finally {
        setIsLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [symbol]
  );

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchQuote(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchQuote]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const formatPercentage = (percent: number | string | null | undefined) => {
    const numPercent =
      typeof percent === "number" ? percent : parseFloat(percent || "0");
    return numPercent.toFixed(2);
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), "HH:mm:ss");
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-center space-x-2 text-white/60">
          <Activity className="w-5 h-5 animate-pulse" />
          <span>Loading real-time quote...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md border border-red-500/20 rounded-xl p-6">
        <div className="text-center text-red-400">
          <p className="font-medium">Error loading quote</p>
          <p className="text-sm text-red-400/80 mt-1">{error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchQuote()}
            className="mt-3 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
          >
            Try Again
          </motion.button>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  const latestTick = quote.latest_tick;
  const latestIntraday = quote.latest_intraday;
  const spread = latestTick?.spread;
  const isPositive = latestIntraday ? latestIntraday.price_change >= 0 : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span>{quote.stock.symbol} Live Quote</span>
          </h3>
          <p className="text-sm text-white/60">{quote.stock.name}</p>
          <p className="text-xs text-white/40">{quote.stock.exchange}</p>
        </div>

        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <div className="text-right text-xs text-white/60">
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Updated {format(lastUpdated, "HH:mm:ss")}</span>
              </div>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fetchQuote(true)}
            disabled={isRefreshing}
            className={`p-2 rounded-lg transition-colors ${
              isRefreshing
                ? "bg-gray-600/20 text-gray-400"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
            }`}
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </motion.button>
        </div>
      </div>

      {/* Latest Tick Data */}
      {latestTick && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Latest Tick</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Price */}
            <div className="bg-gray-900/30 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Current Price</div>
              <div className="text-2xl font-bold text-white">
                {formatPrice(latestTick.price)}
              </div>
              <div className="text-xs text-white/40 mt-1">
                {formatTime(latestTick.timestamp)}
              </div>
            </div>

            {/* Bid/Ask */}
            <div className="bg-gray-900/30 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-2">Bid / Ask</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-green-400">Bid:</span>
                  <span className="text-white font-medium">
                    {latestTick.bid_price
                      ? formatPrice(latestTick.bid_price)
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">Ask:</span>
                  <span className="text-white font-medium">
                    {latestTick.ask_price
                      ? formatPrice(latestTick.ask_price)
                      : "N/A"}
                  </span>
                </div>
                {spread && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Spread:</span>
                    <span className="text-white/80">{formatPrice(spread)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Volume */}
            <div className="bg-gray-900/30 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Volume</div>
              <div className="text-xl font-bold text-white">
                {latestTick.volume.toLocaleString()}
              </div>
              <div className="text-xs text-white/40 mt-1">
                {latestTick.trade_type && (
                  <span className="capitalize">
                    {latestTick.trade_type} order
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latest Intraday Data */}
      {latestIntraday && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">1-Minute Bar</h4>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/30 rounded-lg p-3">
              <div className="text-xs text-white/60 mb-1">Open</div>
              <div className="text-lg font-semibold text-white">
                {formatPrice(latestIntraday.open_price)}
              </div>
            </div>

            <div className="bg-gray-900/30 rounded-lg p-3">
              <div className="text-xs text-white/60 mb-1">High</div>
              <div className="text-lg font-semibold text-green-400">
                {formatPrice(latestIntraday.high_price)}
              </div>
            </div>

            <div className="bg-gray-900/30 rounded-lg p-3">
              <div className="text-xs text-white/60 mb-1">Low</div>
              <div className="text-lg font-semibold text-red-400">
                {formatPrice(latestIntraday.low_price)}
              </div>
            </div>

            <div className="bg-gray-900/30 rounded-lg p-3">
              <div className="text-xs text-white/60 mb-1">Close</div>
              <div className="text-lg font-semibold text-white">
                {formatPrice(latestIntraday.close_price)}
              </div>
            </div>
          </div>

          {/* Price Change */}
          {isPositive !== null && (
            <div className="bg-gray-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60">1-Minute Change</span>
                <div
                  className={`flex items-center space-x-2 ${
                    isPositive ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="font-semibold">
                    {isPositive ? "+" : ""}
                    {formatPrice(latestIntraday.price_change)}
                  </span>
                  <span className="text-sm">
                    ({isPositive ? "+" : ""}
                    {formatPercentage(latestIntraday.price_change_percent)}%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Indicator */}
      <div className="flex items-center justify-center space-x-2 text-xs text-white/40">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Live data • Updates every {refreshInterval / 1000}s</span>
      </div>
    </motion.div>
  );
};

export default RealTimeQuote;
