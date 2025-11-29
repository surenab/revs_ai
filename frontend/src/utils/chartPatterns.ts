/**
 * Chart Pattern Detection Utilities
 * Detects candlestick patterns in price data
 */

import type { PriceData } from "./technicalIndicators";

export interface Candlestick {
  open: number;
  high: number;
  low: number;
  close: number;
  index: number;
}

export interface PatternMatch {
  pattern: string;
  patternName: string;
  index: number; // Index of the last candle in the pattern
  candles: number; // Number of candles in the pattern
  signal: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-1 confidence score
  description: string;
}

/**
 * Helper function to check if a candle is bullish (close > open)
 */
function isBullish(candle: Candlestick): boolean {
  return candle.close > candle.open;
}

/**
 * Helper function to check if a candle is bearish (close < open)
 */
function isBearish(candle: Candlestick): boolean {
  return candle.close < candle.open;
}

/**
 * Helper function to check if a candle is a doji (open ≈ close)
 */
function isDoji(candle: Candlestick, threshold: number = 0.001): boolean {
  const bodySize = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  return range > 0 && bodySize / range < threshold;
}

/**
 * Helper function to get candle body size
 */
function getBodySize(candle: Candlestick): number {
  return Math.abs(candle.close - candle.open);
}

/**
 * Helper function to get upper wick size
 */
function getUpperWick(candle: Candlestick): number {
  return candle.high - Math.max(candle.open, candle.close);
}

/**
 * Helper function to get lower wick size
 */
function getLowerWick(candle: Candlestick): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

/**
 * Helper function to check if a candle is a spinning top
 */
function isSpinningTop(candle: Candlestick): boolean {
  const bodySize = getBodySize(candle);
  const upperWick = getUpperWick(candle);
  const lowerWick = getLowerWick(candle);
  const range = candle.high - candle.low;

  if (range === 0) return false;

  return (
    bodySize / range < 0.3 && // Small body
    upperWick / range > 0.3 && // Long upper wick
    lowerWick / range > 0.3 // Long lower wick
  );
}

/**
 * Convert PriceData to Candlestick
 */
function toCandlestick(data: PriceData, index: number): Candlestick | null {
  if (
    data.open === undefined ||
    data.high === undefined ||
    data.low === undefined ||
    data.close === undefined
  ) {
    return null;
  }

  return {
    open: data.open,
    high: data.high,
    low: data.low,
    close: data.close,
    index,
  };
}

/**
 * Three White Soldiers - Bullish reversal pattern (3 candles)
 */
export function detectThreeWhiteSoldiers(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 2; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 2], i - 2);
    const c2 = toCandlestick(data[i - 1], i - 1);
    const c3 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3) continue;

    // All three candles should be bullish
    if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) continue;

    // Each candle should close higher than the previous
    if (c2.close <= c1.close || c3.close <= c2.close) continue;

    // Each candle should open within the previous candle's body
    if (c2.open <= c1.open || c3.open <= c2.open) continue;

    // All candles should have relatively small wicks
    const range1 = c1.high - c1.low;
    const range2 = c2.high - c2.low;
    const range3 = c3.high - c3.low;

    if (range1 === 0 || range2 === 0 || range3 === 0) continue;

    const wickRatio1 = (getUpperWick(c1) + getLowerWick(c1)) / range1;
    const wickRatio2 = (getUpperWick(c2) + getLowerWick(c2)) / range2;
    const wickRatio3 = (getUpperWick(c3) + getLowerWick(c3)) / range3;

    if (wickRatio1 > 0.4 || wickRatio2 > 0.4 || wickRatio3 > 0.4) continue;

    matches.push({
      pattern: "three_white_soldiers",
      patternName: "Three White Soldiers",
      index: i,
      candles: 3,
      signal: "bullish",
      confidence: 0.8,
      description:
        "Strong bullish reversal pattern. Three consecutive bullish candles with each closing higher than the previous.",
    });
  }

  return matches;
}

/**
 * Morning Doji Star - Bullish reversal pattern (3 candles)
 */
