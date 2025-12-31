import React from "react";
import { motion } from "framer-motion";
import { Activity, Clock, CheckCircle } from "lucide-react";

interface SimulationProgressProps {
  progress: {
    simulation?: {
      status: string;
      progress: number;
      current_day: string | null;
      bots_completed: number;
      total_bots: number;
    };
    bots?: Array<{
      bot_index: number;
      status: string;
      progress: number;
      current_date: string | null;
      current_tick_index: number;
    }>;
    estimated_completion?: string | null;
    current_bot?: {
      bot_index: number;
      config?: any;
    };
    // Legacy format support
    status?: string;
    progress?: number;
    current_day?: string | null;
    bots_completed?: number;
    total_bots?: number;
  };
}

const SimulationProgress: React.FC<SimulationProgressProps> = ({
  progress,
}) => {
  // Support both new and old API response formats
  const simulation = progress.simulation || progress;
  const progressValue = simulation.progress ?? 0;
  const status = simulation.status || progress.status || "unknown";
  const currentDay = simulation.current_day || progress.current_day || null;
  const botsCompleted =
    simulation.bots_completed ?? progress.bots_completed ?? 0;
  const totalBots = simulation.total_bots ?? progress.total_bots ?? 0;
  const estimatedCompletion = progress.estimated_completion;
  const currentBot = progress.current_bot;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-white/80">
            Overall Progress
          </span>
          <span className="text-sm font-semibold text-white">
            {typeof progressValue === "number"
              ? progressValue.toFixed(1)
              : "0.0"}
            %
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${
                typeof progressValue === "number" ? progressValue : 0
              }%`,
            }}
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full"
          />
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 hover:bg-white/15 transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-white/80">
              Bots Completed
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            {botsCompleted} / {totalBots}
          </p>
        </div>

        <div className="card p-4 hover:bg-white/15 transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-sm font-medium text-white/80">
              Current Day
            </span>
          </div>
          <p className="text-lg font-semibold text-white">
            {currentDay || "N/A"}
          </p>
        </div>

        <div className="card p-4 hover:bg-white/15 transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm font-medium text-white/80">Status</span>
          </div>
          <p className="text-lg font-semibold text-white capitalize">
            {status}
          </p>
        </div>
      </div>

      {/* Estimated Completion */}
      {estimatedCompletion && (
        <div className="card p-4 bg-yellow-500/10 border-yellow-500/30">
          <p className="text-sm text-white/90">
            <strong className="text-yellow-300">Estimated Completion:</strong>{" "}
            <span className="text-white/80">
              {new Date(estimatedCompletion).toLocaleString()}
            </span>
          </p>
        </div>
      )}

      {/* Current Bot */}
      {currentBot && (
        <div className="card p-4">
          <p className="text-sm font-medium text-white/90 mb-2">
            Processing Bot
          </p>
          <p className="text-sm text-white/70">
            Bot Index:{" "}
            <span className="text-white font-semibold">
              {currentBot.bot_index}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default SimulationProgress;
