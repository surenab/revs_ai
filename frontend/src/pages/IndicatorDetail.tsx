import React, { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { AVAILABLE_INDICATORS } from "../utils/indicatorsConfig";
import type { Indicator } from "../utils/indicatorsConfig";

const IndicatorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const indicator = useMemo(() => {
    return AVAILABLE_INDICATORS.find((ind) => ind.id === id);
  }, [id]);

  if (!indicator) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Indicator Not Found
          </h1>
          <p className="text-white/70 mb-6">
            The indicator you're looking for doesn't exist.
          </p>
          <Link
            to="/stocks"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Go back to Stocks
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    moving_average: "Moving Averages",
    bands: "Bands & Channels",
    oscillator: "Oscillators",
    other: "Other Indicators",
  };

  const getIndicatorExamples = (indicatorId: string) => {
    const examples: Record<
      string,
      { title: string; description: string; interpretation: string }[]
    > = {
      sma: [
        {
          title: "Golden Cross",
          description:
            "When a short-term SMA (e.g., 50-day) crosses above a long-term SMA (e.g., 200-day)",
          interpretation:
            "This is a bullish signal indicating a potential uptrend. Traders often use this as a buy signal.",
        },
        {
          title: "Death Cross",
          description: "When a short-term SMA crosses below a long-term SMA",
          interpretation:
            "This is a bearish signal indicating a potential downtrend. Traders often use this as a sell signal.",
        },
        {
          title: "Price Crossover",
          description: "When price crosses above or below the SMA line",
          interpretation:
            "Price above SMA suggests bullish momentum; below suggests bearish momentum.",
        },
      ],
      ema: [
        {
          title: "EMA Crossover Strategy",
          description:
            "Using two EMAs (e.g., 12-day and 26-day) and trading when they cross",
          interpretation:
            "Faster EMA crossing above slower EMA = buy signal. Faster crossing below = sell signal.",
        },
        {
          title: "Price vs EMA",
          description: "Price staying consistently above or below EMA",
          interpretation:
            "Strong trend indicator. Price above EMA with rising EMA = strong uptrend.",
        },
      ],
      bollinger: [
        {
          title: "Bollinger Squeeze",
          description:
            "When the bands narrow significantly, indicating low volatility",
          interpretation:
            "Often precedes significant price moves. Watch for breakouts in either direction.",
        },
        {
          title: "Band Touch",
          description: "Price touching the upper or lower band",
          interpretation:
            "Upper band touch may indicate overbought conditions; lower band may indicate oversold. Look for reversals.",
        },
        {
          title: "Band Expansion",
          description: "Bands widening, indicating increased volatility",
          interpretation:
            "Signals increased market activity. Price may continue in the direction of the expansion.",
        },
      ],
      psar: [
        {
          title: "Trend Reversal",
          description:
            "When PSAR dots flip from below price to above (or vice versa)",
          interpretation:
            "Signals a potential trend reversal. Dots below price = uptrend; above = downtrend.",
        },
        {
          title: "Trailing Stop",
          description: "Using PSAR as a dynamic stop-loss level",
          interpretation:
            "PSAR automatically adjusts to price movement, providing a trailing stop that follows the trend.",
        },
      ],
      supertrend: [
        {
          title: "Trend Identification",
          description: "Green line = uptrend, Red line = downtrend",
          interpretation:
            "Simple visual indicator of trend direction. Trade in the direction of the line color.",
        },
        {
          title: "Line Flip",
          description:
            "When the line changes color from green to red or red to green",
          interpretation:
            "Signals a trend reversal. Green to red = sell signal; red to green = buy signal.",
        },
      ],
    };

    return (
      examples[indicatorId] || [
        {
          title: "General Usage",
          description:
            "Use this indicator in conjunction with price action and other technical indicators",
          interpretation:
            "Combine with volume analysis, support/resistance levels, and other indicators for better accuracy.",
        },
      ]
    );
  };

  const examples = getIndicatorExamples(indicator.id);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${indicator.color}20` }}
            >
              <BarChart3
                className="w-6 h-6"
                style={{ color: indicator.color }}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white">
                  {indicator.name}
                </h1>
                <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/70">
                  {categoryLabels[indicator.category] || indicator.category}
                </span>
              </div>
              {indicator.defaultPeriod && (
                <p className="text-white/60 text-sm">
                  Default Period: {indicator.defaultPeriod}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-4">
                What is {indicator.name}?
              </h2>
              {indicator.description ? (
                <p className="text-white/80 leading-relaxed">
                  {indicator.description}
                </p>
              ) : (
                <p className="text-white/60 italic">
                  Description coming soon...
                </p>
              )}
            </motion.div>

            {/* How to Analyze */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp
                  className="w-5 h-5"
                  style={{ color: indicator.color }}
                />
                How to Analyze
              </h2>
              {indicator.analysis ? (
                <div className="space-y-4">
                  <p className="text-white/80 leading-relaxed whitespace-pre-line">
                    {indicator.analysis}
                  </p>
                </div>
              ) : (
                <p className="text-white/60 italic">
                  Analysis guide coming soon...
                </p>
              )}
            </motion.div>

            {/* Examples */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3
                  className="w-5 h-5"
                  style={{ color: indicator.color }}
                />
                Trading Examples
              </h2>
              <div className="space-y-4">
                {examples.map((example, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-900/50 rounded-lg border border-white/5"
                  >
                    <h3 className="text-white font-semibold mb-2">
                      {example.title}
                    </h3>
                    <p className="text-white/70 text-sm mb-2">
                      {example.description}
                    </p>
                    <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/10">
                      <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-green-400/80 text-sm">
                        <span className="font-semibold">Interpretation: </span>
                        {example.interpretation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Quick Info
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-white/60 text-xs mb-1">Category</p>
                  <p className="text-white font-medium">
                    {categoryLabels[indicator.category] || indicator.category}
                  </p>
                </div>
                {indicator.defaultPeriod && (
                  <div>
                    <p className="text-white/60 text-xs mb-1">Default Period</p>
                    <p className="text-white font-medium">
                      {indicator.defaultPeriod} periods
                    </p>
                  </div>
                )}
                {indicator.hasUpperLower && (
                  <div>
                    <p className="text-white/60 text-xs mb-1">Type</p>
                    <p className="text-white font-medium">Band Indicator</p>
                  </div>
                )}
                <div>
                  <p className="text-white/60 text-xs mb-1">Color</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: indicator.color || "#3B82F6" }}
                    />
                    <p className="text-white font-medium">
                      {indicator.color || "#3B82F6"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Best Practices */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Best Practices
              </h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>
                    Use in conjunction with other indicators for confirmation
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>
                    Consider market context and overall trend direction
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>
                    Adjust period settings based on your trading timeframe
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>
                    Always use proper risk management and stop-loss orders
                  </span>
                </li>
              </ul>
            </motion.div>

            {/* Related Indicators */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Related Indicators
              </h3>
              <div className="space-y-2">
                {AVAILABLE_INDICATORS.filter(
                  (ind) =>
                    ind.category === indicator.category &&
                    ind.id !== indicator.id
                )
                  .slice(0, 3)
                  .map((related) => (
                    <Link
                      key={related.id}
                      to={`/indicators/${related.id}`}
                      className="block p-2 bg-gray-900/50 rounded hover:bg-gray-900/70 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: related.color }}
                        />
                        <span className="text-white/80 text-sm">
                          {related.name}
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndicatorDetail;
