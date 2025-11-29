import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Plus,
  Trash2,
  Edit3,
  TrendingUp,
  TrendingDown,
  Target,
  Search,
  X,
  Loader2,
} from "lucide-react";
import type { Stock } from "../../lib/api";
import { stockAPI } from "../../lib/api";
import { useWatchlist } from "../../contexts/WatchlistContext";
import toast from "react-hot-toast";

interface WatchlistManagerProps {
  onStockSelect?: (symbol: string) => void;
}

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    symbol: string,
    targetPrice?: number,
    notes?: string
  ) => Promise<void>;
}

const AddStockModal: React.FC<AddStockModalProps> = React.memo(
  ({ isOpen, onClose, onAdd }) => {
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [targetPrice, setTargetPrice] = useState("");
    const [notes, setNotes] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Stock[]>([]);
    const [, setIsSearching] = useState(false);

    const searchStocks = useCallback(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await stockAPI.searchStocks(query);
        setSearchResults(response.data.results);
      } catch {
        toast.error("Failed to search stocks");
      } finally {
        setIsSearching(false);
      }
    }, []);

    const handleClose = useCallback(() => {
      if (isAdding) return; // Prevent closing while adding
      onClose();
      // Reset form state
      setSelectedStock(null);
      setTargetPrice("");
      setNotes("");
      setSearchQuery("");
      setSearchResults([]);
      setIsAdding(false);
    }, [isAdding, onClose]);

    const handleAdd = useCallback(async () => {
      if (!selectedStock || isAdding) return;

      try {
        setIsAdding(true);
        const price = targetPrice ? parseFloat(targetPrice) : undefined;
        await onAdd(selectedStock.symbol, price, notes || undefined);
        handleClose();
      } catch (error) {
        console.error("Failed to add to watchlist:", error);
      } finally {
        setIsAdding(false);
      }
    }, [selectedStock, isAdding, targetPrice, notes, onAdd, handleClose]);

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-white/20 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Add to Watchlist
                </h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stock Search */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/80 mb-2">
                    Search Stock
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        searchStocks(e.target.value);
                      }}
                      placeholder="Enter symbol or company name..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto bg-gray-900/50 border border-white/20 rounded-lg">
                      {searchResults.map((stock) => (
                        <button
                          key={stock.id}
                          onClick={() => {
                            setSelectedStock(stock);
                            setSearchQuery(stock.symbol);
                            setSearchResults([]);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-white font-medium">
                                {stock.symbol}
                              </span>
                              <p className="text-xs text-white/60 truncate">
                                {stock.name}
                              </p>
                            </div>
                            <span className="text-xs text-white/40">
                              {stock.exchange}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedStock && (
                  <>
                    <div>
                      <label className="block text-sm text-white/80 mb-2">
                        Target Price (Optional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder="Enter target price..."
                        className="w-full px-3 py-2 bg-gray-900/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-white/80 mb-2">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this stock..."
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-900/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 bg-gray-600/20 text-white/80 rounded-lg hover:bg-gray-600/30 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAdd}
                        disabled={isAdding}
                        className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                          isAdding
                            ? "bg-blue-600/50 text-white/70 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {isAdding ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Adding...</span>
                          </div>
                        ) : (
                          "Add to Watchlist"
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

AddStockModal.displayName = "AddStockModal";

const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  onStockSelect,
}) => {
  const {
    watchlist,
    isLoading,
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlist,
  } = useWatchlist();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    stock_symbol: string;
    target_price?: number;
    notes?: string;
  } | null>(null);

  const handleAddToWatchlist = useCallback(
    async (symbol: string, targetPrice?: number, notes?: string) => {
      await addToWatchlist(symbol, targetPrice, notes);
    },
    [addToWatchlist]
  );

  const handleUpdateWatchlist = async (
    id: string,
    targetPrice?: number,
    notes?: string
  ) => {
    await updateWatchlist(id, targetPrice, notes);
    setEditingItem(null);
  };

  const handleRemoveFromWatchlist = async (id: string) => {
    await removeFromWatchlist(id);
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

  const EditModal = () => {
    const [targetPrice, setTargetPrice] = useState(
      editingItem?.target_price?.toString() || ""
    );
    const [notes, setNotes] = useState(editingItem?.notes || "");

    const handleUpdate = () => {
      if (!editingItem) return;

      const price = targetPrice ? parseFloat(targetPrice) : undefined;
      handleUpdateWatchlist(editingItem.id, price, notes || undefined);
    };

    return (
      <AnimatePresence>
        {editingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-white/20 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Edit {editingItem.stock_symbol}
                </h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/80 mb-2">
                    Target Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="Enter target price..."
                    className="w-full px-3 py-2 bg-gray-900/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/80 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this stock..."
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-900/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setEditingItem(null)}
                    className="flex-1 px-4 py-2 bg-gray-600/20 text-white/80 rounded-lg hover:bg-gray-600/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Update
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <span>My Watchlist</span>
          </h2>
          <p className="text-sm text-white/60">{watchlist.length} stocks</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Stock</span>
        </motion.button>
      </div>

      {/* Watchlist Items */}
      {watchlist.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Your watchlist is empty</p>
        </div>
      ) : (
        <div className="space-y-3">
          {watchlist.map((item) => {
            const latestPrice = item.stock_details?.latest_price;
            const isPositive = latestPrice
              ? latestPrice.price_change >= 0
              : null;

            return (
              <motion.div
                key={`watchlist-key-${item.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900/30 rounded-lg p-4 hover:bg-gray-900/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onStockSelect?.(item.stock_symbol)}
                  >
                    <div className="flex items-center space-x-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {item.stock_symbol}
                        </h3>
                        <p className="text-sm text-white/60 line-clamp-1">
                          {item.stock_details?.name ||
                            "Loading stock details..."}
                        </p>
                      </div>

                      {latestPrice && (
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-white">
                              {formatPrice(latestPrice.close_price)}
                            </div>
                            <div
                              className={`flex items-center space-x-1 text-sm ${
                                isPositive ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {isPositive ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span>
                                {`${isPositive ? "+" : ""}${formatPrice(
                                  latestPrice.price_change
                                )}(${isPositive ? "+" : ""}${formatPercentage(
                                  latestPrice.price_change_percent
                                )}%)`}
                              </span>
                            </div>
                          </div>

                          {item.target_price && (
                            <div className="flex items-center space-x-1 text-sm text-white/60">
                              <Target className="w-3 h-3" />
                              <span>{formatPrice(item.target_price)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-white/50 mt-2 line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setEditingItem(item)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleRemoveFromWatchlist(item.id)}
                      className="p-2 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AddStockModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddToWatchlist}
      />
      <EditModal />
    </div>
  );
};

export default WatchlistManager;
