import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, X, ChevronDown } from "lucide-react";

interface StockFiltersProps {
  searchQuery: string;
  selectedExchange: string;
  selectedSector: string;
  exchanges: string[];
  sectors: string[];
  onSearchChange: (query: string) => void;
  onExchangeChange: (exchange: string) => void;
  onSectorChange: (sector: string) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

// Separate memoized input component that doesn't rerender when searchQuery prop changes
const SearchInput = React.memo<{
  initialValue: string;
  onDebouncedChange: (query: string) => void;
  isLoading: boolean;
}>(({ initialValue, onDebouncedChange, isLoading }) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevInitialValueRef = useRef(initialValue);

  // Sync with external clear (only when initialValue changes from non-empty to empty)
  useEffect(() => {
    // Only sync if initialValue was cleared externally (went from non-empty to empty)
    if (
      prevInitialValueRef.current !== "" &&
      initialValue === "" &&
      localValue !== ""
    ) {
      setLocalValue("");
      lastSentRef.current = "";
    }
    prevInitialValueRef.current = initialValue;
  }, [initialValue, localValue]);

  // Debounced change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (localValue !== lastSentRef.current) {
        lastSentRef.current = localValue;
        onDebouncedChange(localValue);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localValue, onDebouncedChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
  };

  const handleClear = () => {
    setLocalValue("");
    lastSentRef.current = "";
    onDebouncedChange("");
  };

  const inputClassName = useMemo(
    () =>
      `w-full pl-12 py-3 bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        localValue ? "pr-12" : "pr-4"
      }`,
    [localValue]
  );

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search stocks by symbol, name, or sector..."
        value={localValue}
        onChange={handleChange}
        disabled={isLoading}
        className={inputClassName}
      />
      {localValue && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={handleClear}
          disabled={isLoading}
          className="absolute right-4 top-[35%] flex items-center justify-center text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
});

SearchInput.displayName = "SearchInput";

// Custom comparison for SearchInput - only rerender if isLoading changes
// We ignore initialValue changes to prevent rerenders while typing
const searchInputAreEqual = (
  prevProps: {
    initialValue: string;
    onDebouncedChange: (q: string) => void;
    isLoading: boolean;
  },
  nextProps: {
    initialValue: string;
    onDebouncedChange: (q: string) => void;
    isLoading: boolean;
  }
) => {
  // Only rerender if isLoading changes or onDebouncedChange reference changes
  // We ignore initialValue changes to prevent rerenders
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.onDebouncedChange === nextProps.onDebouncedChange
  );
};

// Wrap SearchInput with custom comparison
const MemoizedSearchInput = React.memo(SearchInput, searchInputAreEqual);

const StockFilters: React.FC<StockFiltersProps> = ({
  searchQuery,
  selectedExchange,
  selectedSector,
  exchanges,
  sectors,
  onSearchChange,
  onExchangeChange,
  onSectorChange,
  onClearFilters,
  isLoading = false,
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Memoize onSearchChange to prevent unnecessary rerenders
  const memoizedOnSearchChange = useCallback(
    (query: string) => {
      onSearchChange(query);
    },
    [onSearchChange]
  );

  const hasActiveFilters = useMemo(
    () => selectedExchange || selectedSector || searchQuery,
    [selectedExchange, selectedSector, searchQuery]
  );

  return (
    <div className="space-y-4">
      {/* Search Bar - Isolated component that doesn't rerender */}
      <MemoizedSearchInput
        initialValue={searchQuery}
        onDebouncedChange={memoizedOnSearchChange}
        isLoading={isLoading}
      />

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-lg text-white/80 hover:text-white hover:bg-gray-800/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {
                [selectedExchange, selectedSector, searchQuery].filter(Boolean)
                  .length
              }
            </span>
          )}
          <motion.div
            animate={{ rotate: isFiltersOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.button>

        {hasActiveFilters && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClearFilters}
            disabled={isLoading}
            className="flex items-center space-x-1 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-3 h-3" />
            <span>Clear All</span>
          </motion.button>
        )}
      </div>

      {/* Filter Options */}
      <AnimatePresence>
        {isFiltersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-800/30 backdrop-blur-md border border-white/10 rounded-xl">
              {/* Exchange Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">
                  Exchange
                </label>
                <select
                  value={selectedExchange}
                  onChange={(e) => onExchangeChange(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All Exchanges</option>
                  {exchanges.map((exchange) => (
                    <option key={exchange} value={exchange}>
                      {exchange}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sector Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">
                  Sector
                </label>
                <select
                  value={selectedSector}
                  onChange={(e) => onSectorChange(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All Sectors</option>
                  {sectors.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Custom comparison function to prevent unnecessary rerenders
const areEqual = (
  prevProps: StockFiltersProps,
  nextProps: StockFiltersProps
) => {
  // Compare primitive values
  if (
    prevProps.searchQuery !== nextProps.searchQuery ||
    prevProps.selectedExchange !== nextProps.selectedExchange ||
    prevProps.selectedSector !== nextProps.selectedSector ||
    prevProps.isLoading !== nextProps.isLoading
  ) {
    return false;
  }

  // Compare arrays by length and content
  if (
    prevProps.exchanges.length !== nextProps.exchanges.length ||
    prevProps.sectors.length !== nextProps.sectors.length
  ) {
    return false;
  }

  // Arrays are likely the same if lengths match (they're derived from the same source)
  // For performance, we'll assume they're equal if lengths match
  return true;
};

export default React.memo(StockFilters, areEqual);