export function detectMorningDojiStar(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 2; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 2], i - 2);
    const c2 = toCandlestick(data[i - 1], i - 1);
    const c3 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3) continue;

    // First candle should be bearish
    if (!isBearish(c1)) continue;

    // Second candle should be a doji with a gap
    if (!isDoji(c2, 0.1)) continue;
    if (c2.low >= c1.close) continue; // Gap down

    // Third candle should be bullish and close above the midpoint of first candle
    if (!isBullish(c3)) continue;
    const firstMidpoint = (c1.open + c1.close) / 2;
    if (c3.close <= firstMidpoint) continue;

    matches.push({
      pattern: "morning_doji_star",
      patternName: "Morning Doji Star",
      index: i,
      candles: 3,
      signal: "bullish",
      confidence: 0.85,
      description:
        "Bullish reversal pattern. A bearish candle, followed by a doji with a gap down, then a bullish candle closing above the first candle's midpoint.",
    });
  }

  return matches;
}

/**
 * Abandoned Baby - Bullish reversal pattern (3 candles)
 */
export function detectAbandonedBaby(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 2; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 2], i - 2);
    const c2 = toCandlestick(data[i - 1], i - 1);
    const c3 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3) continue;

    // First candle should be bearish
    if (!isBearish(c1)) continue;

    // Second candle should be a doji with gaps on both sides
    if (!isDoji(c2, 0.1)) continue;
    if (c2.high >= c1.low || c2.low <= c1.close) continue; // Gap down
    if (c3.low <= c2.high || c3.high <= c2.low) continue; // Gap up

    // Third candle should be bullish
    if (!isBullish(c3)) continue;

    matches.push({
      pattern: "abandoned_baby",
      patternName: "Abandoned Baby",
      index: i,
      candles: 3,
      signal: "bullish",
      confidence: 0.9,
      description:
        "Strong bullish reversal pattern. A bearish candle, followed by a doji with gaps on both sides, then a bullish candle.",
    });
  }

  return matches;
}

/**
 * Tri Star - Reversal pattern (3 candles, all dojis)
 */
export function detectTriStar(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 2; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 2], i - 2);
    const c2 = toCandlestick(data[i - 1], i - 1);
    const c3 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3) continue;

    // All three candles should be dojis
    if (!isDoji(c1, 0.1) || !isDoji(c2, 0.1) || !isDoji(c3, 0.1)) continue;

    // There should be gaps between the candles
    if (c2.low <= c1.high || c3.low <= c2.high) continue;

    // Determine signal based on position
    const signal = c3.close > c1.close ? "bullish" : "bearish";

    matches.push({
      pattern: "tri_star",
      patternName: "Tri Star",
      index: i,
      candles: 3,
      signal,
      confidence: 0.75,
      description:
        "Reversal pattern. Three consecutive doji candles with gaps between them, indicating indecision and potential reversal.",
    });
  }

  return matches;
}

/**
 * Advance Block - Bearish reversal pattern (3 candles)
 */
export function detectAdvanceBlock(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 2; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 2], i - 2);
    const c2 = toCandlestick(data[i - 1], i - 1);
    const c3 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3) continue;

    // All three candles should be bullish
    if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) continue;

    // Each candle should close higher than the previous
    if (c2.close <= c1.close || c3.close <= c2.close) continue;

    // But the bodies should be getting smaller (weakening momentum)
    const body1 = getBodySize(c1);
    const body2 = getBodySize(c2);
    const body3 = getBodySize(c3);

    if (body2 >= body1 || body3 >= body2) continue;

    // Upper wicks should be getting longer
    const wick1 = getUpperWick(c1);
    const wick2 = getUpperWick(c2);
    const wick3 = getUpperWick(c3);

    if (wick2 <= wick1 || wick3 <= wick2) continue;

    matches.push({
      pattern: "advance_block",
      patternName: "Advance Block",
      index: i,
      candles: 3,
      signal: "bearish",
      confidence: 0.7,
      description:
        "Bearish reversal pattern. Three bullish candles with decreasing body sizes and increasing upper wicks, indicating weakening upward momentum.",
    });
  }

  return matches;
}

/**
 * Conceal Baby Swallow - Bullish continuation pattern (4 candles)
 */
