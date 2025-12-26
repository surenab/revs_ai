import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, X, ArrowDown, ArrowUp, Command } from 'lucide-react';
import { stockAPI, type Stock } from '../../lib/api';
import { useDebounce } from '../../utils/useDebounce';

interface SpotlightSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const SpotlightSearch: React.FC<SpotlightSearchProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Search stocks when query changes
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      searchStocks(debouncedQuery);
    } else {
      setResults([]);
      setIsLoading(false);
    }
  }, [debouncedQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const searchStocks = async (searchQuery: string) => {
    try {
      setIsLoading(true);
      const response = await stockAPI.getStocks({
        search: searchQuery,
        page_size: 10,
      });
      const data = response.data;
      const stocks = Array.isArray(data) ? data : data.results || [];
      setResults(stocks);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Failed to search stocks:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = useCallback((stock: Stock) => {
    navigate(`/stocks/${stock.symbol}`);
    onClose();
    setQuery('');
    setResults([]);
  }, [navigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20 sm:pt-32 px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-700/50">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search stocks by name or symbol..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="p-1 hover:bg-gray-700/50 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 border border-gray-700/50 rounded px-2 py-1">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto" ref={resultsRef}>
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-600 border-t-blue-500"></div>
                <p className="mt-2 text-sm">Searching...</p>
              </div>
            ) : query.trim().length < 2 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Type at least 2 characters to search</p>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No stocks found</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((stock, index) => (
                  <motion.div
                    key={stock.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-600/20 border-l-2 border-blue-500'
                        : 'hover:bg-gray-800/50'
                    }`}
                    onClick={() => handleSelect(stock)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{stock.symbol}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-sm text-gray-300 truncate">{stock.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{stock.exchange}</span>
                          {stock.sector && (
                            <>
                              <span>•</span>
                              <span>{stock.sector}</span>
                            </>
                          )}
                          {stock.latest_price && (
                            <>
                              <span>•</span>
                              <span className={`font-medium ${
                                stock.latest_price.price_change >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                ${stock.latest_price.close_price.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {index === selectedIndex && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <ArrowDown className="w-3 h-3" />
                          <span>Enter</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-700/50 bg-gray-800/30 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />
                  <ArrowDown className="w-3 h-3" />
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Enter</span>
                  <span>Select</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span>Esc</span>
                <span>Close</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SpotlightSearch;
