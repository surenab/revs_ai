/**
 * Technical Indicators Calculation Utilities
 * All indicators are calculated from price data (OHLCV)
 */

export interface PriceData {
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  timestamp?: string;
  date?: string;
}

export interface IndicatorResult {
  value: number | null;
  upper?: number | null;
  lower?: number | null;
  signal?: number | null;
}

/**
 * Helper function to convert a value to a number, handling strings
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? null : value;
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? null : num;
  }
  return null;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: PriceData[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      // Convert all close values to numbers and check if they're valid
      const closeValues = slice.map((d) => toNumber(d.close));
      const allValid = closeValues.every((val) => val !== null);

      if (!allValid) {
        result.push(null);
      } else {
        const sum = closeValues.reduce((acc, val) => acc + (val as number), 0);
        const avg = sum / period;
        // Return null if the average is invalid (shouldn't happen if all values are valid)
        result.push(isNaN(avg) || !isFinite(avg) ? null : avg);
      }
    }
  }

  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data: PriceData[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[i].close);
    } else if (i < period - 1) {
      // Use SMA for initial values
      const sum = data.slice(0, i + 1).reduce((acc, d) => acc + d.close, 0);
      result.push(sum / (i + 1));
    } else {
      const prevEMA = result[i - 1]!;
      result.push((data[i].close - prevEMA) * multiplier + prevEMA);
    }
  }

  return result;
}

/**
 * Weighted Moving Average (WMA)
 */
export function calculateWMA(data: PriceData[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let weightedSum = 0;
      let weightSum = 0;
      for (let j = 0; j < period; j++) {
        const weight = period - j;
        weightedSum += data[i - j].close * weight;
        weightSum += weight;
      }
      result.push(weightedSum / weightSum);
    }
  }

  return result;
}

/**
 * Double Exponential Moving Average (DEMA)
 */
export function calculateDEMA(data: PriceData[], period: number): (number | null)[] {
  const ema1 = calculateEMA(data, period);
  const ema2 = calculateEMA(
    ema1.map((val, idx) => ({ close: val || data[idx].close })),
    period
  );

  return ema1.map((val, idx) => {
    if (val === null || ema2[idx] === null) return null;
    return 2 * val - ema2[idx]!;
  });
}

/**
 * Triple Exponential Moving Average (TEMA)
 */
export function calculateTEMA(data: PriceData[], period: number): (number | null)[] {
  const ema1 = calculateEMA(data, period);
  const ema2 = calculateEMA(
    ema1.map((val, idx) => ({ close: val || data[idx].close })),
    period
  );
  const ema3 = calculateEMA(
    ema2.map((val, idx) => ({ close: val || data[idx].close })),
    period
  );

  return ema1.map((val, idx) => {
    if (val === null || ema2[idx] === null || ema3[idx] === null) return null;
    return 3 * val - 3 * ema2[idx]! + ema3[idx]!;
  });
}

/**
 * Triangular Moving Average (TMA)
 */
export function calculateTMA(data: PriceData[], period: number): (number | null)[] {
  const sma = calculateSMA(data, Math.ceil(period / 2));
  return calculateSMA(
    sma.map((val, idx) => ({ close: val || data[idx].close })),
    Math.ceil(period / 2)
  );
}

/**
 * Hull Moving Average (HMA)
 */
export function calculateHMA(data: PriceData[], period: number): (number | null)[] {
  const wma1 = calculateWMA(data, Math.floor(period / 2));
  const wma2 = calculateWMA(data, period);

  const diff = wma1.map((val, idx) => {
    if (val === null || wma2[idx] === null) return null;
    return 2 * val - wma2[idx]!;
  });

  return calculateWMA(
    diff.map((val, idx) => ({ close: val || data[idx].close })),
    Math.floor(Math.sqrt(period))
  );
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  data: PriceData[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const sma = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const mean = sma[i]!;
      const slice = data.slice(i - period + 1, i + 1);
      const variance = slice.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);

      upper.push(mean + stdDev * standardDeviation);
      lower.push(mean - stdDev * standardDeviation);
    }
  }

  return { upper, middle: sma, lower };
}

/**
 * Parabolic SAR (PSAR)
 */
