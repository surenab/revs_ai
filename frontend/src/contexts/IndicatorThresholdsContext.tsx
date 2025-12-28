import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication status directly from localStorage to avoid dependency on AuthContext
  const isAuthenticated = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  };

  const fetchThresholds = useCallback(async () => {
    // Only fetch if user is authenticated
    if (!isAuthenticated()) {
      setLoading(false);
      setThresholds(DEFAULT_INDICATOR_THRESHOLDS);
      return;
    }

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
    } catch (err: any) {
      console.error("Failed to fetch indicator thresholds:", err);
      // Handle 401 errors gracefully - user is not authenticated
      if (err?.response?.status === 401) {
        // User is not authenticated, just use defaults
        setThresholds(DEFAULT_INDICATOR_THRESHOLDS);
        setError(null);
      } else {
        setError("Failed to load indicator thresholds");
        // Fallback to defaults
        setThresholds(DEFAULT_INDICATOR_THRESHOLDS);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check authentication and fetch thresholds on mount
    fetchThresholds();

    // Listen for storage changes (for cross-tab login/logout)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user') {
        fetchThresholds();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchThresholds]);

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
