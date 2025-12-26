import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Star,
  Bell,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { UserDashboard, MarketSummary } from "../lib/api";
import { stockAPI } from "../lib/api";
import WatchlistPortfolioChart from "../components/dashboard/WatchlistPortfolioChart";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<UserDashboard | null>(
    null
  );
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchMarketSummary();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await stockAPI.getUserDashboard();
      setDashboardData(response.data);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  };

  const fetchMarketSummary = async () => {
    try {
      const response = await stockAPI.getMarketSummary();
      setMarketSummary(response.data);
    } catch (error) {
      console.error("Failed to load market summary:", error);
    } finally {
      setIsLoading(false);
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

  const stats = [
    {
      name: "Watchlist Items",
      value: dashboardData?.watchlist.length.toString() || "0",
      change: `${dashboardData?.watchlist.length || 0} stocks`,
      changeType: "neutral",
      icon: Star,
    },
    {
      name: "Active Alerts",
      value: dashboardData?.alerts_summary.active_alerts.toString() || "0",
      change: `${
        dashboardData?.alerts_summary.recent_triggered || 0
      } triggered recently`,
      changeType: "neutral",
      icon: Bell,
    },
    {
      name: "Market Gainers",
      value: marketSummary?.top_gainers.length.toString() || "0",
      change: "Top performers",
      changeType: "increase",
      icon: TrendingUp,
    },
    {
      name: "Market Activity",
      value: marketSummary?.most_active.length.toString() || "0",
      change: "Most active stocks",
      changeType: "neutral",
      icon: Activity,
    },
  ];

  const topGainers = marketSummary?.top_gainers.slice(0, 5) || [];

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6 md:mb-8"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
            Welcome back, {user?.first_name}! 👋
          </h1>
          <p className="text-white/70 text-sm sm:text-base md:text-lg">
            Here's what's happening with your investments today.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="card hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/60 text-xs sm:text-sm font-medium truncate">
                      {stat.name}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                      {stat.value}
                    </p>
                    <div className="flex items-center mt-1 sm:mt-2">
                      {stat.changeType === "increase" ? (
                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 mr-1 flex-shrink-0" />
                      ) : stat.changeType === "decrease" ? (
                        <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400 mr-1 flex-shrink-0" />
                      ) : (
                        <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 mr-1 flex-shrink-0" />
                      )}
                      <span
                        className={`text-xs sm:text-sm font-medium truncate ${
                          stat.changeType === "increase"
                            ? "text-green-400"
                            : stat.changeType === "decrease"
                            ? "text-red-400"
                            : "text-blue-400"
                        }`}
                      >
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg flex-shrink-0 ml-2">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Charts and Tables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {/* Portfolio Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 card"
          >
            <WatchlistPortfolioChart />
          </motion.div>

          {/* Top Gainers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-white">Top Gainers</h3>
              <Link
                to="/stocks"
                className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm font-medium flex items-center space-x-1"
              >
                <span className="hidden sm:inline">View All</span>
                <span className="sm:hidden">All</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {isLoading ? (
                <div className="space-y-2 sm:space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between p-2 sm:p-3 bg-white/5 rounded-lg">
                        <div className="space-y-1 sm:space-y-2">
                          <div className="h-3 sm:h-4 bg-white/10 rounded w-12 sm:w-16"></div>
                          <div className="h-2 sm:h-3 bg-white/5 rounded w-16 sm:w-24"></div>
                        </div>
                        <div className="space-y-1 sm:space-y-2 text-right">
                          <div className="h-3 sm:h-4 bg-white/10 rounded w-14 sm:w-20"></div>
                          <div className="h-2 sm:h-3 bg-white/5 rounded w-12 sm:w-16"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : topGainers.length > 0 ? (
                topGainers.map((stock, index) => (
                  <motion.div
                    key={stock.stock_symbol}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="flex items-center justify-between p-2 sm:p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <Link
                      to={`/stocks/${stock.stock_symbol}`}
                      className="flex items-center justify-between w-full"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm sm:text-base truncate">
                          {stock.stock_symbol}
                        </p>
                        <p className="text-white/60 text-xs sm:text-sm">Stock</p>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="font-semibold text-white text-xs sm:text-sm md:text-base">
                          {formatPrice(stock.close_price)}
                        </p>
                        <p className="text-xs sm:text-sm text-green-400">
                          +{formatPercentage(stock.price_change_percent)}%
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-6 sm:py-8 text-white/60">
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm sm:text-base">No market data available</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* My Watchlist */}
        {dashboardData && dashboardData.watchlist.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 sm:mt-6 card"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-white flex items-center space-x-2">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                <span>My Watchlist</span>
              </h3>
              <Link
                to="/stocks"
                className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm font-medium flex items-center space-x-1"
              >
                <span className="hidden sm:inline">Manage</span>
                <span className="sm:hidden">Manage</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {dashboardData.watchlist.slice(0, 6).map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="bg-white/5 rounded-lg p-3 sm:p-4 hover:bg-white/10 transition-colors"
                >
                  <Link to={`/stocks/${item.stock.symbol}`} className="block">
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <h4 className="font-semibold text-white text-sm sm:text-base truncate flex-1 min-w-0">
                        {item.stock.symbol}
                      </h4>
                      {item.target_price && (
                        <div className="flex items-center space-x-1 text-xs text-white/60 ml-2 flex-shrink-0">
                          <span className="hidden sm:inline">Target:</span>
                          <span>{formatPrice(item.target_price)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-white/60 mb-2 sm:mb-3 line-clamp-1">
                      {item.stock.name}
                    </p>

                    {item.latest_price && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base sm:text-lg font-semibold text-white truncate">
                          {formatPrice(item.latest_price.close_price)}
                        </span>
                        <div
                          className={`flex items-center space-x-1 text-xs sm:text-sm flex-shrink-0 ${
                            item.latest_price.price_change >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {item.latest_price.price_change >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>
                            {item.latest_price.price_change >= 0 ? "+" : ""}
                            {formatPercentage(
                              item.latest_price.price_change_percent
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