export function calculatePSAR(
  data: PriceData[],
  acceleration: number = 0.02,
  maximum: number = 0.2
): (number | null)[] {
  const result: (number | null)[] = [];

  if (data.length < 2) {
    return data.map(() => null);
  }

  let sar = data[0].low || data[0].close;
  let ep = data[0].high || data[0].close;
  let af = acceleration;
  let trend = 1; // 1 for uptrend, -1 for downtrend

  result.push(sar);

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high || data[i].close;
    const low = data[i].low || data[i].close;

    if (trend === 1) {
      sar = sar + af * (ep - sar);
      if (low < sar) {
        trend = -1;
        sar = ep;
        ep = low;
        af = acceleration;
      } else {
        if (high > ep) {
          ep = high;
          af = Math.min(af + acceleration, maximum);
        }
      }
    } else {
      sar = sar + af * (ep - sar);
      if (high > sar) {
        trend = 1;
        sar = ep;
        ep = high;
        af = acceleration;
      } else {
        if (low < ep) {
          ep = low;
          af = Math.min(af + acceleration, maximum);
        }
      }
    }

    result.push(sar);
  }

  return result;
}

/**
 * Supertrend
 */
export function calculateSupertrend(
  data: PriceData[],
  period: number = 10,
  multiplier: number = 3
): { value: (number | null)[]; trend: (number | null)[] } {
  const atr = calculateATR(data, period);
  const hl2 = data.map(d => ((d.high || d.close) + (d.low || d.close)) / 2);

  const upperBand: (number | null)[] = [];
  const lowerBand: (number | null)[] = [];
  const supertrend: (number | null)[] = [];
  const trend: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      upperBand.push(null);
      lowerBand.push(null);
      supertrend.push(null);
      trend.push(null);
    } else {
      const atrValue = atr[i] || 0;
      const hl2Value = hl2[i];

      upperBand.push(hl2Value + multiplier * atrValue);
      lowerBand.push(hl2Value - multiplier * atrValue);

      if (i === period) {
        supertrend.push(upperBand[i]);
        trend.push(1);
      } else {
        const prevSupertrend = supertrend[i - 1]!;
        const prevTrend = trend[i - 1]!;
        const close = data[i].close;

        let newSupertrend: number;
        let newTrend: number;

        if (prevTrend === 1) {
          newSupertrend = Math.max(lowerBand[i]!, prevSupertrend);
          newTrend = close > newSupertrend ? 1 : -1;
        } else {
          newSupertrend = Math.min(upperBand[i]!, prevSupertrend);
          newTrend = close < newSupertrend ? -1 : 1;
        }

        supertrend.push(newSupertrend);
        trend.push(newTrend);
      }
    }
  }

  return { value: supertrend, trend };
}

/**
 * Alligator (Jaw, Teeth, Lips)
 */
export function calculateAlligator(data: PriceData[]): {
  jaw: (number | null)[];
  teeth: (number | null)[];
  lips: (number | null)[];
} {
  const jaw = calculateSMA(data, 13).map((val, idx) =>
    val ? val + (data[idx].high || data[idx].close) - (data[idx].low || data[idx].close) : null
  );
  const teeth = calculateSMA(data, 8).map((val, idx) =>
    val ? val + (data[idx].high || data[idx].close) - (data[idx].low || data[idx].close) : null
  );
  const lips = calculateSMA(data, 5).map((val, idx) =>
    val ? val + (data[idx].high || data[idx].close) - (data[idx].low || data[idx].close) : null
  );

  return { jaw, teeth, lips };
}

/**
 * Ichimoku Cloud
 */
