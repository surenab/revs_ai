import React from "react";
import { motion } from "framer-motion";
import { Database, Split, Play, BarChart3, CheckCircle } from "lucide-react";
import type { BotSimulationRun } from "../../lib/api";
import { InfoTooltip } from "../bots/InfoTooltip";

interface SimulationFlowDiagramProps {
  simulation: BotSimulationRun;
}

const SimulationFlowDiagram: React.FC<SimulationFlowDiagramProps> = ({ simulation }) => {
  const steps = [
    {
      icon: Database,
      title: "Load Data",
      description: "Load all available tick data from database",
      color: "blue",
    },
    {
      icon: Split,
      title: "Split Data",
      description: `Split data ${(simulation.data_split_ratio * 100).toFixed(0)}% / ${((1 - simulation.data_split_ratio) * 100).toFixed(0)}%`,
      color: "purple",
    },
    {
      icon: Play,
      title: "Simulate",
      description: "Day-by-day execution on training data",
      color: "green",
    },
    {
      icon: BarChart3,
      title: "Validate",
      description: "Compare with validation data",
      color: "orange",
    },
    {
      icon: CheckCircle,
      title: "Analyze",
      description: "Signal productivity and results",
      color: "teal",
    },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Simulation Flow</h3>
        <InfoTooltip text="This diagram shows the step-by-step process of how the simulation works: loading data, splitting into training/validation sets, running day-by-day simulations, and comparing results" />
      </div>
      <div className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = simulation.status === "completed" || index < 3;
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
                      ? `bg-${step.color}-500 text-white`
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">{step.title}</h4>
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
