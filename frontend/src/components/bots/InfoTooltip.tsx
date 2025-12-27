import React, { useState, useRef, useEffect } from "react";
import { Info, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { TooltipDefinition } from "../../lib/botConstants";

interface InfoTooltipProps {
  tooltip?: TooltipDefinition | null;
  icon?: React.ReactNode;
  className?: string;
  showMoreLink?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  tooltip,
  icon,
  className = "",
  showMoreLink,
}) => {
  // Safety check: if tooltip is undefined or null, don't render
  if (!tooltip || !tooltip.title) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    side: "bottom" | "top" | "left" | "right";
    align: "left" | "right" | "center";
  }>({ side: "bottom", align: "left" });
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // Set a delay before closing to allow mouse movement to tooltip
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, 200); // 200ms delay
  };

  // Dynamic positioning to keep tooltip on screen
  useEffect(() => {
    if (isOpen && tooltipRef.current && containerRef.current) {
      const updatePosition = () => {
        if (!tooltipRef.current || !containerRef.current) return;

        const tooltip = tooltipRef.current;
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 10; // Padding from viewport edges

        let newSide: "bottom" | "top" | "left" | "right" = "bottom";
        let newAlign: "left" | "right" | "center" = "left";

        // Check if tooltip fits below
        const fitsBelow =
          containerRect.bottom + tooltipRect.height + padding <= viewportHeight;
        // Check if tooltip fits above
        const fitsAbove = containerRect.top - tooltipRect.height - padding >= 0;
        // Check if tooltip fits to the right
        const fitsRight =
          containerRect.right + tooltipRect.width + padding <= viewportWidth;
        // Check if tooltip fits to the left
        const fitsLeft = containerRect.left - tooltipRect.width - padding >= 0;

        // Determine best position
        if (fitsBelow) {
          newSide = "bottom";
          // Check horizontal alignment
          if (
            containerRect.left + tooltipRect.width >
            viewportWidth - padding
          ) {
            // Too wide for right side, align to right edge
            newAlign = "right";
          } else if (containerRect.left < padding) {
            // Too close to left edge
            newAlign = "left";
          } else {
            newAlign = "left";
          }
        } else if (fitsAbove) {
          newSide = "top";
          if (
            containerRect.left + tooltipRect.width >
            viewportWidth - padding
          ) {
            newAlign = "right";
          } else if (containerRect.left < padding) {
            newAlign = "left";
          } else {
            newAlign = "left";
          }
        } else if (fitsRight) {
          newSide = "right";
          newAlign = "center";
        } else if (fitsLeft) {
          newSide = "left";
          newAlign = "center";
        } else {
          // Default to bottom, but adjust alignment
          newSide = "bottom";
          if (containerRect.right > viewportWidth / 2) {
            newAlign = "right";
          } else {
            newAlign = "left";
          }
        }

        setPosition({ side: newSide, align: newAlign });
      };

      // Small delay to ensure tooltip is rendered
      const timeoutId = setTimeout(updatePosition, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  const getPositionClasses = () => {
    const sideClasses = {
      top: "bottom-full",
      bottom: "top-full",
      left: "right-full",
      right: "left-full",
    };

    const alignClasses = {
      left: "left-0",
      right: "right-0",
      center: "left-1/2 -translate-x-1/2",
    };

    const spacing = {
      top: "mb-2",
      bottom: "mt-2",
      left: "mr-2",
      right: "ml-2",
    };

    return `${sideClasses[position.side]} ${alignClasses[position.align]} ${
      spacing[position.side]
    }`;
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-blue-400 transition-colors"
        aria-label="Show information"
      >
        {icon || <Info className="w-4 h-4" />}
      </button>
      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-80 p-4 bg-gray-800 border border-gray-600 rounded-lg shadow-xl ${getPositionClasses()}`}
          style={{
            maxWidth: "min(320px, calc(100vw - 20px))", // Ensure it doesn't exceed viewport
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {tooltip?.title && (
            <h4 className="font-semibold text-white mb-2">{tooltip.title}</h4>
          )}
          {tooltip?.description && (
            <p className="text-sm text-gray-300 mb-2">{tooltip.description}</p>
          )}
          {tooltip.details && (
            <p className="text-xs text-gray-400 mb-2">{tooltip.details}</p>
          )}
          {tooltip.howItWorks && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-blue-400 mb-1">
                How it works:
              </p>
              <p className="text-xs text-gray-400">{tooltip.howItWorks}</p>
            </div>
          )}
          {tooltip.howBotUsesIt && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-green-400 mb-1">
                How bot uses it:
              </p>
              <p className="text-xs text-gray-400">{tooltip.howBotUsesIt}</p>
            </div>
          )}
          {tooltip.example && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-yellow-400 mb-1">
                Example:
              </p>
              <p className="text-xs text-gray-400 font-mono">
                {tooltip.example}
              </p>
            </div>
          )}
          {tooltip.impact && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-purple-400 mb-1">
                Impact:
              </p>
              <p className="text-xs text-gray-400">{tooltip.impact}</p>
            </div>
          )}
          {showMoreLink && (
            <div className="mt-3 pt-3 border-t border-gray-600">
              <Link
                to={showMoreLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              >
                <span>Show more</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
