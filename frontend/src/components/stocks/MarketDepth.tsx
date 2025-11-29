import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, RefreshCw, Activity } from "lucide-react";
import type { MarketDepth as MarketDepthType } from "../../lib/api";
import { stockAPI } from "../../lib/api";

interface MarketDepthProps {
  symbol: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const MarketDepth: React.FC<MarketDepthProps> = ({
  symbol,
  autoRefresh = true,
  refreshInterval = 10000, // 10 seconds
}) => {
  const [depth, setDepth] = useState<MarketDepthType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDepth = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);

      const response = await stockAPI.getMarketDepth(symbol);
      setDepth(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch market depth");
    } finally {
      setIsLoading(false);
      if (showRefreshing) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDepth();
  }, [symbol]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDepth(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, symbol]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const formatSize = (size: number) => {
    if (size >= 1000000) {
      return `${(size / 1000000).toFixed(1)}M`;
    } else if (size >= 1000) {
      return `${(size / 1000).toFixed(1)}K`;
    }
    return size.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-center space-x-2 text-white/60">
          <Activity className="w-5 h-5 animate-pulse" />
          <span>Loading market depth...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md border border-red-500/20 rounded-xl p-6">
        <div className="text-center text-red-400">
          <p className="font-medium">Error loading market depth</p>
          <p className="text-sm text-red-400/80 mt-1">{error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchDepth()}
            className="mt-3 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
          >
            Try Again
          </motion.button>
        </div>
      </div>
    );
  }

  if (!depth || (depth.bids.length === 0 && depth.asks.length === 0)) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
        <div className="text-center text-white/60">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No market depth data available</p>
        </div>
      </div>
    );
  }

  // Calculate max size for bar visualization
  const maxBidSize = Math.max(...depth.bids.map((bid) => bid.size), 0);
  const maxAskSize = Math.max(...depth.asks.map((ask) => ask.size), 0);
  const maxSize = Math.max(maxBidSize, maxAskSize);

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
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <span>Market Depth - {depth.stock.symbol}</span>
          </h3>
          <p className="text-sm text-white/60">{depth.stock.name}</p>
          {depth.spread && (
            <p className="text-xs text-white/40">
              Spread: {formatPrice(Math.abs(depth.spread))}
            </p>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => fetchDepth(true)}
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

      {/* Market Depth Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bids */}
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-green-400 flex items-center space-x-2">
            <span>Bids</span>
            <span className="text-sm text-white/60">({depth.bids.length})</span>
          </h4>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-white/60 font-medium pb-2 border-b border-white/10">
              <span>Price</span>
              <span className="text-center">Size</span>
              <span className="text-right">Total</span>
            </div>

            {depth.bids.map((bid, index) => {
              const barWidth = maxSize > 0 ? (bid.size / maxSize) * 100 : 0;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 bg-green-500/10 rounded"
                    style={{ width: `${barWidth}%` }}
                  />

                  {/* Content */}
                  <div className="relative grid grid-cols-3 gap-2 text-sm py-2 px-2">
                    <span className="text-green-400 font-medium">
                      {formatPrice(bid.price)}
                    </span>
                    <span className="text-center text-white">
                      {formatSize(bid.size)}
                    </span>
                    <span className="text-right text-white/80">
                      {formatSize(bid.size)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Asks */}
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-red-400 flex items-center space-x-2">
            <span>Asks</span>
            <span className="text-sm text-white/60">({depth.asks.length})</span>
          </h4>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-white/60 font-medium pb-2 border-b border-white/10">
              <span>Price</span>
              <span className="text-center">Size</span>
              <span className="text-right">Total</span>
            </div>

            {depth.asks.map((ask, index) => {
              const barWidth = maxSize > 0 ? (ask.size / maxSize) * 100 : 0;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 bg-red-500/10 rounded"
                    style={{ width: `${barWidth}%` }}
                  />

                  {/* Content */}
                  <div className="relative grid grid-cols-3 gap-2 text-sm py-2 px-2">
                    <span className="text-red-400 font-medium">
                      {formatPrice(ask.price)}
                    </span>
                    <span className="text-center text-white">
                      {formatSize(ask.size)}
                    </span>
                    <span className="text-right text-white/80">
                      {formatSize(ask.size)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-900/30 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs text-white/60 mb-1">Best Bid</div>
            <div className="text-lg font-semibold text-green-400">
              {depth.bids.length > 0 ? formatPrice(depth.bids[0].price) : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Best Ask</div>
            <div className="text-lg font-semibold text-red-400">
              {depth.asks.length > 0 ? formatPrice(depth.asks[0].price) : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Total Bid Size</div>
            <div className="text-lg font-semibold text-white">
              {formatSize(depth.bids.reduce((sum, bid) => sum + bid.size, 0))}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Total Ask Size</div>
            <div className="text-lg font-semibold text-white">
              {formatSize(depth.asks.reduce((sum, ask) => sum + ask.size, 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-center space-x-2 text-xs text-white/40">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <span>Level 2 data • Updates every {refreshInterval / 1000}s</span>
      </div>
    </motion.div>
  );
};

export default MarketDepth;