export function calculateIchimoku(data: PriceData[]): {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
} {
  const tenkan: (number | null)[] = [];
  const kijun: (number | null)[] = [];
  const senkouA: (number | null)[] = [];
  const senkouB: (number | null)[] = [];
  const chikou: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    // Tenkan-sen (9 periods)
    if (i < 8) {
      tenkan.push(null);
    } else {
      const high9 = Math.max(...data.slice(i - 8, i + 1).map(d => d.high || d.close));
      const low9 = Math.min(...data.slice(i - 8, i + 1).map(d => d.low || d.close));
      tenkan.push((high9 + low9) / 2);
    }

    // Kijun-sen (26 periods)
    if (i < 25) {
      kijun.push(null);
    } else {
      const high26 = Math.max(...data.slice(i - 25, i + 1).map(d => d.high || d.close));
      const low26 = Math.min(...data.slice(i - 25, i + 1).map(d => d.low || d.close));
      kijun.push((high26 + low26) / 2);
    }

    // Senkou Span A (shifted forward 26 periods)
    if (i < 25) {
      senkouA.push(null);
    } else {
      const tenkanVal = tenkan[i - 26] || tenkan[i];
      const kijunVal = kijun[i - 26] || kijun[i];
      if (tenkanVal !== null && kijunVal !== null) {
        senkouA.push((tenkanVal + kijunVal) / 2);
      } else {
        senkouA.push(null);
      }
    }

    // Senkou Span B (52 periods, shifted forward 26)
    if (i < 51) {
      senkouB.push(null);
    } else {
      const high52 = Math.max(...data.slice(i - 51, i - 25).map(d => d.high || d.close));
      const low52 = Math.min(...data.slice(i - 51, i - 25).map(d => d.low || d.close));
      senkouB.push((high52 + low52) / 2);
    }

    // Chikou Span (shifted backward 26 periods)
    if (i < 26) {
      chikou.push(null);
    } else {
      chikou.push(data[i - 26].close);
    }
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

/**
 * ATR (Average True Range) - helper for other indicators
 */
export function calculateATR(data: PriceData[], period: number = 14): (number | null)[] {
  const tr: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push((data[i].high || data[i].close) - (data[i].low || data[i].close));
    } else {
      const high = data[i].high || data[i].close;
      const low = data[i].low || data[i].close;
      const prevClose = data[i - 1].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      tr.push(Math.max(tr1, tr2, tr3));
    }
  }

  // Calculate ATR as SMA of TR
  return calculateSMA(tr.map(val => ({ close: val })), period);
}

/**
 * ATR Trailing Stop Loss
 */
export function calculateATRTrailingStop(
  data: PriceData[],
  period: number = 14,
  multiplier: number = 2
): (number | null)[] {
  const atr = calculateATR(data, period);
  const result: (number | null)[] = [];

  let stopLoss: number | null = null;
  let trend: number = 1; // 1 for uptrend, -1 for downtrend

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      const close = data[i].close;
      const atrValue = atr[i] || 0;

      if (stopLoss === null) {
        stopLoss = close - multiplier * atrValue;
        trend = 1;
      } else {
        if (trend === 1) {
          const newStopLoss = close - multiplier * atrValue;
          stopLoss = Math.max(stopLoss, newStopLoss);
          if (close < stopLoss) {
            trend = -1;
            stopLoss = close + multiplier * atrValue;
          }
        } else {
          const newStopLoss = close + multiplier * atrValue;
          stopLoss = Math.min(stopLoss, newStopLoss);
          if (close > stopLoss) {
            trend = 1;
            stopLoss = close - multiplier * atrValue;
          }
        }
      }

      result.push(stopLoss);
    }
  }

  return result;
}

/**
 * Donchian Channel
 */
export function calculateDonchianChannel(
  data: PriceData[],
  period: number = 20
): { upper: (number | null)[]; lower: (number | null)[]; middle: (number | null)[] } {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const middle: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
      middle.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const high = Math.max(...slice.map(d => d.high || d.close));
      const low = Math.min(...slice.map(d => d.low || d.close));

      upper.push(high);
      lower.push(low);
      middle.push((high + low) / 2);
    }
  }

  return { upper, lower, middle };
}

/**
 * Fractal Chaos Bands
 */
export function calculateFractalChaosBands(
  data: PriceData[],
  period: number = 5
): { upper: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const highs = slice.map(d => d.high || d.close);
      const lows = slice.map(d => d.low || d.close);

      upper.push(Math.max(...highs));
      lower.push(Math.min(...lows));
    }
  }

  return { upper, lower };
}

/**
 * Linear Regression Forecast
 */
