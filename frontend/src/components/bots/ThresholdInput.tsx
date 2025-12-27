import React from "react";
import { InfoTooltip } from "./InfoTooltip";
import type { TooltipDefinition } from "../../lib/botConstants";

interface ThresholdInputProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  onChange: (value: number | string) => void;
  type?: "number" | "text";
  min?: number;
  max?: number;
  step?: number;
  tooltip?: TooltipDefinition;
  error?: string;
  unit?: string;
}

export const ThresholdInput: React.FC<ThresholdInputProps> = ({
  label,
  icon: Icon,
  value,
  onChange,
  type = "number",
  min,
  max,
  step,
  tooltip,
  error,
  unit,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {tooltip && <InfoTooltip tooltip={tooltip} />}
      </div>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) =>
            onChange(
              type === "number" ? Number(e.target.value) : e.target.value
            )
          }
          min={min}
          max={max}
          step={step}
          className={`flex-1 px-4 py-2 bg-gray-700 border ${
            error ? "border-red-500" : "border-gray-600"
          } rounded-lg text-white focus:outline-none focus:border-blue-500`}
        />
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};
