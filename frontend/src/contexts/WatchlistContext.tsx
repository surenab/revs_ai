import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { watchlistAPI } from "../lib/api";
import type { Watchlist } from "../lib/api";
import toast from "react-hot-toast";

interface WatchlistContextType {
  watchlist: Watchlist[];
  watchlistSymbols: Set<string>;
  isLoading: boolean;
  addToWatchlist: (
    symbol: string,
    targetPrice?: number,
    notes?: string
  ) => Promise<void>;
  removeFromWatchlist: (id: string) => Promise<void>;
  updateWatchlist: (
    id: string,
    targetPrice?: number,
    notes?: string
  ) => Promise<void>;
  refreshWatchlist: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(
  undefined
);

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
};

interface WatchlistProviderProps {
  children: React.ReactNode;
}

export const WatchlistProvider: React.FC<WatchlistProviderProps> = ({
  children,
}) => {
  const [watchlist, setWatchlist] = useState<Watchlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Derived state for quick symbol lookups
  const watchlistSymbols = new Set(watchlist.map((item) => item.stock_symbol));

  const fetchWatchlist = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await watchlistAPI.getWatchlist();
      setWatchlist(response.data.results || []);
    } catch (error: any) {
      console.error("Failed to load watchlist:", error);
      // If the API doesn't exist (404), just set empty watchlist
      if (error.response?.status === 404) {
        console.warn("Watchlist API not implemented yet");
        setWatchlist([]);
      } else {
        toast.error("Failed to load watchlist");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addToWatchlist = useCallback(
    async (symbol: string, targetPrice?: number, notes?: string) => {
      try {
        // Check if already in watchlist
        if (watchlistSymbols.has(symbol)) {
          toast.error(`${symbol} is already in your watchlist`);
          return;
        }

        const response = await watchlistAPI.addToWatchlist({
          stock_symbol: symbol,
          target_price: targetPrice,
          notes,
        });

        // Add to local state
        setWatchlist((prev) => [response.data, ...prev]);
        toast.success(`${symbol} added to watchlist`);
      } catch (error: any) {
        console.error("Failed to add to watchlist:", error);
        if (error.response?.status === 404) {
          toast.error("Watchlist feature is not available yet");
        } else {
          toast.error(`Failed to add ${symbol} to watchlist`);
        }
      }
    },
    [watchlistSymbols]
  );

  const removeFromWatchlist = useCallback(async (id: string) => {
    try {
      await watchlistAPI.removeFromWatchlist(id);

      // Remove from local state
      setWatchlist((prev) => prev.filter((item) => item.id !== id));
      toast.success("Removed from watchlist");
    } catch (error: any) {
      console.error("Failed to remove from watchlist:", error);
      if (error.response?.status === 404) {
        toast.error("Watchlist feature is not available yet");
      } else {
        toast.error("Failed to remove from watchlist");
      }
    }
  }, []);

  const updateWatchlist = useCallback(
    async (id: string, targetPrice?: number, notes?: string) => {
      try {
        const response = await watchlistAPI.updateWatchlist(id, {
          target_price: targetPrice,
          notes,
        });

        // Update local state
        setWatchlist((prev) =>
          prev.map((item) => (item.id === id ? response.data : item))
        );
        toast.success("Watchlist updated");
      } catch (error: any) {
        console.error("Failed to update watchlist:", error);
        if (error.response?.status === 404) {
          toast.error("Watchlist feature is not available yet");
        } else {
          toast.error("Failed to update watchlist");
        }
      }
    },
    []
  );

  const refreshWatchlist = useCallback(async () => {
    await fetchWatchlist();
  }, [fetchWatchlist]);

  // Load watchlist on mount
  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const value: WatchlistContextType = {
    watchlist,
    watchlistSymbols,
    isLoading,
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlist,
    refreshWatchlist,
  };

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
};
