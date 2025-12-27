import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  getDefaultIndicatorThresholds,
  type DefaultIndicatorThresholds,
} from "../lib/api";
import { DEFAULT_INDICATOR_THRESHOLDS } from "../lib/botConstants";

interface IndicatorThresholdsContextType {
  thresholds: DefaultIndicatorThresholds;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const IndicatorThresholdsContext = createContext<
  IndicatorThresholdsContextType | undefined
>(undefined);

interface IndicatorThresholdsProviderProps {
  children: ReactNode;
}

export const IndicatorThresholdsProvider: React.FC<
  IndicatorThresholdsProviderProps
> = ({ children }) => {
  const [thresholds, setThresholds] = useState<DefaultIndicatorThresholds>(
    DEFAULT_INDICATOR_THRESHOLDS
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThresholds = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetched = await getDefaultIndicatorThresholds();
      if (Object.keys(fetched).length > 0) {
        // Merge fetched values with defaults to ensure all keys exist
        const merged = { ...DEFAULT_INDICATOR_THRESHOLDS };
        for (const [key, value] of Object.entries(fetched)) {
          merged[key] = { ...DEFAULT_INDICATOR_THRESHOLDS[key], ...value };
        }
        setThresholds(merged);
      } else {
        // Use defaults if API returns empty
        setThresholds(DEFAULT_INDICATOR_THRESHOLDS);
      }
    } catch (err) {
      console.error("Failed to fetch indicator thresholds:", err);
      setError("Failed to load indicator thresholds");
      // Fallback to defaults
      setThresholds(DEFAULT_INDICATOR_THRESHOLDS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThresholds();
  }, []);

  return (
    <IndicatorThresholdsContext.Provider
      value={{
        thresholds,
        loading,
        error,
        refresh: fetchThresholds,
      }}
    >
      {children}
    </IndicatorThresholdsContext.Provider>
  );
};

export const useIndicatorThresholds = (): IndicatorThresholdsContextType => {
  const context = useContext(IndicatorThresholdsContext);
  if (context === undefined) {
    throw new Error(
      "useIndicatorThresholds must be used within an IndicatorThresholdsProvider"
    );
  }
  return context;
};
