import React from "react";
import { CheckSquare, Square } from "lucide-react";
import { PATTERNS } from "../../lib/botConstants";
import { InfoTooltip } from "./InfoTooltip";

interface PatternGridProps {
  enabledPatterns: Record<string, { min_confidence?: number }>;
  onPatternsChange: (
    patterns: Record<string, { min_confidence?: number }>
  ) => void;
}

export const PatternGrid: React.FC<PatternGridProps> = ({
  enabledPatterns,
  onPatternsChange,
}) => {
  const togglePattern = (patternId: string) => {
    const newPatterns = { ...enabledPatterns };
    if (newPatterns[patternId]) {
      delete newPatterns[patternId];
    } else {
      newPatterns[patternId] = { min_confidence: 0.5 };
    }
    onPatternsChange(newPatterns);
  };

  const updatePatternConfidence = (patternId: string, confidence: number) => {
    const newPatterns = { ...enabledPatterns };
    if (newPatterns[patternId]) {
      newPatterns[patternId] = {
        ...newPatterns[patternId],
        min_confidence: confidence,
      };
    }
    onPatternsChange(newPatterns);
  };

  const selectAllPatterns = () => {
    const newPatterns: Record<string, { min_confidence?: number }> = {};
    PATTERNS.forEach((pattern) => {
      newPatterns[pattern.id] = { min_confidence: 0.5 };
    });
    onPatternsChange(newPatterns);
  };

  const deselectAllPatterns = () => {
    onPatternsChange({});
  };

  const patternsByCategory = PATTERNS.reduce((acc, pattern) => {
    if (!acc[pattern.category]) {
      acc[pattern.category] = [];
    }
    acc[pattern.category].push(pattern);
    return acc;
  }, {} as Record<string, typeof PATTERNS>);

  const allSelected = PATTERNS.every((pattern) => enabledPatterns[pattern.id]);

  return (
    <div className="space-y-6">
      {/* Select All / Deselect All Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          {Object.keys(enabledPatterns).length} of {PATTERNS.length} patterns
          selected
        </div>
        <button
          type="button"
          onClick={allSelected ? deselectAllPatterns : selectAllPatterns}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {allSelected ? (
            <>
              <Square className="w-4 h-4" />
              Deselect All
            </>
          ) : (
            <>
              <CheckSquare className="w-4 h-4" />
              Select All
            </>
          )}
        </button>
      </div>
      {Object.entries(patternsByCategory).map(([category, patterns]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {category.replace(/_/g, " ")} Patterns
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {patterns.map((pattern) => {
              const Icon = pattern.icon;
              const isEnabled = !!enabledPatterns[pattern.id];
              const minConfidence =
                enabledPatterns[pattern.id]?.min_confidence || 0.5;

              return (
                <div
                  key={pattern.id}
                  className={`p-4 border-2 rounded-lg transition-colors ${
                    isEnabled
                      ? "border-blue-500 bg-blue-900/20"
                      : "border-gray-600 bg-gray-700 hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-blue-400" />
                      <label className="text-sm font-medium text-white cursor-pointer">
                        {pattern.name}
                      </label>
                      {/* Only show patternType tag for chart patterns, not candlestick patterns */}
                      {pattern.category !== "candlestick" && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            pattern.patternType === "reversal"
                              ? "bg-red-900/30 text-red-300"
                              : "bg-green-900/30 text-green-300"
                          }`}
                        >
                          {pattern.patternType}
                        </span>
                      )}
                      <InfoTooltip
                        tooltip={{
                          title: pattern.name,
                          description: pattern.description,
                          details: pattern.formation,
                          example: pattern.priceMovement,
                        }}
                        showMoreLink={`/patterns/${pattern.id}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => togglePattern(pattern.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </div>
                  {isEnabled && (
                    <div className="mt-3 space-y-2">
                      <label className="text-xs text-gray-400">
                        Min Confidence: {Math.round(minConfidence * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={minConfidence}
                        onChange={(e) =>
                          updatePatternConfidence(
                            pattern.id,
                            Number(e.target.value)
                          )
                        }
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
