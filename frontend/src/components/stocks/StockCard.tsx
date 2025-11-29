import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Plus, Star, BarChart3 } from "lucide-react";
import type { Stock } from "../../lib/api";

interface StockCardProps {
  stock: Stock;
  onAddToWatchlist?: (symbol: string) => void;
  onViewDetails?: (symbol: string) => void;
  onViewChart?: (stock: Stock) => void;
  isInWatchlist?: boolean;
  showAddButton?: boolean;
  showChartButton?: boolean;
}

const StockCard: React.FC<StockCardProps> = ({
  stock,
  onAddToWatchlist,
  onViewDetails,
  onViewChart,
  isInWatchlist = false,
  showAddButton = true,
  showChartButton = true,
}) => {
  const latestPrice = stock.latest_price;
  const isPositive = latestPrice ? latestPrice.price_change >= 0 : null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercentage = (percent: number) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:border-white/20 hover:bg-gray-800/70"
      onClick={() => onViewDetails?.(stock.symbol)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-lg font-bold text-white">{stock.symbol}</h3>
            {isInWatchlist && (
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
            )}
          </div>
          <p className="text-sm text-white/60 line-clamp-1">{stock.name}</p>
          <p className="text-xs text-white/40">{stock.exchange}</p>
        </div>

        <div className="flex items-center space-x-2">
          {showChartButton && onViewChart && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                onViewChart(stock);
              }}
              className="p-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors"
              title="View Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </motion.button>
          )}

          {showAddButton && !isInWatchlist && onAddToWatchlist && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                onAddToWatchlist(stock.symbol);
              }}
              className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
              title="Add to Watchlist"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Price Information */}
      {latestPrice ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {formatPrice(latestPrice.close_price)}
            </span>
            <div className="text-right">
              <div
                className={`flex items-center space-x-1 ${
                  isPositive ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="font-medium">
                  {formatPrice(Math.abs(latestPrice.price_change))}
                </span>
              </div>
              <div
                className={`text-sm ${
                  isPositive ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatPercentage(latestPrice.price_change_percent)}
              </div>
            </div>
          </div>

          <div className="text-xs text-white/40">
            Last updated: {new Date(latestPrice.date).toLocaleDateString()}
          </div>
        </div>
      ) : (
        <div className="text-white/40 text-sm">No price data available</div>
      )}

      {/* Additional Info */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="grid grid-cols-2 gap-4 text-xs">
          {stock.sector && (
            <div>
              <span className="text-white/40">Sector</span>
              <p className="text-white/80 font-medium">{stock.sector}</p>
            </div>
          )}
          {stock.market_cap_formatted && (
            <div>
              <span className="text-white/40">Market Cap</span>
              <p className="text-white/80 font-medium">
                {stock.market_cap_formatted}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StockCard;
