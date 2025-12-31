import React from "react";
import { motion } from "framer-motion";
import { Database, Play, BarChart3, CheckCircle } from "lucide-react";
import type { BotSimulationRun } from "../../lib/api";
import { InfoTooltip } from "../bots/InfoTooltip";

interface SimulationFlowDiagramProps {
  simulation: BotSimulationRun;
  hasResults?: boolean;
}

const SimulationFlowDiagram: React.FC<SimulationFlowDiagramProps> = ({
  simulation,
  hasResults = false,
}) => {
  const steps = [
    {
      icon: Database,
      title: "Load Historical Data",
      description:
        "Load all tick data before testing period for bot analysis context",
      color: "blue",
      isActive: true, // Always active
    },
    {
      icon: Play,
      title: "Daily Execution",
      description: `Execute trades day-by-day from ${
        simulation.execution_start_date || "start"
      } to ${
        simulation.execution_end_date || "end"
      }. Each day starts fresh with initial cash.`,
      color: "green",
      isActive: ["running", "paused", "completed", "failed"].includes(
        simulation.status
      ),
    },
    {
      icon: BarChart3,
      title: "Daily Profit Calculation",
      description:
        "For each day: Calculate profit = (end of day total assets) - (start of day initial fund)",
      color: "orange",
      isActive: ["running", "paused", "completed", "failed"].includes(
        simulation.status
      ),
    },
    {
      icon: CheckCircle,
      title: "Results & Analysis",
      description:
        "Aggregate daily results, analyze signal productivity, and generate final report",
      color: "cyan",
      isActive: simulation.status === "completed" && hasResults,
    },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Simulation Flow</h3>
        <InfoTooltip text="Simulation flow: 1) Load historical data before testing period (bot uses this for analysis context but does NOT execute trades), 2) Execute trades day-by-day during testing period (each day starts fresh with initial cash), 3) Calculate daily profit = (end of day total assets) - (start of day initial fund), 4) Aggregate results and analyze signal productivity" />
      </div>
      <div className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.isActive;
          return (
            <React.Fragment key={index}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: isActive ? 1 : 0.5, scale: 1 }}
                className="flex flex-col items-center flex-1"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                    isActive
                      ? step.color === "blue"
                        ? "bg-blue-500 text-white"
                        : step.color === "purple"
                        ? "bg-purple-500 text-white"
                        : step.color === "green"
                        ? "bg-green-500 text-white"
                        : step.color === "orange"
                        ? "bg-orange-500 text-white"
                        : step.color === "cyan"
                        ? "bg-cyan-500 text-white"
                        : "bg-gray-500 text-white"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">
                  {step.title}
                </h4>
                <p className="text-xs text-gray-600 text-center max-w-[120px]">
                  {step.description}
                </p>
              </motion.div>
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-gray-300 mx-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isActive ? "100%" : "0%" }}
                    className="h-full bg-blue-500"
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SimulationFlowDiagram;
