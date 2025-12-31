import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Filter,
  BarChart3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";
import { simulationAPI } from "../../lib/api";

interface BotResult {
  bot_index: number;
  total_profit: number;
  win_rate: number;
  total_trades: number;
  config: Record<string, any>;
}

interface AnalysisData {
  simulation_id: string;
  simulation_name: string;
  total_bots: number;
  top_performers: BotResult[];
  indicator_impact: Record<string, any>;
  pattern_impact: Record<string, any>;
  signal_impact: Record<string, any>;
  daily_performance: Array<{
    date: string;
    daily_profit: number;
    cumulative_profit: number;
    cash: number;
    portfolio_value: number;
    total_value: number;
    trades_today: number;
  }>;
}

const BotSimulationResults: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState<string>("profit");
  const [filterConfig, setFilterConfig] = useState<{
    minProfit?: number;
    minWinRate?: number;
    indicator?: string;
    pattern?: string;
  }>({});

  useEffect(() => {
    if (id) {
      loadAnalysis();
    }
  }, [id]);

  const loadAnalysis = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const response = await simulationAPI.getSimulationAnalysis(id);
      setAnalysisData(response.data);
    } catch (error: any) {
      console.error("Error loading analysis:", error);
      toast.error(
        error.response?.data?.error || "Failed to load simulation analysis"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = () => {
    if (!analysisData) return;

    const dataStr = JSON.stringify(analysisData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `simulation_${id}_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Analysis data exported");
  };

  const prepareProfitChartData = () => {
    if (!analysisData?.daily_performance) return [];
    return analysisData.daily_performance.map((day) => ({
      date: new Date(day.date).toLocaleDateString(),
      daily_profit: day.daily_profit,
      cumulative_profit: day.cumulative_profit,
      total_value: day.total_value,
    }));
  };

  const prepareIndicatorImpactData = () => {
    if (!analysisData?.indicator_impact) return [];
    return Object.entries(analysisData.indicator_impact).map(([key, value]: [string, any]) => ({
      name: key,
      impact: value.average_impact_score || 0,
      weight: value.average_weight || 0,
    }));
  };

  const preparePatternImpactData = () => {
    if (!analysisData?.pattern_impact) return [];
    return Object.entries(analysisData.pattern_impact).map(([key, value]: [string, any]) => ({
      name: key,
      impact: value.average_impact_score || 0,
      weight: value.average_weight || 0,
    }));
  };

  const prepareSignalImpactData = () => {
    if (!analysisData?.signal_impact) return [];
    return Object.entries(analysisData.signal_impact)
      .map(([key, value]: [string, any]) => ({
        name: key,
        profit_impact: value.average_profit_impact || 0,
        win_rate: value.average_win_rate || 0,
        contributions: value.average_contributions || 0,
      }))
      .sort((a, b) => b.profit_impact - a.profit_impact)
      .slice(0, 10); // Top 10
  };

  const prepareTopPerformersData = () => {
    if (!analysisData?.top_performers) return [];
    return analysisData.top_performers.map((bot) => ({
      name: `Bot ${bot.bot_index}`,
      profit: bot.total_profit,
      win_rate: bot.win_rate,
      trades: bot.total_trades,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-3 sm:p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
          <p className="mt-4 text-white/70">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="card p-8 text-center">
            <p className="text-white/70">No analysis data available</p>
            <button
              onClick={() => navigate(`/simulations/${id}`)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Simulation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/simulations/${id}`)}
              className="text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Simulation Results & Analysis
              </h1>
              <p className="text-white/70 mt-1 text-sm sm:text-base">
                {analysisData.simulation_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportData}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
        </button>
            <button
              onClick={() => navigate(`/simulations/${id}/progress`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Progress
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-white/70 text-sm mb-1">Total Bots</div>
            <div className="text-2xl font-bold text-white">
              {analysisData.total_bots}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-white/70 text-sm mb-1">Top Profit</div>
            <div className="text-2xl font-bold text-green-400">
              ${analysisData.top_performers[0]?.total_profit.toFixed(2) || "0.00"}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-white/70 text-sm mb-1">Best Win Rate</div>
            <div className="text-2xl font-bold text-blue-400">
              {analysisData.top_performers[0]?.win_rate.toFixed(1) || "0.0"}%
            </div>
          </div>
          <div className="card p-4">
            <div className="text-white/70 text-sm mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-white">
              {analysisData.top_performers.reduce(
                (sum, bot) => sum + bot.total_trades,
                0
                    )}
                  </div>
          </div>
        </div>

        {/* Chart Selection */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: "profit", label: "Profit Over Time" },
              { id: "indicators", label: "Indicator Impact" },
              { id: "patterns", label: "Pattern Impact" },
              { id: "signals", label: "Signal Impact" },
              { id: "performers", label: "Top Performers" },
            ].map((chart) => (
              <button
                key={chart.id}
                onClick={() => setSelectedChart(chart.id)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedChart === chart.id
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-white/90 hover:bg-white/20"
                }`}
              >
                {chart.label}
              </button>
            ))}
          </div>

          {/* Profit Over Time Chart */}
          {selectedChart === "profit" && (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prepareProfitChartData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      color: "#F3F4F6",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="daily_profit"
                    stroke="#3B82F6"
                    name="Daily Profit"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative_profit"
                    stroke="#10B981"
                    name="Cumulative Profit"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_value"
                    stroke="#F59E0B"
                    name="Total Value"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Indicator Impact Chart */}
          {selectedChart === "indicators" && (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prepareIndicatorImpactData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      color: "#F3F4F6",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="impact" fill="#3B82F6" name="Impact Score" />
                  <Bar dataKey="weight" fill="#10B981" name="Average Weight" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pattern Impact Chart */}
          {selectedChart === "patterns" && (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={preparePatternImpactData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      color: "#F3F4F6",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="impact" fill="#8B5CF6" name="Impact Score" />
                  <Bar dataKey="weight" fill="#EC4899" name="Average Weight" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Signal Impact Chart */}
          {selectedChart === "signals" && (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prepareSignalImpactData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      color: "#F3F4F6",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="profit_impact"
                    fill="#10B981"
                    name="Profit Impact"
                  />
                  <Bar
                    dataKey="win_rate"
                    fill="#3B82F6"
                    name="Win Rate %"
                  />
                </BarChart>
              </ResponsiveContainer>
          </div>
        )}

          {/* Top Performers Chart */}
          {selectedChart === "performers" && (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prepareTopPerformersData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      color: "#F3F4F6",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="profit" fill="#10B981" name="Profit ($)" />
                  <Bar dataKey="win_rate" fill="#3B82F6" name="Win Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Performers Table */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            Top Performing Bots
          </h2>
          <div className="overflow-x-auto">
          <table className="w-full">
              <thead className="bg-white/10 border-b border-white/20">
              <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase">
                    Bot Index
                </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase">
                    Total Profit
                </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase">
                  Win Rate
                </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase">
                    Total Trades
                </th>
              </tr>
            </thead>
              <tbody className="divide-y divide-white/20">
                {analysisData.top_performers.map((bot) => (
                  <motion.tr
                    key={bot.bot_index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-white/10 transition-colors"
                  >
                    <td className="px-6 py-4 text-white">Bot {bot.bot_index}</td>
                    <td
                      className={`px-6 py-4 font-medium ${
                        bot.total_profit >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      ${bot.total_profit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {bot.win_rate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-white">{bot.total_trades}</td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotSimulationResults;
