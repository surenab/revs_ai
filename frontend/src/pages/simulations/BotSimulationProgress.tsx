import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import toast from "react-hot-toast";
import { simulationAPI } from "../../lib/api";

interface BotProgress {
  bot_index: number;
  status: string;
  progress: number;
  current_date: string | null;
  current_tick_index: number;
}

interface ProgressData {
  simulation: {
    status: string;
    progress: number;
    current_day: string | null;
    bots_completed: number;
    total_bots: number;
  };
  bots: BotProgress[];
  estimated_completion: string | null;
}

const BotSimulationProgress: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBots, setExpandedBots] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) {
      loadProgress();
    }

    // Set up auto-refresh
    if (autoRefresh) {
      const interval = setInterval(() => {
        if (id) {
          loadProgress(false); // Silent refresh
        }
      }, 3000); // Refresh every 3 seconds
      setRefreshInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [id, autoRefresh]);

  const loadProgress = async (showLoading = true) => {
    if (!id) return;

    try {
      if (showLoading) setIsLoading(true);
      const response = await simulationAPI.getSimulationProgress(id);
      setProgressData(response.data);
    } catch (error: any) {
      console.error("Error loading progress:", error);
      if (showLoading) {
        toast.error(
          error.response?.data?.error || "Failed to load simulation progress"
        );
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const toggleBotExpansion = (botIndex: number) => {
    const newExpanded = new Set(expandedBots);
    if (newExpanded.has(botIndex)) {
      newExpanded.delete(botIndex);
    } else {
      newExpanded.add(botIndex);
    }
    setExpandedBots(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "running":
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-white/60" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-300 border border-green-500/30";
      case "running":
        return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
      case "failed":
        return "bg-red-500/20 text-red-300 border border-red-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
      default:
        return "bg-white/20 text-white border border-white/20";
    }
  };

  const formatEstimatedCompletion = (isoString: string | null) => {
    if (!isoString) return "Calculating...";
    const date = new Date(isoString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `~${hours}h ${minutes % 60}m`;
    }
    return `~${minutes}m`;
  };

  if (isLoading && !progressData) {
    return (
      <div className="min-h-screen p-3 sm:p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
          <p className="mt-4 text-white/70">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="min-h-screen p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="card p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-red-400" />
            <p className="mt-4 text-white/70">Failed to load progress data</p>
            <button
              onClick={() => loadProgress()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Simulation Progress
            </h1>
            <p className="text-white/70 mt-1 text-sm sm:text-base">
              Real-time progress tracking for bot simulation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                autoRefresh
                  ? "bg-green-600 text-white"
                  : "bg-white/10 text-white/90 hover:bg-white/20 border border-white/20"
              }`}
            >
              Auto-refresh: {autoRefresh ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => loadProgress()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => navigate(`/simulations/${id}`)}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              View Details
            </button>
          </div>
        </div>

        {/* High-level Overview */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Simulation Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(progressData.simulation.status)}
                <span className="text-white/70 text-sm">Status</span>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  progressData.simulation.status
                )}`}
              >
                {progressData.simulation.status}
              </span>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-white/70 text-sm mb-2">Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${progressData.simulation.progress}%`,
                    }}
                  />
                </div>
                <span className="text-white font-medium">
                  {progressData.simulation.progress.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-white/70 text-sm mb-2">Bots Completed</div>
              <div className="text-white font-semibold text-lg">
                {progressData.simulation.bots_completed} /{" "}
                {progressData.simulation.total_bots}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-white/70 text-sm mb-2">
                Estimated Completion
              </div>
              <div className="text-white font-medium">
                {formatEstimatedCompletion(
                  progressData.estimated_completion
                )}
              </div>
            </div>
          </div>
          {progressData.simulation.current_day && (
            <div className="mt-4 text-white/70 text-sm">
              Current Day: {new Date(progressData.simulation.current_day).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Bot Progress Details */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            Bot Progress Details
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {progressData.bots.map((bot) => (
                <motion.div
                  key={bot.bot_index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/5 rounded-lg p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(bot.status)}
                        <span className="text-white font-medium">
                          Bot {bot.bot_index}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            bot.status
                          )}`}
                        >
                          {bot.status}
                        </span>
                      </div>
                      <div className="flex-1 max-w-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 bg-white/20 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${bot.progress}%` }}
                            />
                          </div>
                          <span className="text-white/70 text-xs">
                            {bot.progress.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {bot.current_date && (
                        <div className="text-white/70 text-sm">
                          Date: {new Date(bot.current_date).toLocaleDateString()}
                        </div>
                      )}
                      {bot.status === "running" && (
                        <div className="text-white/70 text-sm">
                          Tick: {bot.current_tick_index}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleBotExpansion(bot.bot_index)}
                      className="text-white/70 hover:text-white transition-colors"
                    >
                      {expandedBots.has(bot.bot_index) ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {expandedBots.has(bot.bot_index) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-white/10"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-white/70">Status</div>
                          <div className="text-white">{bot.status}</div>
                        </div>
                        <div>
                          <div className="text-white/70">Progress</div>
                          <div className="text-white">
                            {bot.progress.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70">Current Date</div>
                          <div className="text-white">
                            {bot.current_date
                              ? new Date(bot.current_date).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70">Tick Index</div>
                          <div className="text-white">{bot.current_tick_index}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotSimulationProgress;