export function detectConcealBabySwallow(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 3; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 3], i - 3);
    const c2 = toCandlestick(data[i - 2], i - 2);
    const c3 = toCandlestick(data[i - 1], i - 1);
    const c4 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3 || !c4) continue;

    // First two candles should be bearish marubozu (no wicks)
    if (!isBearish(c1) || !isBearish(c2)) continue;
    if (getUpperWick(c1) > 0.01 || getLowerWick(c1) > 0.01) continue;
    if (getUpperWick(c2) > 0.01 || getLowerWick(c2) > 0.01) continue;

    // Third candle should gap down and be bearish
    if (c3.low >= c2.close) continue; // Gap down
    if (!isBearish(c3)) continue;

    // Fourth candle should be a small bearish candle within the third candle's range
    if (!isBearish(c4)) continue;
    if (c4.high > c3.high || c4.low < c3.low) continue;
    if (getBodySize(c4) >= getBodySize(c3)) continue;

    matches.push({
      pattern: "conceal_baby_swallow",
      patternName: "Conceal Baby Swallow",
      index: i,
      candles: 4,
      signal: "bullish",
      confidence: 0.8,
      description:
        "Bullish continuation pattern. Two bearish marubozu candles, followed by a gap down bearish candle, then a smaller bearish candle, indicating potential reversal.",
    });
  }

  return matches;
}

/**
 * Stick Sandwich - Bullish reversal pattern (3 candles)
 */
export function detectStickSandwich(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 2; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 2], i - 2);
    const c2 = toCandlestick(data[i - 1], i - 1);
    const c3 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3) continue;

    // First and third candles should be bearish with similar closes
    if (!isBearish(c1) || !isBearish(c3)) continue;
    const closeDiff = Math.abs(c1.close - c3.close) / c1.close;
    if (closeDiff > 0.02) continue; // Closes should be within 2%

    // Second candle should be bullish and close above both first and third
    if (!isBullish(c2)) continue;
    if (c2.close <= c1.close || c2.close <= c3.close) continue;

    matches.push({
      pattern: "stick_sandwich",
      patternName: "Stick Sandwich",
      index: i,
      candles: 3,
      signal: "bullish",
      confidence: 0.75,
      description:
        "Bullish reversal pattern. Two bearish candles with similar closes sandwiching a bullish candle that closes above both.",
    });
  }

  return matches;
}

/**
 * Morning Star - Bullish reversal pattern (3 candles)
 */
export function detectMorningStar(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 2; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 2], i - 2);
    const c2 = toCandlestick(data[i - 1], i - 1);
    const c3 = toCandlestick(data[i], i);

    if (!c1 || !c2 || !c3) continue;

    // First candle should be bearish
    if (!isBearish(c1)) continue;

    // Second candle should have a small body (can be bullish or bearish)
    const body2 = getBodySize(c2);
    const range2 = c2.high - c2.low;
    if (range2 === 0 || body2 / range2 > 0.3) continue;

    // There should be a gap between first and second candle
    if (c2.low >= c1.close) continue; // Gap down

    // Third candle should be bullish and close above the midpoint of first candle
    if (!isBullish(c3)) continue;
    const firstMidpoint = (c1.open + c1.close) / 2;
    if (c3.close <= firstMidpoint) continue;

    matches.push({
      pattern: "morning_star",
      patternName: "Morning Star",
      index: i,
      candles: 3,
      signal: "bullish",
      confidence: 0.8,
      description:
        "Bullish reversal pattern. A bearish candle, followed by a small body candle with a gap down, then a bullish candle closing above the first candle's midpoint.",
    });
  }

  return matches;
}

/**
 * Kicking - Strong reversal pattern (2 candles)
 */
export function detectKicking(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 1; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 1], i - 1);
    const c2 = toCandlestick(data[i], i);

    if (!c1 || !c2) continue;

    // First candle should be bearish marubozu (no wicks)
    if (!isBearish(c1)) continue;
    if (getUpperWick(c1) > 0.01 || getLowerWick(c1) > 0.01) continue;

    // Second candle should be bullish marubozu with a gap up
    if (!isBullish(c2)) continue;
    if (getUpperWick(c2) > 0.01 || getLowerWick(c2) > 0.01) continue;
    if (c2.low <= c1.high) continue; // Gap up

    matches.push({
      pattern: "kicking",
      patternName: "Kicking",
      index: i,
      candles: 2,
      signal: "bullish",
      confidence: 0.9,
      description:
        "Strong bullish reversal pattern. A bearish marubozu followed by a bullish marubozu with a gap up, indicating strong momentum shift.",
    });
  }

  return matches;
}

