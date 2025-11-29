import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TrendingUp, BarChart3, Clock, Activity } from "lucide-react";
import type { Stock, MarketSummary } from "../lib/api";
import { stockAPI } from "../lib/api";
import StockCard from "../components/stocks/StockCard";
import WatchlistManager from "../components/stocks/WatchlistManager";
import StockChartDialog from "../components/stocks/StockChartDialog";
import StockFilters from "../components/stocks/StockFilters";
import Pagination from "../components/common/Pagination";
import { useWatchlist } from "../contexts/WatchlistContext";
import toast from "react-hot-toast";

const Stocks: React.FC = () => {
  const navigate = useNavigate();
  const { watchlistSymbols, addToWatchlist } = useWatchlist();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [chartDialogStock, setChartDialogStock] = useState<Stock | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage] = useState(20);

  // Filter options state
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);

  const fetchStocks = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string | number> = {
        page: currentPage,
      };
      if (searchQuery) params.search = searchQuery;
      if (selectedExchange) params.exchange = selectedExchange;
      if (selectedSector) params.sector = selectedSector;

      const response = await stockAPI.getStocks(params);
      setStocks(response.data.results);
      setTotalCount(response.data.count);
    } catch (error) {
      console.error("Failed to load stocks:", error);
      toast.error("Failed to load stocks");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, selectedExchange, selectedSector]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      // Fetch all stocks to get available filter options
      const response = await stockAPI.getStocks({ page: 1 });
      const allStocks = response.data.results;

      const exchanges = [
        ...new Set(allStocks.map((stock) => stock.exchange)),
      ].filter((exchange): exchange is string => Boolean(exchange));
      const sectors = [
        ...new Set(allStocks.map((stock) => stock.sector)),
      ].filter((sector): sector is string => Boolean(sector));

      setAvailableExchanges(exchanges);
      setAvailableSectors(sectors);
    } catch (error) {
      console.error("Failed to load filter options:", error);
    }
  }, []);

  const fetchMarketSummary = useCallback(async () => {
    try {
      const response = await stockAPI.getMarketSummary();
      setMarketSummary(response.data);
    } catch (error) {
      console.error("Failed to load market summary:", error);
    }
  }, []);

  useEffect(() => {
    fetchMarketSummary();
    fetchFilterOptions();
  }, [fetchMarketSummary, fetchFilterOptions]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, selectedExchange, selectedSector]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const handleAddToWatchlist = async (symbol: string) => {
    await addToWatchlist(symbol);
  };

  const handleStockSelect = (symbol: string) => {
    navigate(`/stocks/${symbol}`);
  };

  const handleViewChart = (stock: Stock) => {
    setChartDialogStock(stock);
  };

  const handleCloseChartDialog = () => {
    setChartDialogStock(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedExchange("");
    setSelectedSector("");
    setCurrentPage(1);
  }, []);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

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

  const MarketSummaryCard = ({
    title,
    data,
    type,
  }: {
    title: string;
    data: Array<{
      stock_symbol: string;
      stock_name?: string;
      close_price: number;
      price_change: number;
      price_change_percent: number;
      volume: number;
    }>;
    type: "gainers" | "losers" | "active";
  }) => {
    const getIcon = () => {
      switch (type) {
        case "gainers":
          return <TrendingUp className="w-5 h-5 text-green-500" />;
        case "losers":
          return <TrendingUp className="w-5 h-5 text-red-500 rotate-180" />;
        case "active":
          return <Activity className="w-5 h-5 text-blue-500" />;
      }
    };

    const getColor = () => {
      switch (type) {
        case "gainers":
          return "border-green-500/20 bg-green-500/5";
        case "losers":
          return "border-red-500/20 bg-red-500/5";
        case "active":
          return "border-blue-500/20 bg-blue-500/5";
      }
    };

    return (
      <div
        className={`bg-gray-800/50 backdrop-blur-md border rounded-xl p-4 ${getColor()}`}
      >
        <div className="flex items-center space-x-2 mb-3">
          {getIcon()}
          <h3 className="font-semibold text-white">{title}</h3>
        </div>

        <div className="space-y-2">
          {data.slice(0, 5).map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm cursor-pointer hover:bg-white/5 rounded p-1 transition-colors"
              onClick={() => handleStockSelect(item.stock_symbol)}
            >
              <span className="text-white font-medium">
                {item.stock_symbol}
              </span>
              <div className="text-right">
                <div className="text-white">
                  {formatPrice(item.close_price)}
                </div>
                <div
                  className={`text-xs ${
                    item.price_change >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {item.price_change >= 0 ? "+" : ""}
                  {formatPercentage(item.price_change_percent)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0"
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
            <BarChart3 className="w-8 h-8 text-blue-500" />
            <span>Stock Market</span>
          </h1>
          <p className="text-white/60 mt-1">
            Real-time stock data and market insights
          </p>
        </div>

        <div className="flex items-center space-x-2 text-sm text-white/60">
          <Clock className="w-4 h-4" />
          <span>Market data updated in real-time</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-2"></div>
        </div>
      </motion.div>

      {/* Market Summary */}
      {marketSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <MarketSummaryCard
            title="Top Gainers"
            data={marketSummary.top_gainers}
            type="gainers"
          />
          <MarketSummaryCard
            title="Top Losers"
            data={marketSummary.top_losers}
            type="losers"
          />
          <MarketSummaryCard
            title="Most Active"
            data={marketSummary.most_active}
            type="active"
          />
        </motion.div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Stocks List */}
        <div className="xl:col-span-2 space-y-6">
          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StockFilters
              searchQuery={searchQuery}
              selectedExchange={selectedExchange}
              selectedSector={selectedSector}
              exchanges={availableExchanges}
              sectors={availableSectors}
              onSearchChange={setSearchQuery}
              onExchangeChange={setSelectedExchange}
              onSectorChange={setSelectedSector}
              onClearFilters={handleClearFilters}
              isLoading={isLoading}
            />
          </motion.div>

          {/* Stocks Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-gray-800/50 rounded-xl p-6 animate-pulse"
                  >
                    <div className="space-y-3">
                      <div className="h-6 bg-white/10 rounded w-1/3"></div>
                      <div className="h-4 bg-white/5 rounded w-2/3"></div>
                      <div className="h-8 bg-white/10 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : stocks.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No stocks found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {stocks.map((stock) => (
                    <StockCard
                      key={stock.id}
                      stock={stock}
                      onAddToWatchlist={() =>
                        handleAddToWatchlist(stock.symbol)
                      }
                      onViewDetails={() => handleStockSelect(stock.symbol)}
                      onViewChart={() => handleViewChart(stock)}
                      isInWatchlist={watchlistSymbols.has(stock.symbol)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  isLoading={isLoading}
                />
              </>
            )}
          </motion.div>
        </div>

        {/* Watchlist Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <WatchlistManager onStockSelect={handleStockSelect} />
        </motion.div>
      </div>

      {/* Stock Chart Dialog */}
      {chartDialogStock && (
        <StockChartDialog
          isOpen={!!chartDialogStock}
          onClose={handleCloseChartDialog}
          stock={chartDialogStock}
        />
      )}
    </div>
  );
};

export default Stocks;