export function calculateLinearRegressionForecast(
  data: PriceData[],
  period: number = 14
): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const n = slice.length;

      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;

      slice.forEach((d, idx) => {
        const x = idx + 1;
        const y = d.close;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Forecast next value
      result.push(slope * (n + 1) + intercept);
    }
  }

  return result;
}

/**
 * McGinley Dynamic Indicator
 */
export function calculateMcGinleyDynamic(
  data: PriceData[],
  period: number = 14
): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[i].close);
    } else {
      const prevMD = result[i - 1]!;
      const close = data[i].close;
      const k = period;

      const md = prevMD + (close - prevMD) / (k * Math.pow(close / prevMD, 4));
      result.push(md);
    }
  }

  return result;
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(data: PriceData[]): (number | null)[] {
  const result: (number | null)[] = [];
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const high = data[i].high || data[i].close;
    const low = data[i].low || data[i].close;
    const close = data[i].close;
    const volume = data[i].volume || 0;

    const typicalPrice = (high + low + close) / 3;
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    if (cumulativeVolume === 0) {
      result.push(null);
    } else {
      result.push(cumulativeTPV / cumulativeVolume);
    }
  }

  return result;
}

/**
 * VWAP Moving Average
 */
export function calculateVWAPMA(data: PriceData[], period: number = 20): (number | null)[] {
  const vwap = calculateVWAP(data);
  return calculateSMA(
    vwap.map((val, idx) => ({ close: val || data[idx].close })),
    period
  );
}

/**
 * Keltner Channel
 */
export function calculateKeltnerChannel(
  data: PriceData[],
  period: number = 20,
  multiplier: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const ema = calculateEMA(data, period);
  const atr = calculateATR(data, period);

  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (ema[i] === null || atr[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      upper.push(ema[i]! + multiplier * atr[i]!);
      lower.push(ema[i]! - multiplier * atr[i]!);
    }
  }

  return { upper, middle: ema, lower };
}

/**
 * RSI (Relative Strength Index)
 */
export function calculateRSI(data: PriceData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      gains.push(0);
      losses.push(0);
      result.push(null);
    } else {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result[i] = null;
    } else {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;

      if (avgLoss === 0) {
        result[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        result[i] = 100 - (100 / (1 + rs));
      }
    }
  }

  return result;
}

/**
 * ADX (Average Directional Index)
 */
export function calculateADX(data: PriceData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const tr = calculateATR(data, 1);
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const upMove = (data[i].high || data[i].close) - (data[i - 1].high || data[i - 1].close);
      const downMove = (data[i - 1].low || data[i - 1].close) - (data[i].low || data[i].close);

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
  }

  const plusDI: (number | null)[] = [];
  const minusDI: (number | null)[] = [];
  const dx: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      plusDI.push(null);
      minusDI.push(null);
      dx.push(null);
      result.push(null);
    } else {
      const trSlice = tr.slice(i - period + 1, i + 1);
      const trSum = trSlice.reduce((a, b) => (a || 0) + (b || 0), 0);
      const plusDMSum = plusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const minusDMSum = minusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);

      const plusDIValue = trSum !== null && trSum > 0 ? (plusDMSum / trSum) * 100 : 0;
      const minusDIValue = trSum !== null && trSum > 0 ? (minusDMSum / trSum) * 100 : 0;

      plusDI.push(plusDIValue);
      minusDI.push(minusDIValue);

      const diSum = plusDIValue + minusDIValue;
      const dxValue = diSum > 0 ? Math.abs(plusDIValue - minusDIValue) / diSum * 100 : 0;
      dx.push(dxValue);

      // Calculate ADX as smoothed DX
      if (i === period) {
        result.push(dxValue);
      } else if (i > period) {
        const prevADX = result[i - 1] || 0;
        result.push((prevADX * (period - 1) + dxValue) / period);
      }
    }
  }

  return result;
}

/**
 * CCI (Commodity Channel Index)
 */
export function calculateCCI(data: PriceData[], period: number = 20): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const typicalPrices = slice.map(d => {
        const high = d.high || d.close;
        const low = d.low || d.close;
        return (high + low + d.close) / 3;
      });

      const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
      const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

      if (meanDeviation === 0) {
        result.push(0);
      } else {
        const cci = (typicalPrices[typicalPrices.length - 1] - sma) / (0.015 * meanDeviation);
        result.push(cci);
      }
    }
  }

  return result;
}