/**
 * Spinning Top - Indecision pattern (1 candle)
 */
export function detectSpinningTop(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 0; i < data.length; i++) {
    const c = toCandlestick(data[i], i);
    if (!c) continue;

    if (isSpinningTop(c)) {
      matches.push({
        pattern: "spinning_top",
        patternName: "Spinning Top",
        index: i,
        candles: 1,
        signal: "neutral",
        confidence: 0.6,
        description:
          "Indecision pattern. A candle with a small body and long wicks on both sides, indicating market uncertainty.",
      });
    }
  }

  return matches;
}

/**
 * Engulfing - Reversal pattern (2 candles)
 */
export function detectEngulfing(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 1; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 1], i - 1);
    const c2 = toCandlestick(data[i], i);

    if (!c1 || !c2) continue;

    // Bullish engulfing: first bearish, second bullish
    if (isBearish(c1) && isBullish(c2)) {
      if (c2.open < c1.close && c2.close > c1.open) {
        matches.push({
          pattern: "engulfing",
          patternName: "Bullish Engulfing",
          index: i,
          candles: 2,
          signal: "bullish",
          confidence: 0.75,
          description:
            "Bullish reversal pattern. A bearish candle followed by a larger bullish candle that completely engulfs the first candle's body.",
        });
      }
    }

    // Bearish engulfing: first bullish, second bearish
    if (isBullish(c1) && isBearish(c2)) {
      if (c2.open > c1.close && c2.close < c1.open) {
        matches.push({
          pattern: "engulfing",
          patternName: "Bearish Engulfing",
          index: i,
          candles: 2,
          signal: "bearish",
          confidence: 0.75,
          description:
            "Bearish reversal pattern. A bullish candle followed by a larger bearish candle that completely engulfs the first candle's body.",
        });
      }
    }
  }

  return matches;
}

/**
 * Homing Pigeon - Bullish reversal pattern (2 candles)
 */
export function detectHomingPigeon(
  data: PriceData[]
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (let i = 1; i < data.length; i++) {
    const c1 = toCandlestick(data[i - 1], i - 1);
    const c2 = toCandlestick(data[i], i);

    if (!c1 || !c2) continue;

    // Both candles should be bearish
    if (!isBearish(c1) || !isBearish(c2)) continue;

    // Second candle should be completely within the first candle's range
    if (c2.high > c1.high || c2.low < c1.low) continue;

    // Second candle should have a smaller body
    if (getBodySize(c2) >= getBodySize(c1)) continue;

    matches.push({
      pattern: "homing_pigeon",
      patternName: "Homing Pigeon",
      index: i,
      candles: 2,
      signal: "bullish",
      confidence: 0.7,
      description:
        "Bullish reversal pattern. Two bearish candles where the second is completely contained within the first, indicating weakening bearish momentum.",
    });
  }

  return matches;
}

/**
 * Detect all patterns in the data
 */
export function detectAllPatterns(
  data: PriceData[],
  selectedPatterns: string[] = []
): PatternMatch[] {
  const allMatches: PatternMatch[] = [];

  const patternDetectors: Record<string, (data: PriceData[]) => PatternMatch[]> =
    {
      three_white_soldiers: detectThreeWhiteSoldiers,
      morning_doji_star: detectMorningDojiStar,
      abandoned_baby: detectAbandonedBaby,
      tri_star: detectTriStar,
      advance_block: detectAdvanceBlock,
      conceal_baby_swallow: detectConcealBabySwallow,
      stick_sandwich: detectStickSandwich,
      morning_star: detectMorningStar,
      kicking: detectKicking,
      spinning_top: detectSpinningTop,
      engulfing: detectEngulfing,
      homing_pigeon: detectHomingPigeon,
    };

  const patternsToDetect =
    selectedPatterns.length > 0
      ? selectedPatterns
      : Object.keys(patternDetectors);

  patternsToDetect.forEach((patternId) => {
    const detector = patternDetectors[patternId];
    if (detector) {
      const matches = detector(data);
      allMatches.push(...matches);
    }
  });

  // Sort by index
  return allMatches.sort((a, b) => a.index - b.index);
}
