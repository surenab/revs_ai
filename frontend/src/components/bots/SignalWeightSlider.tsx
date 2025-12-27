import React from "react";
import { InfoTooltip } from "./InfoTooltip";
import type { TooltipDefinition } from "../../lib/botConstants";

interface SignalWeightSliderProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: TooltipDefinition;
  showPercentage?: boolean;
}

export const SignalWeightSlider: React.FC<SignalWeightSliderProps> = ({
  label,
  icon: Icon,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  tooltip,
  showPercentage = true,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <label className="text-sm font-medium text-gray-300">{label}</label>
          {tooltip && <InfoTooltip tooltip={tooltip} />}
        </div>
        {showPercentage && (
          <span className="text-sm text-gray-400">{value}%</span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
};
