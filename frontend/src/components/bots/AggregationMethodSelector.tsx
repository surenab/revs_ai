import React from "react";
import { BarChart, Users, Target, Code, Settings } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";

interface AggregationMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const AggregationMethodSelector: React.FC<
  AggregationMethodSelectorProps
> = ({ value, onChange }) => {
  const methods = [
    {
      id: "weighted_average",
      name: "Weighted Average",
      icon: BarChart,
      description:
        "Combine signals using weighted average with risk adjustment",
    },
    {
      id: "ensemble_voting",
      name: "Ensemble Voting",
      icon: Users,
      description: "Majority vote from all signals, but risk can override",
    },
    {
      id: "threshold_based",
      name: "Threshold Based",
      icon: Target,
      description:
        "All signals must exceed thresholds AND risk must be below threshold",
    },
    {
      id: "custom_rule",
      name: "Custom Rules",
      icon: Code,
      description: "Define custom JSON rules with risk parameters",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-blue-400" />
        <h4 className="text-md font-semibold text-white">Aggregation Method</h4>
        <InfoTooltip
          tooltip={{
            title: "Signal Aggregation Method",
            description:
              "How multiple signals are combined into a final trading decision",
            details:
              "Risk management parameters are integrated to adjust signal confidence and position sizing. Weighted average with risk adjustment is recommended for most use cases.",
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {methods.map((method) => {
          const Icon = method.icon;
          return (
            <label
              key={method.id}
              className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                value === method.id
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-gray-600 bg-gray-700 hover:border-gray-500"
              }`}
            >
              <input
                type="radio"
                name="aggregation_method"
                value={method.id}
                checked={value === method.id}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-white">{method.name}</span>
                </div>
                <p className="text-xs text-gray-400">{method.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
