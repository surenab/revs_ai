import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  TrendingUp,
  Brain,
  MessageSquare,
  Newspaper,
  LineChart,
  Layers,
  GitMerge,
  CheckCircle,
  X,
  Square,
  Filter,
  Download,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { signalHistoryAPI, botAPI } from "../lib/api";
import type { BotSignalHistory, TradingBotConfig } from "../lib/api";

const BotSignalHistoryPage: React.FC = () => {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const [bot, setBot] = useState<TradingBotConfig | null>(null);
  const [signals, setSignals] = useState<BotSignalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    stock_symbol: "",
    decision: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (botId) {
      fetchBot();
      fetchSignals();
    }
  }, [botId, filters]);

  const fetchBot = async () => {
    try {
      const response = await botAPI.getBot(botId!);
      setBot(response.data);
    } catch (error) {
      console.error("Failed to fetch bot:", error);
      toast.error("Failed to load bot");
    }
  };

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const params: any = { bot_id: botId };
      if (filters.stock_symbol) params.stock_symbol = filters.stock_symbol;
      if (filters.decision) params.decision = filters.decision;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const response = await signalHistoryAPI.getSignalHistory(params);
      setSignals(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch signals:", error);
      toast.error("Failed to load signal history");
    } finally {
      setLoading(false);
    }
  };


  const exportToCSV = () => {
    const headers = [
      "Timestamp",
      "Stock",
      "Decision",
      "Confidence",
      "Risk Score",
      "ML Signals",
      "Social Signals",
      "News Signals",
      "Indicator Signals",
      "Pattern Signals",
    ];
    const rows = signals.map((signal) => [
      signal.timestamp,
      signal.stock_symbol,
      signal.final_decision,
      signal.decision_confidence || "",
      signal.risk_score || "",
      signal.ml_signals?.predictions?.length || 0,
      signal.social_signals ? "Yes" : "No",
      signal.news_signals ? "Yes" : "No",
      signal.indicator_signals?.signals?.length || 0,
      signal.pattern_signals?.patterns?.length || 0,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal_history_${botId}_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case "buy":
        return "text-green-400 bg-green-900/20 border-green-500";
      case "sell":
        return "text-red-400 bg-red-900/20 border-red-500";
      default:
        return "text-gray-400 bg-gray-900/20 border-gray-500";
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case "buy":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "sell":
        return <X className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading && signals.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/trading-bots/${botId}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Bot Details
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">
            Signal History: {bot?.name || "Loading..."}
          </h1>
          <p className="text-gray-400">
            Transparent audit trail of all bot decisions
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Stock Symbol"
              value={filters.stock_symbol}
              onChange={(e) =>
                setFilters({ ...filters, stock_symbol: e.target.value })
              }
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <select
              value={filters.decision}
              onChange={(e) =>
                setFilters({ ...filters, decision: e.target.value })
              }
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Decisions</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="hold">Hold</option>
            </select>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) =>
                setFilters({ ...filters, start_date: e.target.value })
              }
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) =>
                setFilters({ ...filters, end_date: e.target.value })
              }
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Signal Timeline */}
        <div className="space-y-4">
          {signals.length === 0 ? (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
              <p className="text-gray-400">No signal history found</p>
            </div>
          ) : (
            signals.map((signal) => {
              return (
                <div
                  key={signal.id}
                  className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
                >
                  <div className="w-full p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getDecisionIcon(signal.final_decision)}
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {signal.stock_symbol}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium border ${getDecisionColor(
                              signal.final_decision
                            )}`}
                          >
                            {signal.final_decision.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {new Date(signal.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {signal.decision_confidence !== undefined && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Confidence</p>
                          <p className="text-sm font-semibold text-white">
                            {(signal.decision_confidence / 100).toFixed(2)}
                          </p>
                        </div>
                      )}
                      {signal.risk_score !== undefined && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Risk Score</p>
                          <p className="text-sm font-semibold text-white">
                            {signal.risk_score.toFixed(1)}
                          </p>
                        </div>
                      )}
                      {signal.execution ? (
                        <button
                          onClick={() => navigate(`/executions/${signal.execution}`)}
                          className="p-2 hover:bg-gray-700 rounded transition-colors"
                          title="Open bot execution"
                        >
                          <Square className="w-5 h-5 text-blue-400 hover:text-blue-300" />
                        </button>
                      ) : (
                        <div className="w-5 h-5" /> // Spacer to maintain layout
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default BotSignalHistoryPage;
