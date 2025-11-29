import React from "react";
import { motion } from "framer-motion";

export interface TimePeriod {
  value: string;
  label: string;
  type: "intraday" | "historical";
  days?: number;
  isYTD?: boolean;
}

export const TIME_PERIODS: TimePeriod[] = [
  { value: "1D", label: "1D", type: "intraday", days: 1 },
  { value: "5D", label: "5D", type: "historical", days: 5 },
  { value: "1M", label: "1M", type: "historical", days: 30 },
  { value: "6M", label: "6M", type: "historical", days: 180 },
  { value: "YTD", label: "YTD", type: "historical", isYTD: true },
  { value: "1Y", label: "1Y", type: "historical", days: 365 },
  { value: "5Y", label: "5Y", type: "historical", days: 1825 },
  { value: "10Y", label: "10Y", type: "historical", days: 3650 },
];

interface TimePeriodSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: TimePeriod) => void;
  className?: string;
}

const TimePeriodSelector: React.FC<TimePeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  className = "",
}) => {
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {TIME_PERIODS.map((period) => (
        <motion.button
          key={period.value}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPeriodChange(period)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            selectedPeriod === period.value
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
              : "bg-gray-800/50 text-white/80 hover:text-white hover:bg-gray-800/70 border border-white/10 hover:border-white/20"
          }`}
        >
          {period.label}
        </motion.button>
      ))}
    </div>
  );
};

export default TimePeriodSelector;