/**
 * MFI (Money Flow Index)
 */
export function calculateMFI(data: PriceData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const rawMoneyFlow: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      rawMoneyFlow.push(0);
      result.push(null);
    } else {
      const high = data[i].high || data[i].close;
      const low = data[i].low || data[i].close;
      const typicalPrice = (high + low + data[i].close) / 3;
      const prevTypicalPrice = ((data[i - 1].high || data[i - 1].close) +
                                 (data[i - 1].low || data[i - 1].close) +
                                 data[i - 1].close) / 3;

      const volume = data[i].volume || 0;
      const moneyFlow = typicalPrice * volume;

      if (typicalPrice > prevTypicalPrice) {
        rawMoneyFlow.push(moneyFlow);
      } else if (typicalPrice < prevTypicalPrice) {
        rawMoneyFlow.push(-moneyFlow);
      } else {
        rawMoneyFlow.push(0);
      }
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result[i] = null;
    } else {
      const slice = rawMoneyFlow.slice(i - period + 1, i + 1);
      const positiveFlow = slice.filter(mf => mf > 0).reduce((a, b) => a + b, 0);
      const negativeFlow = Math.abs(slice.filter(mf => mf < 0).reduce((a, b) => a + b, 0));

      if (negativeFlow === 0) {
        result[i] = 100;
      } else {
        const moneyRatio = positiveFlow / negativeFlow;
        result[i] = 100 - (100 / (1 + moneyRatio));
      }
    }
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  data: PriceData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine: (number | null)[] = fastEMA.map((fast, idx) => {
    if (fast === null || slowEMA[idx] === null) return null;
    return fast - slowEMA[idx]!;
  });

  // Calculate signal line (EMA of MACD line)
  const macdData = macdLine.map((val) => ({ close: val || 0 }));
  const signalLine = calculateEMA(macdData, signalPeriod);

  // Calculate histogram
  const histogram: (number | null)[] = macdLine.map((macd, idx) => {
    if (macd === null || signalLine[idx] === null) return null;
    return macd - signalLine[idx]!;
  });

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Williams %R
 */
export function calculateWilliamsR(data: PriceData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...slice.map(d => d.high || d.close));
      const lowestLow = Math.min(...slice.map(d => d.low || d.close));
      const close = data[i].close;

      if (highestHigh === lowestLow) {
        result.push(0);
      } else {
        const wr = ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
        result.push(wr);
      }
    }
  }

  return result;
}

/**
 * Momentum Indicator
 */
export function calculateMomentum(data: PriceData[], period: number = 10): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      const momentum = data[i].close - data[i - period].close;
      result.push(momentum);
    }
  }

  return result;
}

/**
 * PROC (Price Rate Of Change)
 */
export function calculatePROC(data: PriceData[], period: number = 12): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      const prevClose = data[i - period].close;
      if (prevClose === 0) {
        result.push(null);
      } else {
        const proc = ((data[i].close - prevClose) / prevClose) * 100;
        result.push(proc);
      }
    }
  }

  return result;
}

/**
 * OBV (On Balance Volume)
 */
export function calculateOBV(data: PriceData[]): (number | null)[] {
  const result: (number | null)[] = [];
  let obv = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      obv = data[i].volume || 0;
      result.push(obv);
    } else {
      const volume = data[i].volume || 0;
      if (data[i].close > data[i - 1].close) {
        obv += volume;
      } else if (data[i].close < data[i - 1].close) {
        obv -= volume;
      }
      // If close is equal, OBV stays the same
      result.push(obv);
    }
  }

  return result;
}

/**
 * Bollinger Bands Upper (UBB)
 */
export function calculateBollingerUpper(
  data: PriceData[],
  period: number = 20,
  stdDev: number = 2
): (number | null)[] {
  const bands = calculateBollingerBands(data, period, stdDev);
  return bands.upper;
}

/**
 * Bollinger Bands Middle (MBB)
 */
export function calculateBollingerMiddle(
  data: PriceData[],
  period: number = 20
): (number | null)[] {
  const bands = calculateBollingerBands(data, period);
  return bands.middle;
}

