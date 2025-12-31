import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { BotPortfolio, BotPortfolioLot } from "../../lib/api";
import { botAPI } from "../../lib/api";
import { InfoTooltip } from "./InfoTooltip";

interface BotPortfolioTabProps {
  botId: string;
  botCashBalance?: number;
  botTotalEquity?: number;
  botPortfolioValue?: number;
}

const BotPortfolioTab: React.FC<BotPortfolioTabProps> = ({
  botId,
  botCashBalance = 0,
  botTotalEquity = 0,
  botPortfolioValue = 0,
}) => {
  const [portfolio, setPortfolio] = useState<BotPortfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());
  const [lots, setLots] = useState<Record<string, BotPortfolioLot[]>>({});

  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await botAPI.getBotPortfolio(botId);
      setPortfolio(response.data || []);
    } catch (error) {
      console.error("Failed to fetch bot portfolio:", error);
    } finally {
      setIsLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const toggleStockExpansion = async (stockId: string) => {
    const newExpanded = new Set(expandedStocks);
    if (newExpanded.has(stockId)) {
      newExpanded.delete(stockId);
    } else {
      newExpanded.add(stockId);
      // Fetch lots if not already loaded
      if (!lots[stockId]) {
        try {
          const response = await botAPI.getBotPortfolioLots(botId, stockId);
          setLots((prev) => ({ ...prev, [stockId]: response.data || [] }));
        } catch (error) {
          console.error("Failed to fetch portfolio lots:", error);
        }
      }
    }
    setExpandedStocks(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    const numValue = Number(value || 0);
    if (isNaN(numValue)) {
      return "0.00%";
    }
    return `${numValue >= 0 ? "+" : ""}${numValue.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const totalGainLoss = portfolio.reduce(
    (sum, holding) => sum + Number(holding.gain_loss || 0),
    0
  );
  const totalGainLossPercent = (() => {
    const totalCostBasis = portfolio.reduce(
      (sum, holding) => sum + Number(holding.total_cost_basis || 0),
      0
    );
    if (totalCostBasis > 0 && !isNaN(totalGainLoss) && !isNaN(totalCostBasis)) {
      const percent = (totalGainLoss / totalCostBasis) * 100;
      return isNaN(percent) ? 0 : percent;
    }
    return 0;
  })();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Cash Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg p-4 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Cash Balance</span>
              <InfoTooltip text="Available cash for this bot. Used for buying stocks." />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(botCashBalance)}
          </p>
        </motion.div>

        {/* Portfolio Value */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 rounded-lg p-4 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Portfolio Value</span>
              <InfoTooltip text="Current value of all stock holdings." />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(botPortfolioValue)}
          </p>
        </motion.div>

        {/* Total Equity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800 rounded-lg p-4 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-gray-400">Total Equity</span>
              <InfoTooltip text="Total bot equity = Cash Balance + Portfolio Value" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(botTotalEquity)}
          </p>
        </motion.div>

        {/* Total P&L */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`bg-gray-800 rounded-lg p-4 border ${
            totalGainLoss >= 0 ? "border-green-500/50" : "border-red-500/50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {totalGainLoss >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
              <span className="text-sm text-gray-400">Total P&L</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={`text-2xl font-bold ${
                totalGainLoss >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {formatCurrency(totalGainLoss)}
            </p>
            <p
              className={`text-sm ${
                totalGainLoss >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {formatPercent(totalGainLossPercent)}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Portfolio Holdings */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="w-5 h-5" />
            Portfolio Holdings
            <InfoTooltip text="All stocks currently held by this bot. Click to view individual purchase lots (HIFO)." />
          </h3>
        </div>

        {portfolio.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No portfolio holdings yet</p>
            <p className="text-sm mt-2">
              This bot hasn't purchased any stocks yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {portfolio.map((holding) => {
              const isExpanded = expandedStocks.has(holding.id);
              const stockLots = lots[holding.id] || [];

              return (
                <div
                  key={holding.id}
                  className="hover:bg-gray-750 transition-colors"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleStockExpansion(holding.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">
                            {holding.stock_symbol}
                          </h4>
                          <span className="text-sm text-gray-400">
                            {holding.stock_name}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Quantity: </span>
                            <span className="text-white font-medium">
                              {holding.quantity}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Avg Price: </span>
                            <span className="text-white font-medium">
                              {formatCurrency(holding.average_purchase_price)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">
                              Current Value:{" "}
                            </span>
                            <span className="text-white font-medium">
                              {formatCurrency(holding.current_value)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">P&L: </span>
                            <span
                              className={`font-medium ${
                                holding.gain_loss >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {formatCurrency(holding.gain_loss)} (
                              {formatPercent(holding.gain_loss_percent)})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Lots View */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-gray-750 border-t border-gray-700"
                    >
                      <div className="p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-gray-400">
                            Purchase Lots (HIFO - Highest-In-First-Out)
                          </span>
                          <InfoTooltip text="Individual purchase lots. Bot sells highest-priced lots first (HIFO strategy)." />
                        </div>
                        {stockLots.length === 0 ? (
                          <p className="text-sm text-gray-400">
                            Loading lots...
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-700">
                                  <th className="text-left py-2 px-3 text-gray-400">
                                    Purchase Date
                                  </th>
                                  <th className="text-right py-2 px-3 text-gray-400">
                                    Purchase Price
                                  </th>
                                  <th className="text-right py-2 px-3 text-gray-400">
                                    Quantity
                                  </th>
                                  <th className="text-right py-2 px-3 text-gray-400">
                                    Remaining
                                  </th>
                                  <th className="text-right py-2 px-3 text-gray-400">
                                    Cost Basis
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {stockLots
                                  .sort(
                                    (a, b) =>
                                      new Date(b.purchase_date).getTime() -
                                      new Date(a.purchase_date).getTime()
                                  )
                                  .map((lot) => (
                                    <tr
                                      key={lot.id}
                                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                                    >
                                      <td className="py-2 px-3 text-gray-300">
                                        {new Date(
                                          lot.purchase_date
                                        ).toLocaleDateString()}
                                      </td>
                                      <td className="py-2 px-3 text-right text-white font-medium">
                                        {formatCurrency(lot.purchase_price)}
                                      </td>
                                      <td className="py-2 px-3 text-right text-gray-300">
                                        {lot.quantity}
                                      </td>
                                      <td className="py-2 px-3 text-right text-gray-300">
                                        {lot.remaining_quantity}
                                      </td>
                                      <td className="py-2 px-3 text-right text-gray-300">
                                        {formatCurrency(
                                          lot.purchase_price *
                                            lot.remaining_quantity
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BotPortfolioTab;
