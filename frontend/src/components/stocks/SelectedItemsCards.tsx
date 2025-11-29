import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  ExternalLink,
} from "lucide-react";
import {
  AVAILABLE_INDICATORS,
  AVAILABLE_CHART_PATTERNS,
} from "../../utils/indicatorsConfig";
import type { Indicator } from "../../utils/indicatorsConfig";
import type { ChartPattern } from "../../utils/indicatorsConfig";

interface SelectedItemsCardsProps {
  selectedIndicators: string[];
  selectedPatterns: string[];
  onRemoveIndicator: (id: string) => void;
  onRemovePattern: (id: string) => void;
}

interface TooltipProps {
  item: Indicator | ChartPattern;
  children: React.ReactNode;
  position?: "top" | "right" | "left" | "bottom";
}

const Tooltip: React.FC<TooltipProps> = ({
  item,
  children,
  position = "top",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [calculatedPosition, setCalculatedPosition] = useState<
    "top" | "right" | "left" | "bottom"
  >(position);
  const [tooltipStyles, setTooltipStyles] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
      updateTooltipStyles(position);
      setTimeout(() => {
        calculatePosition();
      }, 10);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 300);
  };

  const handleTooltipMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(true);
  };

  const handleTooltipMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 300);
  };

  const calculatePosition = () => {
    if (!tooltipRef.current || !containerRef.current) return;

    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalPosition: "top" | "right" | "left" | "bottom" = position;

    if (position === "right") {
      if (rect.right + tooltipRect.width + 16 > viewportWidth) {
        if (rect.left - tooltipRect.width - 16 >= 0) {
          finalPosition = "left";
        } else {
          finalPosition = "top";
        }
      }
    } else if (position === "left") {
      if (rect.left - tooltipRect.width - 16 < 0) {
        if (rect.right + tooltipRect.width + 16 <= viewportWidth) {
          finalPosition = "right";
        } else {
          finalPosition = "top";
        }
      }
    }

    if (finalPosition === "top") {
      if (rect.top - tooltipRect.height - 16 < 0) {
        if (rect.bottom + tooltipRect.height + 16 <= viewportHeight) {
          finalPosition = "bottom";
        }
      }
    }

    setCalculatedPosition(finalPosition);
    updateTooltipStyles(finalPosition);
  };

  const updateTooltipStyles = (pos: "top" | "right" | "left" | "bottom") => {
    if (!containerRef.current || !tooltipRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = tooltipRect.width || 320;
    const tooltipHeight = tooltipRect.height || 200;
    const padding = 16;

    let styles: React.CSSProperties = {};

    switch (pos) {
      case "right": {
        const rightSpace = viewportWidth - containerRect.right;
        if (rightSpace >= tooltipWidth + padding) {
          styles = {
            left: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginLeft: "8px",
          };
        } else {
          // Not enough space on right, try left
          const leftSpace = containerRect.left;
          if (leftSpace >= tooltipWidth + padding) {
            styles = {
              right: "100%",
              top: "50%",
              transform: "translateY(-50%)",
              marginRight: "8px",
            };
          } else {
            // Not enough space on either side, use top/bottom
            const topSpace = containerRect.top;
            if (topSpace >= tooltipHeight + padding) {
              styles = {
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginBottom: "8px",
                maxWidth: `${Math.min(
                  tooltipWidth,
                  viewportWidth - padding * 2
                )}px`,
              };
            } else {
              styles = {
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginTop: "8px",
                maxWidth: `${Math.min(
                  tooltipWidth,
                  viewportWidth - padding * 2
                )}px`,
              };
            }
          }
        }
        break;
      }
      case "left": {
        const leftSpace = containerRect.left;
        if (leftSpace >= tooltipWidth + padding) {
          styles = {
            right: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginRight: "8px",
          };
        } else {
          // Not enough space on left, try right
          const rightSpace = viewportWidth - containerRect.right;
          if (rightSpace >= tooltipWidth + padding) {
            styles = {
              left: "100%",
              top: "50%",
              transform: "translateY(-50%)",
              marginLeft: "8px",
            };
          } else {
            // Not enough space on either side, use top/bottom
            const topSpace = containerRect.top;
            if (topSpace >= tooltipHeight + padding) {
              styles = {
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginBottom: "8px",
                maxWidth: `${Math.min(
                  tooltipWidth,
                  viewportWidth - padding * 2
                )}px`,
              };
            } else {
              styles = {
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginTop: "8px",
                maxWidth: `${Math.min(
                  tooltipWidth,
                  viewportWidth - padding * 2
                )}px`,
              };
            }
          }
        }
        break;
      }
      case "bottom": {
        const spaceBelow = viewportHeight - containerRect.bottom;
        if (spaceBelow >= tooltipHeight + padding) {
          styles = {
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "8px",
            maxWidth: `${Math.min(
              tooltipWidth,
              viewportWidth - padding * 2
            )}px`,
          };
        } else {
          // Not enough space below, use top
          styles = {
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            maxWidth: `${Math.min(
              tooltipWidth,
              viewportWidth - padding * 2
            )}px`,
          };
        }
        break;
      }
      default: {
        // top
        const topSpace = containerRect.top;
        if (topSpace >= tooltipHeight + padding) {
          styles = {
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            maxWidth: `${Math.min(
              tooltipWidth,
              viewportWidth - padding * 2
            )}px`,
          };
        } else {
          // Not enough space above, use bottom
          styles = {
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "8px",
            maxWidth: `${Math.min(
              tooltipWidth,
              viewportWidth - padding * 2
            )}px`,
          };
        }
      }
    }

    // Ensure tooltip doesn't go outside viewport horizontally
    if (styles.left !== undefined && typeof styles.left === "string") {
      const leftValue = parseFloat(styles.left);
      if (leftValue + tooltipWidth > viewportWidth - padding) {
        styles.left = `${viewportWidth - tooltipWidth - padding}px`;
      }
    }
    if (styles.right !== undefined && typeof styles.right === "string") {
      const rightValue = parseFloat(styles.right);
      if (rightValue + tooltipWidth > viewportWidth - padding) {
        styles.right = `${viewportWidth - tooltipWidth - padding}px`;
      }
    }

    setTooltipStyles(styles);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getArrowStyles = () => {
    switch (calculatedPosition) {
      case "right":
        return {
          left: "-6px",
          top: "50%",
          transform: "translateY(-50%)",
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
          borderRight: "6px solid rgba(255, 255, 255, 0.2)",
          borderLeft: "none",
        };
      case "left":
        return {
          right: "-6px",
          top: "50%",
          transform: "translateY(-50%)",
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
          borderLeft: "6px solid rgba(255, 255, 255, 0.2)",
          borderRight: "none",
        };
      case "bottom":
        return {
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: "-1px",
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderBottom: "6px solid rgba(255, 255, 255, 0.2)",
        };
      default: // top
        return {
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: "-1px",
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid rgba(255, 255, 255, 0.2)",
        };
    }
  };

  const hasContent = (item: Indicator | ChartPattern) => {
    if ("description" in item) {
      return item.description || ("analysis" in item && item.analysis);
    }
    return false;
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showTooltip && hasContent(item) && (
        <AnimatePresence>
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-[100] w-80 p-3 bg-gray-900 border border-white/20 rounded-lg shadow-2xl"
            style={tooltipStyles}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      "color" in item ? item.color || "#3B82F6" : "#3B82F6",
                  }}
                />
                <h4 className="text-white font-semibold text-sm">
                  {"name" in item ? item.name : ""}
                </h4>
              </div>
              {"description" in item && item.description && (
                <div>
                  <p className="text-white/80 text-xs leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )}
              {"analysis" in item && item.analysis && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white/60 text-xs font-semibold mb-1">
                    How to Analyze:
                  </p>
                  <p className="text-white/70 text-xs leading-relaxed">
                    {item.analysis}
                  </p>
                </div>
              )}
              <div className="pt-2 border-t border-white/10">
                <Link
                  to={
                    "category" in item
                      ? `/indicators/${item.id}`
                      : `/patterns/${item.id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  Learn more
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
            {/* Tooltip arrow */}
            <div
              className="absolute"
              style={{
                width: 0,
                height: 0,
                ...getArrowStyles(),
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

const SelectedItemsCards: React.FC<SelectedItemsCardsProps> = ({
  selectedIndicators,
  selectedPatterns,
  onRemoveIndicator,
  onRemovePattern,
}) => {
  if (selectedIndicators.length === 0 && selectedPatterns.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2 mt-4"
    >
      {/* Indicator Cards */}
      {selectedIndicators.map((indicatorId) => {
        const indicator = AVAILABLE_INDICATORS.find(
          (ind: Indicator) => ind.id === indicatorId
        );
        if (!indicator) return null;

        return (
          <Tooltip key={`indicator-${indicatorId}`} item={indicator}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg group hover:bg-blue-600/30 transition-colors cursor-help"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: indicator.color || "#3B82F6" }}
              />
              <span className="text-sm text-white font-medium">
                {indicator.name}
              </span>
              <Info className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveIndicator(indicatorId);
                }}
                className="ml-1 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          </Tooltip>
        );
      })}

      {/* Pattern Cards */}
      {selectedPatterns.map((patternId) => {
        const pattern = AVAILABLE_CHART_PATTERNS.find(
          (p: ChartPattern) => p.id === patternId
        );
        if (!pattern) return null;

        const getSignalColor = () => {
          switch (pattern.signal) {
            case "bullish":
              return "bg-green-500/20 border-green-500/30 text-green-400";
            case "bearish":
              return "bg-red-500/20 border-red-500/30 text-red-400";
            case "neutral":
              return "bg-yellow-500/20 border-yellow-500/30 text-yellow-400";
            default:
              return "bg-blue-500/20 border-blue-500/30 text-blue-400";
          }
        };

        const getSignalIcon = () => {
          switch (pattern.signal) {
            case "bullish":
              return <TrendingUp className="w-3 h-3" />;
            case "bearish":
              return <TrendingDown className="w-3 h-3" />;
            default:
              return <Minus className="w-3 h-3" />;
          }
        };

        return (
          <Tooltip key={`pattern-${patternId}`} item={pattern}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg group hover:opacity-80 transition-opacity cursor-help ${getSignalColor()}`}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: pattern.color || "#3B82F6" }}
              />
              {getSignalIcon()}
              <span className="text-sm font-medium">{pattern.name}</span>
              <Info className="w-3 h-3 opacity-60 group-hover:opacity-80 transition-opacity" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePattern(patternId);
                }}
                className="ml-1 hover:opacity-70 transition-opacity opacity-0 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          </Tooltip>
        );
      })}
    </motion.div>
  );
};

export default SelectedItemsCards;