/**
 * Bollinger Bands Lower (LBB)
 */
export function calculateBollingerLower(
  data: PriceData[],
  period: number = 20,
  stdDev: number = 2
): (number | null)[] {
  const bands = calculateBollingerBands(data, period, stdDev);
  return bands.lower;
}

/**
 * Prev N (Previous N periods value)
 */
export function calculatePrevN(data: PriceData[], period: number = 1): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      result.push(data[i - period].close);
    }
  }

  return result;
}

/**
 * Nth Candle (Value from Nth candle ago)
 */
export function calculateNthCandle(data: PriceData[], period: number = 1): (number | null)[] {
  // Same as PrevN, but can be extended for different candle properties
  return calculatePrevN(data, period);
}

/**
 * Opening Range
 */
export function calculateOpeningRange(
  data: PriceData[],
  rangePeriods: number = 30
): { high: (number | null)[]; low: (number | null)[] } {
  const high: (number | null)[] = [];
  const low: (number | null)[] = [];

  // For simplicity, we'll use the first N periods of the dataset as opening range
  // In a real implementation, this would reset daily
  let openingHigh: number | null = null;
  let openingLow: number | null = null;
  let rangeStartIndex = 0;

  for (let i = 0; i < data.length; i++) {
    // Reset opening range every N periods (simulating daily reset)
    if (i % rangePeriods === 0) {
      openingHigh = data[i].high || data[i].close;
      openingLow = data[i].low || data[i].close;
      rangeStartIndex = i;
    }

    if (i < rangeStartIndex + rangePeriods) {
      const currentHigh = data[i].high || data[i].close;
      const currentLow = data[i].low || data[i].close;
      openingHigh = openingHigh !== null ? Math.max(openingHigh, currentHigh) : currentHigh;
      openingLow = openingLow !== null ? Math.min(openingLow, currentLow) : currentLow;
    }

    high.push(openingHigh);
    low.push(openingLow);
  }

  return { high, low };
}

/**
 * Number (Constant numeric value - placeholder for custom values)
 */
export function calculateNumber(data: PriceData[], value: number = 0): (number | null)[] {
  return data.map(() => value);
}

/**
 * Signal Candle (Marks candles that meet certain criteria)
 * This is a placeholder - actual implementation would depend on specific criteria
 */
export function calculateSignalCandle(data: PriceData[]): (number | null)[] {
  // Placeholder: returns 1 for candles that meet criteria, null otherwise
  // In a real implementation, this would check for specific patterns or conditions
  return data.map((d, idx) => {
    if (idx === 0) return null;
    // Example: signal if current close > previous close and volume > previous volume
    const prevVolume = data[idx - 1].volume || 0;
    const currentVolume = d.volume || 0;
    if (d.close > data[idx - 1].close && currentVolume > prevVolume) {
      return d.close;
    }
    return null;
  });
}

/**
 * Trade Candle (Marks candles where trades should be executed)
 * This is a placeholder - actual implementation would depend on trading strategy
 */
export function calculateTradeCandle(data: PriceData[]): (number | null)[] {
  // Placeholder: similar to signal candle but for trade execution points
  return data.map((d, idx) => {
    if (idx < 2) return null;
    // Example: trade signal if price crosses above SMA
    const sma = calculateSMA(data.slice(0, idx + 1), 5);
    if (sma.length > 0 && sma[sma.length - 1] !== null) {
      const prevSMA = idx > 0 ? calculateSMA(data.slice(0, idx), 5) : [];
      if (prevSMA.length > 0 && prevSMA[prevSMA.length - 1] !== null) {
        if (data[idx - 1].close <= prevSMA[prevSMA.length - 1]! &&
            d.close > sma[sma.length - 1]!) {
          return d.close;
        }
      }
    }
    return null;
  });
}

/**
 * Candle Time (Returns timestamp as numeric value)
 */
export function calculateCandleTime(data: PriceData[]): (number | null)[] {
  return data.map((d, idx) => {
    if (d.timestamp) {
      return new Date(d.timestamp).getTime();
    }
    return idx; // Fallback to index if no timestamp
  });
}
