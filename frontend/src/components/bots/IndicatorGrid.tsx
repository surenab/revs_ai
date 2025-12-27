import React from "react";
import { CheckSquare, Square } from "lucide-react";
import { INDICATORS } from "../../lib/botConstants";
import { InfoTooltip } from "./InfoTooltip";

interface IndicatorGridProps {
  enabledIndicators: Record<string, any>;
  onIndicatorsChange: (indicators: Record<string, any>) => void;
}

export const IndicatorGrid: React.FC<IndicatorGridProps> = ({
  enabledIndicators,
  onIndicatorsChange,
}) => {
  const toggleIndicator = (indicatorId: string) => {
    const newIndicators = { ...enabledIndicators };
    if (newIndicators[indicatorId]) {
      delete newIndicators[indicatorId];
    } else {
      newIndicators[indicatorId] = {
        period:
          INDICATORS.find((i) => i.id === indicatorId)?.defaultPeriod || 14,
      };
    }
    onIndicatorsChange(newIndicators);
  };

  const updateIndicatorPeriod = (indicatorId: string, period: number) => {
    const newIndicators = { ...enabledIndicators };
    if (newIndicators[indicatorId]) {
      newIndicators[indicatorId] = { ...newIndicators[indicatorId], period };
    }
    onIndicatorsChange(newIndicators);
  };

  const selectAllIndicators = () => {
    const newIndicators: Record<string, any> = {};
    INDICATORS.forEach((indicator) => {
      newIndicators[indicator.id] = {
        period: indicator.defaultPeriod || 14,
      };
    });
    onIndicatorsChange(newIndicators);
  };

  const deselectAllIndicators = () => {
    onIndicatorsChange({});
  };

  const indicatorsByCategory = INDICATORS.reduce((acc, indicator) => {
    if (!acc[indicator.category]) {
      acc[indicator.category] = [];
    }
    acc[indicator.category].push(indicator);
    return acc;
  }, {} as Record<string, typeof INDICATORS>);

  const allSelected = INDICATORS.every(
    (indicator) => enabledIndicators[indicator.id]
  );
  const someSelected = INDICATORS.some(
    (indicator) => enabledIndicators[indicator.id]
  );

  return (
    <div className="space-y-6">
      {/* Select All / Deselect All Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          {Object.keys(enabledIndicators).length} of {INDICATORS.length}{" "}
          indicators selected
        </div>
        <button
          type="button"
          onClick={allSelected ? deselectAllIndicators : selectAllIndicators}
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
      {Object.entries(indicatorsByCategory).map(([category, indicators]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {category.replace(/_/g, " ")}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {indicators.map((indicator) => {
              const Icon = indicator.icon;
              const isEnabled = !!enabledIndicators[indicator.id];
              const period =
                enabledIndicators[indicator.id]?.period ||
                indicator.defaultPeriod ||
                14;

              return (
                <div
                  key={indicator.id}
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
                        {indicator.name}
                      </label>
                      <InfoTooltip
                        tooltip={{
                          title: indicator.name,
                          description: indicator.description,
                          details: indicator.calculation,
                          example: indicator.interpretation,
                        }}
                        showMoreLink={`/indicators/${indicator.id}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleIndicator(indicator.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </div>
                  {isEnabled && indicator.defaultPeriod && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-400">Period</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={period}
                        onChange={(e) =>
                          updateIndicatorPeriod(
                            indicator.id,
                            Number(e.target.value)
                          )
                        }
                        className="w-full mt-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
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
