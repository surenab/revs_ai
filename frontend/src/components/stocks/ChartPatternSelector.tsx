import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { AVAILABLE_CHART_PATTERNS } from "../../utils/indicatorsConfig";
import type { ChartPattern } from "../../utils/indicatorsConfig";

interface ChartPatternSelectorProps {
  selectedPatterns: string[];
  onPatternsChange: (patterns: string[]) => void;
}

const ChartPatternSelector: React.FC<ChartPatternSelectorProps> = ({
  selectedPatterns,
  onPatternsChange,
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

  const togglePattern = (patternId: string) => {
    if (selectedPatterns.includes(patternId)) {
      onPatternsChange(selectedPatterns.filter((id) => id !== patternId));
    } else {
      onPatternsChange([...selectedPatterns, patternId]);
    }
  };

  const groupedPatterns = AVAILABLE_CHART_PATTERNS.reduce(
    (acc: Record<string, ChartPattern[]>, pattern: ChartPattern) => {
      const category = pattern.signal;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(pattern);
      return acc;
    },
    {} as Record<string, ChartPattern[]>
  );

  const categoryLabels: Record<string, { label: string; color: string }> = {
    bullish: { label: "Bullish Patterns", color: "text-green-400" },
    bearish: { label: "Bearish Patterns", color: "text-red-400" },
    neutral: { label: "Neutral Patterns", color: "text-yellow-400" },
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
        <Sparkles className="w-4 h-4" />
        <span>Chart Patterns</span>
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
            className="absolute top-full right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50"
          >
            <div className="p-2 space-y-2">
              {Object.entries(groupedPatterns).map(([category, patterns]) => (
                <div key={category}>
                  <div
                    className={`px-2 py-1 text-xs font-semibold uppercase ${
                      categoryLabels[category]?.color || "text-white/60"
                    }`}
                  >
                    {categoryLabels[category]?.label || category}
                  </div>
                  {patterns.map((pattern: ChartPattern) => {
                    const isSelected = selectedPatterns.includes(pattern.id);
                    return (
                      <button
                        key={pattern.id}
                        onClick={() => togglePattern(pattern.id)}
                        className="w-full flex items-start justify-between px-3 py-2 hover:bg-white/10 rounded transition-colors text-left group"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: pattern.color || "#3B82F6",
                              }}
                            />
                            <span className="text-sm text-white font-medium">
                              {pattern.name}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            )}
                          </div>
                          {pattern.description && (
                            <p className="text-xs text-white/60 ml-4 line-clamp-2">
                              {pattern.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChartPatternSelector;
