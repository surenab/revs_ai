import React, { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from "lucide-react";
import { AVAILABLE_CHART_PATTERNS } from "../utils/indicatorsConfig";

const PatternDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const pattern = useMemo(() => {
    return AVAILABLE_CHART_PATTERNS.find((p) => p.id === id);
  }, [id]);

  if (!pattern) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Pattern Not Found
          </h1>
          <p className="text-white/70 mb-6">
            The pattern you're looking for doesn't exist.
          </p>
          <Link
            to="/patterns"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Go back to Patterns
          </Link>
        </div>
      </div>
    );
  }

  const signalLabels: Record<string, string> = {
    bullish: "Bullish Pattern",
    bearish: "Bearish Pattern",
    neutral: "Neutral Pattern",
  };

  const getSignalColor = () => {
    switch (pattern.signal) {
      case "bullish":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "bearish":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "neutral":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  const getSignalIcon = () => {
    switch (pattern.signal) {
      case "bullish":
        return <TrendingUp className="w-5 h-5" />;
      case "bearish":
        return <TrendingDown className="w-5 h-5" />;
      default:
        return <Minus className="w-5 h-5" />;
    }
  };

  const relatedPatterns = AVAILABLE_CHART_PATTERNS.filter(
    (p) => p.signal === pattern.signal && p.id !== pattern.id
  ).slice(0, 3);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate("/patterns")}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Patterns</span>
          </button>

          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${pattern.color}20` }}
            >
              <Sparkles
                className="w-8 h-8"
                style={{ color: pattern.color || "#8B5CF6" }}
              />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">
                {pattern.name}
              </h1>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-lg text-sm font-medium border flex items-center gap-2 ${getSignalColor()}`}
                >
                  {getSignalIcon()}
                  {signalLabels[pattern.signal]}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Description */}
          {pattern.description && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-3">
                Description
              </h2>
              <p className="text-white/80 leading-relaxed">
                {pattern.description}
              </p>
            </motion.div>
          )}

          {/* Analysis */}
          {pattern.analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-3">
                How to Analyze
              </h2>
              <p className="text-white/80 leading-relaxed whitespace-pre-line">
                {pattern.analysis}
              </p>
            </motion.div>
          )}

          {/* Trading Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
          >
            <h2 className="text-xl font-semibold text-white mb-4">
              Trading Tips
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-900/50 rounded-lg border border-white/5">
                <h3 className="text-white font-medium mb-2">
                  Confirmation is Key
                </h3>
                <p className="text-white/70 text-sm">
                  Always wait for confirmation before entering a trade. A
                  pattern alone is not enough - look for volume confirmation and
                  other technical indicators to support your decision.
                </p>
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg border border-white/5">
                <h3 className="text-white font-medium mb-2">Context Matters</h3>
                <p className="text-white/70 text-sm">
                  Consider the overall market trend and context. Patterns are
                  more reliable when they align with the broader market
                  direction and other technical signals.
                </p>
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg border border-white/5">
                <h3 className="text-white font-medium mb-2">Risk Management</h3>
                <p className="text-white/70 text-sm">
                  Always set stop-loss orders and manage your risk. No pattern
                  is 100% reliable, so proper risk management is essential for
                  successful trading.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Related Patterns */}
          {relatedPatterns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Related Patterns
              </h3>
              <div className="space-y-2">
                {relatedPatterns.map((related) => (
                  <Link
                    key={related.id}
                    to={`/patterns/${related.id}`}
                    className="block p-3 bg-gray-900/50 rounded hover:bg-gray-900/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: related.color }}
                      />
                      <span className="text-white/80 text-sm">
                        {related.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ml-auto ${
                          related.signal === "bullish"
                            ? "bg-green-500/20 text-green-400"
                            : related.signal === "bearish"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {related.signal}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatternDetail;
