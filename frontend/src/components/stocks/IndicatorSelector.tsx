import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { AVAILABLE_INDICATORS } from "../../utils/indicatorsConfig";
import type { Indicator } from "../../utils/indicatorsConfig";

interface IndicatorSelectorProps {
  selectedIndicators: string[];
  onIndicatorsChange: (indicators: string[]) => void;
}

const IndicatorSelector: React.FC<IndicatorSelectorProps> = ({
  selectedIndicators,
  onIndicatorsChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleIndicator = (indicatorId: string) => {
    if (selectedIndicators.includes(indicatorId)) {
      onIndicatorsChange(selectedIndicators.filter((id) => id !== indicatorId));
    } else {
      onIndicatorsChange([...selectedIndicators, indicatorId]);
    }
  };

  const groupedIndicators = AVAILABLE_INDICATORS.reduce((acc, indicator) => {
    if (!acc[indicator.category]) {
      acc[indicator.category] = [];
    }
    acc[indicator.category].push(indicator);
    return acc;
  }, {} as Record<string, Indicator[]>);

  const categoryLabels: Record<string, string> = {
    moving_average: "Moving Averages",
    bands: "Bands & Channels",
    oscillator: "Oscillators",
    other: "Other Indicators",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm transition-colors"
      >
        <span>Add Indicator</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50"
          >
            <div className="p-2 space-y-2">
              {Object.entries(groupedIndicators).map(
                ([category, indicators]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-xs font-semibold text-white/60 uppercase">
                      {categoryLabels[category] || category}
                    </div>
                    {indicators.map((indicator) => {
                      const isSelected = selectedIndicators.includes(
                        indicator.id
                      );
                      return (
                        <button
                          key={indicator.id}
                          onClick={() => toggleIndicator(indicator.id)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded transition-colors text-left"
                        >
                          <span className="text-sm text-white">
                            {indicator.name}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IndicatorSelector;
