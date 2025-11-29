import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PatternMatch } from "../../utils/chartPatterns";
import { AVAILABLE_CHART_PATTERNS } from "../../utils/indicatorsConfig";

interface ChartPatternDisplayProps {
  patterns: PatternMatch[];
  dataIndex: number;
  price: number;
  onPatternClick?: (pattern: PatternMatch) => void;
}

const ChartPatternDisplay: React.FC<ChartPatternDisplayProps> = ({
  patterns,
  dataIndex,
  price,
  onPatternClick,
}) => {
  if (patterns.length === 0) return null;

  return (
    <g>
      {patterns.map((pattern, idx) => {
        const patternConfig = AVAILABLE_CHART_PATTERNS.find(
          (p) => p.id === pattern.pattern
        );
        const color = patternConfig?.color || "#3B82F6";
        const signal = pattern.signal;

        // Calculate marker position
        const markerSize = 8;
        const offsetY =
          signal === "bullish"
            ? -markerSize - 2 // Above the price
            : signal === "bearish"
            ? markerSize + 2 // Below the price
            : 0; // At the price

        return (
          <g key={`${pattern.pattern}-${pattern.index}-${idx}`}>
            {/* Marker circle */}
            <circle
              cx={dataIndex}
              cy={price + offsetY}
              r={markerSize}
              fill={color}
              stroke="rgba(0, 0, 0, 0.5)"
              strokeWidth={1}
              opacity={0.8}
              className="cursor-pointer hover:opacity-100 transition-opacity"
              onClick={() => onPatternClick?.(pattern)}
            />
            {/* Signal icon */}
            {signal === "bullish" && (
              <TrendingUp
                x={dataIndex - 6}
                y={price + offsetY - 6}
                size={12}
                fill={color}
                className="pointer-events-none"
              />
            )}
            {signal === "bearish" && (
              <TrendingDown
                x={dataIndex - 6}
                y={price + offsetY - 6}
                size={12}
                fill={color}
                className="pointer-events-none"
              />
            )}
            {signal === "neutral" && (
              <Minus
                x={dataIndex - 6}
                y={price + offsetY - 6}
                size={12}
                fill={color}
                className="pointer-events-none"
              />
            )}
          </g>
        );
      })}
    </g>
  );
};

interface ChartPatternTooltipProps {
  pattern: PatternMatch | null;
  x: number;
  y: number;
  onClose: () => void;
}

export const ChartPatternTooltip: React.FC<ChartPatternTooltipProps> = ({
  pattern,
  x,
  y,
}) => {
  if (!pattern) return null;

  const patternConfig = AVAILABLE_CHART_PATTERNS.find(
    (p) => p.id === pattern.pattern
  );
  const color = patternConfig?.color || "#3B82F6";

  const getSignalIcon = () => {
    switch (pattern.signal) {
      case "bullish":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "bearish":
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute z-50 bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-lg p-3 shadow-2xl max-w-xs"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -100%)",
        marginTop: "-8px",
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h4 className="text-white font-semibold text-sm">
            {pattern.patternName}
          </h4>
          {getSignalIcon()}
        </div>
        <p className="text-white/80 text-xs leading-relaxed">
          {pattern.description}
        </p>
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Confidence:</span>
            <span className="text-xs text-white font-medium">
              {Math.round(pattern.confidence * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Candles:</span>
            <span className="text-xs text-white font-medium">
              {pattern.candles}
            </span>
          </div>
        </div>
        {patternConfig?.analysis && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-white/60 text-xs font-semibold mb-1">
              Analysis:
            </p>
            <p className="text-white/70 text-xs leading-relaxed">
              {patternConfig.analysis}
            </p>
          </div>
        )}
      </div>
      {/* Tooltip arrow */}
      <div
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full"
        style={{
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid rgba(255, 255, 255, 0.2)",
        }}
      />
    </motion.div>
  );
};

export default ChartPatternDisplay;
