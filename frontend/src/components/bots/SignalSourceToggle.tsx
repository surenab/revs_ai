import React from "react";
import { InfoTooltip } from "./InfoTooltip";
import type { TooltipDefinition } from "../../lib/botConstants";

interface SignalSourceToggleProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  tooltip?: TooltipDefinition;
  children?: React.ReactNode;
}

export const SignalSourceToggle: React.FC<SignalSourceToggleProps> = ({
  label,
  icon: Icon,
  enabled,
  onToggle,
  tooltip,
  children,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-400" />
          <label className="text-sm font-medium text-white">{label}</label>
          {tooltip && <InfoTooltip tooltip={tooltip} />}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      {enabled && children && <div className="ml-7">{children}</div>}
    </div>
  );
};
