import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, BarChart3, TrendingUp, Layers, Zap } from "lucide-react";
import { AVAILABLE_INDICATORS } from "../utils/indicatorsConfig";
import type { Indicator } from "../utils/indicatorsConfig";

const Indicators: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryLabels: Record<string, string> = {
    moving_average: "Moving Averages",
    bands: "Bands & Channels",
    oscillator: "Oscillators",
    other: "Other Indicators",
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    moving_average: <TrendingUp className="w-5 h-5" />,
    bands: <Layers className="w-5 h-5" />,
    oscillator: <Zap className="w-5 h-5" />,
    other: <BarChart3 className="w-5 h-5" />,
  };

  const filteredIndicators = AVAILABLE_INDICATORS.filter((indicator) => {
    const matchesSearch =
      indicator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      indicator.description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      indicator.analysis?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === null || indicator.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const groupedIndicators = filteredIndicators.reduce((acc, indicator) => {
    if (!acc[indicator.category]) {
      acc[indicator.category] = [];
    }
    acc[indicator.category].push(indicator);
    return acc;
  }, {} as Record<string, Indicator[]>);

  const categories = Array.from(
    new Set(AVAILABLE_INDICATORS.map((ind) => ind.category))
  );

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
            <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">
                Technical Indicators
              </h1>
              <p className="text-white/60 mt-1">
                Explore and learn about all available technical indicators
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
              placeholder="Search indicators by name, description, or analysis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800/50 text-white/70 hover:bg-gray-800/70"
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedCategory === category
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800/50 text-white/70 hover:bg-gray-800/70"
                }`}
              >
                {categoryIcons[category]}
                {categoryLabels[category] || category}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Indicators Grid */}
        <div className="space-y-8">
          {Object.keys(groupedIndicators).length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-white/60 text-lg">
                No indicators found matching your search.
              </p>
            </motion.div>
          ) : (
            Object.entries(groupedIndicators).map(([category, indicators]) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {categoryIcons[category]}
                  <h2 className="text-2xl font-semibold text-white">
                    {categoryLabels[category] || category}
                  </h2>
                  <span className="text-white/40 text-sm">
                    ({indicators.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {indicators.map((indicator, index) => (
                    <motion.div
                      key={indicator.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="group"
                    >
                      <Link
                        to={`/indicators/${indicator.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-full"
                      >
                        <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 h-full hover:border-white/20 transition-all cursor-pointer">
                          <div className="flex items-start gap-4 mb-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: `${indicator.color}20`,
                              }}
                            >
                              <BarChart3
                                className="w-5 h-5"
                                style={{ color: indicator.color }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                                {indicator.name}
                              </h3>
                              {indicator.defaultPeriod && (
                                <p className="text-white/50 text-xs">
                                  Period: {indicator.defaultPeriod}
                                </p>
                              )}
                            </div>
                          </div>

                          {indicator.description && (
                            <p className="text-white/70 text-sm leading-relaxed line-clamp-2 mb-3">
                              {indicator.description}
                            </p>
                          )}

                          {indicator.analysis && (
                            <div className="pt-3 border-t border-white/10">
                              <p className="text-white/60 text-xs font-semibold mb-1">
                                Quick Tip:
                              </p>
                              <p className="text-white/70 text-xs leading-relaxed line-clamp-2">
                                {indicator.analysis.split(".")[0]}.
                              </p>
                            </div>
                          )}

                          <div className="mt-4 flex items-center gap-2 text-blue-400 text-sm font-medium group-hover:gap-3 transition-all">
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
                {AVAILABLE_INDICATORS.length}
              </div>
              <div className="text-white/60 text-sm">Total Indicators</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-1">
                {categories.length}
              </div>
              <div className="text-white/60 text-sm">Categories</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-1">
                {
                  AVAILABLE_INDICATORS.filter(
                    (ind) => ind.category === "moving_average"
                  ).length
                }
              </div>
              <div className="text-white/60 text-sm">Moving Averages</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-1">
                {AVAILABLE_INDICATORS.filter((ind) => ind.hasUpperLower).length}
              </div>
              <div className="text-white/60 text-sm">Band Indicators</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Indicators;
