import React, { useState } from "react";
import { Brain, X, Plus, Info } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import { SignalWeightSlider } from "./SignalWeightSlider";

interface MLModel {
  id: string;
  name: string;
  framework: string;
  model_type: string;
  description?: string;
  is_active: boolean;
}

interface MLModelSelectorProps {
  models: MLModel[];
  selectedModels: string[];
  modelWeights: Record<string, number>;
  onModelsChange: (modelIds: string[]) => void;
  onWeightsChange: (weights: Record<string, number>) => void;
}

export const MLModelSelector: React.FC<MLModelSelectorProps> = ({
  models,
  selectedModels,
  modelWeights,
  onModelsChange,
  onWeightsChange,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      onModelsChange(selectedModels.filter((id) => id !== modelId));
      const newWeights = { ...modelWeights };
      delete newWeights[modelId];
      onWeightsChange(newWeights);
    } else {
      onModelsChange([...selectedModels, modelId]);
      onWeightsChange({ ...modelWeights, [modelId]: 50 });
    }
  };

  const updateWeight = (modelId: string, weight: number) => {
    onWeightsChange({ ...modelWeights, [modelId]: weight });
  };

  const totalWeight = Object.values(modelWeights).reduce(
    (sum, w) => sum + w,
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <h4 className="text-md font-semibold text-white">ML Models</h4>
          <InfoTooltip
            tooltip={{
              title: "Machine Learning Models",
              description:
                "ML models predict buy/sell/hold actions and potential gain/loss",
              details:
                "These models analyze historical price data, indicators, and patterns to make predictions. Multiple models can be combined with weighted voting for better accuracy.",
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Model
        </button>
      </div>

      {isDropdownOpen && (
        <div className="bg-gray-700 rounded-lg p-3 border border-gray-600 max-h-60 overflow-y-auto">
          {models
            .filter((m) => m.is_active)
            .map((model) => (
              <label
                key={model.id}
                className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedModels.includes(model.id)}
                  onChange={() => toggleModel(model.id)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {model.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-600 rounded text-gray-300">
                      {model.framework}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-600 rounded text-gray-300">
                      {model.model_type}
                    </span>
                  </div>
                  {model.description && (
                    <p className="text-xs text-gray-400 mt-1">
                      {model.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
        </div>
      )}

      {selectedModels.length > 0 && (
        <div className="space-y-3">
          {selectedModels.map((modelId) => {
            const model = models.find((m) => m.id === modelId);
            if (!model) return null;

            return (
              <div
                key={modelId}
                className="bg-gray-700 rounded-lg p-4 border border-gray-600"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {model.name}
                    </span>
                    <Info className="w-4 h-4 text-gray-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleModel(modelId)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <SignalWeightSlider
                  label="Model Weight"
                  icon={Brain}
                  value={modelWeights[modelId] || 50}
                  onChange={(value) => updateWeight(modelId, value)}
                  min={0}
                  max={100}
                />
              </div>
            );
          })}

          {totalWeight !== 100 && (
            <div className="flex items-center gap-2 p-2 bg-yellow-900/20 border border-yellow-600 rounded">
              <span className="text-xs text-yellow-400">
                Total weight: {totalWeight}% (should equal 100%)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
