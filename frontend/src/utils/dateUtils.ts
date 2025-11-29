import type { TimePeriod } from "../components/stocks/TimePeriodSelector";

/**
 * Calculate the start date for a given time period
 */
export const calculateStartDate = (period: TimePeriod): Date => {
  const now = new Date();

  if (period.isYTD) {
    // Year to date - start from January 1st of current year
    return new Date(now.getFullYear(), 0, 1);
  }

  if (period.days) {
    // Calculate date by subtracting days
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period.days);
    return startDate;
  }

  // Default to 1 day ago
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 1);
  return startDate;
};

/**
 * Calculate the end date for a given time period (usually current date)
 */
export const calculateEndDate = (): Date => {
  return new Date();
};

/**
 * Format date to YYYY-MM-DD string for API calls
 */
export const formatDateForAPI = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Format datetime to ISO string for API calls
 */
export const formatDateTimeForAPI = (date: Date): string => {
  return date.toISOString();
};

/**
 * Get the appropriate interval for intraday data based on the time period
 */
export const getIntradayInterval = (): string => {
  return "1m"; // 1-minute intervals for 1 day
};

/**
 * Get the appropriate interval for historical data
 */
export const getHistoricalInterval = (): string => {
  return "1d"; // Daily intervals for all historical periods
};

/**
 * Check if we should use intraday data for the current time
 * (only for 1D period and during market hours or recent)
 */
export const shouldUseIntradayData = (period: TimePeriod): boolean => {
  return period.value === "1D";
};

/**
 * Get current date in market timezone (assuming US Eastern)
 */
export const getCurrentMarketDate = (): Date => {
  // For simplicity, using local date. In production, you might want to use a proper timezone library
  return new Date();
};

/**
 * Check if current time is during market hours (9:30 AM - 4:00 PM ET)
 */
export const isMarketHours = (): boolean => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 100 + minutes;

  // Market hours: 9:30 AM (930) to 4:00 PM (1600) ET
  // Note: This is simplified and doesn't account for timezone conversion
  return currentTime >= 930 && currentTime <= 1600;
};

/**
 * Get the start of the current trading day
 */
export const getTradingDayStart = (): Date => {
  const now = new Date();
  const tradingStart = new Date(now);
  tradingStart.setHours(9, 30, 0, 0); // 9:30 AM

  // If it's before market open, use previous trading day
  if (now < tradingStart) {
    tradingStart.setDate(tradingStart.getDate() - 1);
  }

  return tradingStart;
};

/**
 * Calculate appropriate limit for API calls based on period
 * Note: API has a maximum limit of 1000 records
 */
export const getDataLimit = (period: TimePeriod): number => {
  switch (period.value) {
    case "1D":
      return 390; // ~6.5 hours * 60 minutes (market hours)
    case "5D":
      return 5; // 5 days
    case "1M":
      return 30; // 30 days
    case "6M":
      return 180; // ~6 months
    case "YTD":
      return 365; // Current year (max ~365 days)
    case "1Y":
      return 365; // 1 year (365 days)
    case "5Y":
      return 10000; // 5 years (limited to API max of 10000 records)
    case "10Y":
      return 10000; // 10 years (limited to API max of 10000 records)
    default:
      return 100;
  }
};
