import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { AVAILABLE_CHART_PATTERNS } from "../utils/indicatorsConfig";
import type { ChartPattern } from "../utils/indicatorsConfig";

const Patterns: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);

  const signalLabels: Record<string, string> = {
    bullish: "Bullish Patterns",
    bearish: "Bearish Patterns",
    neutral: "Neutral Patterns",
  };

  const signalIcons: Record<string, React.ReactNode> = {
    bullish: <TrendingUp className="w-5 h-5" />,
    bearish: <TrendingDown className="w-5 h-5" />,
    neutral: <Minus className="w-5 h-5" />,
  };

  const filteredPatterns = AVAILABLE_CHART_PATTERNS.filter((pattern) => {
    const matchesSearch =
      pattern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.analysis?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSignal =
      selectedSignal === null || pattern.signal === selectedSignal;

    return matchesSearch && matchesSignal;
  });

  const groupedPatterns = filteredPatterns.reduce((acc, pattern) => {
    if (!acc[pattern.signal]) {
      acc[pattern.signal] = [];
    }
    acc[pattern.signal].push(pattern);
    return acc;
  }, {} as Record<string, ChartPattern[]>);

  const signals = Array.from(
    new Set(AVAILABLE_CHART_PATTERNS.map((p) => p.signal))
  );

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "bullish":
        return "text-green-400 bg-green-500/20 border-green-500/30";
      case "bearish":
        return "text-red-400 bg-red-500/20 border-red-500/30";
      case "neutral":
        return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
      default:
        return "text-blue-400 bg-blue-500/20 border-blue-500/30";
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Chart Patterns</h1>
              <p className="text-white/60 mt-1">
                Discover and learn about candlestick chart patterns
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 space-y-4"
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search patterns by name, description, or analysis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
          </div>

          {/* Signal Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedSignal(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSignal === null
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800/50 text-white/70 hover:bg-gray-800/70"
              }`}
            >
              All Patterns
            </button>
            {signals.map((signal) => (
              <button
                key={signal}
                onClick={() => setSelectedSignal(signal)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedSignal === signal
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800/50 text-white/70 hover:bg-gray-800/70"
                }`}
              >
                {signalIcons[signal]}
                {signalLabels[signal] || signal}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Patterns Grid */}
        <div className="space-y-8">
          {Object.keys(groupedPatterns).length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-white/60 text-lg">
                No patterns found matching your search.
              </p>
            </motion.div>
          ) : (
            Object.entries(groupedPatterns).map(([signal, patterns]) => (
              <motion.div
                key={signal}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {signalIcons[signal]}
                  <h2 className="text-2xl font-semibold text-white">
                    {signalLabels[signal] || signal}
                  </h2>
                  <span className="text-white/40 text-sm">
                    ({patterns.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {patterns.map((pattern, index) => (
                    <motion.div
                      key={pattern.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="group"
                    >
                      <Link
                        to={`/patterns/${pattern.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-full"
                      >
                        <div
                          className={`bg-gray-800/50 backdrop-blur-md border rounded-xl p-6 h-full hover:border-white/20 transition-all cursor-pointer ${getSignalColor(
                            pattern.signal
                          )}`}
                        >
                          <div className="flex items-start gap-4 mb-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: `${pattern.color}20`,
                              }}
                            >
                              <Sparkles
                                className="w-5 h-5"
                                style={{ color: pattern.color }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-purple-400 transition-colors">
                                {pattern.name}
                              </h3>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  pattern.signal === "bullish"
                                    ? "bg-green-500/20 text-green-400"
                                    : pattern.signal === "bearish"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-yellow-500/20 text-yellow-400"
                                }`}
                              >
                                {pattern.signal}
                              </span>
                            </div>
                          </div>

                          {pattern.description && (
                            <p className="text-white/70 text-sm leading-relaxed line-clamp-2 mb-3">
                              {pattern.description}
                            </p>
                          )}

                          {pattern.analysis && (
                            <div className="pt-3 border-t border-white/10">
                              <p className="text-white/60 text-xs font-semibold mb-1">
                                Quick Tip:
                              </p>
                              <p className="text-white/70 text-xs leading-relaxed line-clamp-2">
                                {pattern.analysis.split(".")[0]}.
                              </p>
                            </div>
                          )}

                          <div className="mt-4 flex items-center gap-2 text-purple-400 text-sm font-medium group-hover:gap-3 transition-all">
                            <span>Learn more</span>
                            <span className="group-hover:translate-x-1 transition-transform">
                              →
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-6 bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-white mb-1">
                {AVAILABLE_CHART_PATTERNS.length}
              </div>
              <div className="text-white/60 text-sm">Total Patterns</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-1">
                {
                  AVAILABLE_CHART_PATTERNS.filter((p) => p.signal === "bullish")
                    .length
                }
              </div>
              <div className="text-white/60 text-sm">Bullish Patterns</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-1">
                {
                  AVAILABLE_CHART_PATTERNS.filter((p) => p.signal === "bearish")
                    .length
                }
              </div>
              <div className="text-white/60 text-sm">Bearish Patterns</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-1">
                {
                  AVAILABLE_CHART_PATTERNS.filter((p) => p.signal === "neutral")
                    .length
                }
              </div>
              <div className="text-white/60 text-sm">Neutral Patterns</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Patterns;
