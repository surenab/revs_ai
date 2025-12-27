import React, { useMemo } from "react";
import { Gauge, Shield } from "lucide-react";

interface RiskScorePreviewProps {
  riskPerTrade: number;
  maxPositionSize?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  budget: number;
  currentPrice?: number;
}

export const RiskScorePreview: React.FC<RiskScorePreviewProps> = ({
  riskPerTrade,
  maxPositionSize,
  stopLossPercent,
  budget,
  currentPrice = 100,
}) => {
  const calculations = useMemo(() => {
    // Validate and sanitize inputs
    const validBudget = budget && !isNaN(budget) && budget > 0 ? budget : 0;
    const validRiskPerTrade =
      riskPerTrade && !isNaN(riskPerTrade) && riskPerTrade > 0
        ? riskPerTrade
        : 0;
    const validCurrentPrice =
      currentPrice && !isNaN(currentPrice) && currentPrice > 0
        ? currentPrice
        : 100;
    const validStopLossPercent =
      stopLossPercent && !isNaN(stopLossPercent) && stopLossPercent > 0
        ? stopLossPercent
        : null;
    const validMaxPositionSize =
      maxPositionSize && !isNaN(maxPositionSize) && maxPositionSize > 0
        ? maxPositionSize
        : null;

    // If no valid budget, return zeros
    if (validBudget === 0) {
      return {
        riskAmount: 0,
        stopLossPrice: null,
        stopLossDistance: null,
        positionSize: 0,
        positionValue: 0,
        riskScore: 0,
      };
    }

    const riskAmount = (validBudget * validRiskPerTrade) / 100;
    const stopLossPrice =
      validStopLossPercent && validCurrentPrice
        ? validCurrentPrice * (1 - validStopLossPercent / 100)
        : null;
    const stopLossDistance = stopLossPrice
      ? validCurrentPrice - stopLossPrice
      : null;
    const positionSize =
      stopLossDistance && stopLossDistance > 0
        ? riskAmount / stopLossDistance
        : (validBudget * 0.1) / validCurrentPrice; // Fallback to 10% of budget
    const finalPositionSize = validMaxPositionSize
      ? Math.min(positionSize, validMaxPositionSize)
      : positionSize;
    const positionValue = finalPositionSize * validCurrentPrice;

    // Simplified risk score calculation
    const volatilityScore = 30; // Placeholder
    const concentrationScore =
      validBudget > 0 ? (positionValue / validBudget) * 20 : 0;
    const positionScore =
      validBudget > 0 ? (positionValue / validBudget) * 25 : 0;
    const riskScore = Math.min(
      100,
      volatilityScore + concentrationScore + positionScore
    );

    return {
      riskAmount: isNaN(riskAmount) ? 0 : riskAmount,
      stopLossPrice,
      stopLossDistance,
      positionSize: isNaN(finalPositionSize) ? 0 : finalPositionSize,
      positionValue: isNaN(positionValue) ? 0 : positionValue,
      riskScore: isNaN(riskScore) ? 0 : riskScore,
    };
  }, [riskPerTrade, maxPositionSize, stopLossPercent, budget, currentPrice]);

  const getRiskColor = (score: number) => {
    if (score <= 30) return "text-green-400";
    if (score <= 60) return "text-yellow-400";
    if (score <= 80) return "text-orange-400";
    return "text-red-400";
  };

  const getRiskLabel = (score: number) => {
    if (score <= 30) return "Low Risk";
    if (score <= 60) return "Moderate Risk";
    if (score <= 80) return "High Risk";
    return "Very High Risk";
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-5 h-5 text-blue-400" />
        <h4 className="text-md font-semibold text-white">Risk Score Preview</h4>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Risk Amount</span>
            <span className="text-sm font-medium text-white">
              {calculations.riskAmount > 0
                ? `$${calculations.riskAmount.toFixed(2)}`
                : "$0.00"}
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">
              Calculated Position Size
            </span>
            <span className="text-sm font-medium text-white">
              {calculations.positionSize > 0
                ? `${calculations.positionSize.toFixed(2)} shares`
                : "0.00 shares"}
            </span>
          </div>
          {calculations.stopLossPrice && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Stop Loss Price</span>
              <span className="text-sm font-medium text-white">
                ${calculations.stopLossPrice.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-gray-600 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Risk Score</span>
            <span
              className={`text-lg font-bold ${getRiskColor(
                calculations.riskScore
              )}`}
            >
              {calculations.riskScore.toFixed(1)} / 100
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Shield
              className={`w-4 h-4 ${getRiskColor(calculations.riskScore)}`}
            />
            <span
              className={`text-sm font-medium ${getRiskColor(
                calculations.riskScore
              )}`}
            >
              {getRiskLabel(calculations.riskScore)}
            </span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                calculations.riskScore <= 30
                  ? "bg-green-500"
                  : calculations.riskScore <= 60
                  ? "bg-yellow-500"
                  : calculations.riskScore <= 80
                  ? "bg-orange-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${calculations.riskScore}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>• Volatility: 30% of risk score</p>
          <p>• Concentration: 20% of risk score</p>
          <p>• Drawdown: 25% of risk score</p>
          <p>• Position Size: 25% of risk score</p>
        </div>
      </div>
    </div>
  );
};
