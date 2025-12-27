import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { stockAPI } from "../../lib/api";
import type { StockPrice } from "../../lib/api";
import { format, subDays } from "date-fns";

interface StockPriceTooltipProps {
  stockSymbol: string;
  stockName?: string;
  children: React.ReactNode;
}

const StockPriceTooltip: React.FC<StockPriceTooltipProps> = ({
  stockSymbol,
  stockName,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [priceData, setPriceData] = useState<StockPrice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && stockSymbol && priceData.length === 0 && !isLoading) {
      fetchPriceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, stockSymbol]);

  const fetchPriceData = async () => {
    setIsLoading(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, 30); // Last 30 days

      const response = await stockAPI.getTimeSeries(stockSymbol, {
        interval: "1d",
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        limit: 30,
      });

      setPriceData(response.data.prices || []);
    } catch (error) {
      console.error("Failed to fetch price data:", error);
      setPriceData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
    updatePosition();
  };

  const handleMouseMove = () => {
    if (isVisible) {
      updatePosition();
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 300;
    const padding = 10;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.bottom + padding;

    // Adjust if tooltip goes off screen
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

    // If tooltip would go below viewport, show above
    if (top + tooltipHeight > window.innerHeight - padding) {
      top = rect.top - tooltipHeight - padding;
    }

    setPosition({ top, left });
  };

  const chartData = priceData.map((price) => ({
    date: format(new Date(price.date), "MMM dd"),
    price: price.close_price,
  }));

  const currentPrice =
    priceData.length > 0
      ? typeof priceData[priceData.length - 1].close_price === "number"
        ? priceData[priceData.length - 1].close_price
        : parseFloat(String(priceData[priceData.length - 1].close_price)) ||
          null
      : null;
  const previousPrice =
    priceData.length > 1
      ? typeof priceData[priceData.length - 2].close_price === "number"
        ? priceData[priceData.length - 2].close_price
        : parseFloat(String(priceData[priceData.length - 2].close_price)) ||
          null
      : null;
  const priceChange =
    currentPrice && previousPrice ? currentPrice - previousPrice : null;
  const priceChangePercent =
    currentPrice && previousPrice && previousPrice !== 0
      ? ((currentPrice - previousPrice) / previousPrice) * 100
      : null;

  const handleSymbolClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/stocks/${stockSymbol}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleSymbolClick}
        className="cursor-pointer hover:bg-green-500/30 transition-colors"
      >
        {children}
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: "400px",
          }}
        >
          <div className="mb-2">
            <h4 className="text-white font-semibold text-sm">{stockSymbol}</h4>
            {stockName && <p className="text-gray-400 text-xs">{stockName}</p>}
            {currentPrice && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white font-bold text-lg">
                  ${currentPrice.toFixed(2)}
                </span>
                {priceChange !== null &&
                  priceChangePercent !== null &&
                  typeof priceChange === "number" &&
                  typeof priceChangePercent === "number" && (
                    <span
                      className={`text-xs font-medium ${
                        priceChange >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {priceChange >= 0 ? "+" : ""}
                      {priceChange.toFixed(2)} (
                      {priceChangePercent >= 0 ? "+" : ""}
                      {priceChangePercent.toFixed(2)}%)
                    </span>
                  )}
              </div>
            )}
          </div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-600 border-t-blue-500"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  fontSize={10}
                  tick={{ fill: "#9CA3AF" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={10}
                  tick={{ fill: "#9CA3AF" }}
                  tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "6px",
                    color: "#F3F4F6",
                  }}
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10B981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No price data available
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default StockPriceTooltip;
