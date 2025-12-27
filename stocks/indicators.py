"""
Technical Indicators Calculation Utilities
Backend implementation of technical indicators for trading bot analysis.
"""

import logging
import math
from decimal import Decimal
from typing import Any

logger = logging.getLogger(__name__)


def to_number(value: Any) -> float | None:
    """Convert a value to a number, handling strings and Decimal."""
    if value is None:
        return None
    if isinstance(value, int | float):
        num = float(value)
        return num if not (math.isnan(num) or math.isinf(num)) else None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, str):
        try:
            num = float(value)
        except (ValueError, TypeError):
            return None
        else:
            return num if not (math.isnan(num) or math.isinf(num)) else None
    return None


def calculate_sma(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Simple Moving Average (SMA).

    Args:
        data: List of price data dictionaries with OHLCV fields
        period: Period for moving average
        price_field: Field name for price (default: "close_price")

    Returns:
        List of SMA values (None for insufficient data)
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    result: list[float | None] = []

    for i in range(len(data)):
        if i < period - 1:
            result.append(None)
        else:
            slice_data = data[i - period + 1 : i + 1]
            if len(slice_data) < period:
                result.append(None)
                continue
            prices = [to_number(item.get(price_field)) for item in slice_data]

            if any(p is None for p in prices):
                result.append(None)
            else:
                avg = sum(p for p in prices if p is not None) / period
                result.append(avg if not (math.isnan(avg) or math.isinf(avg)) else None)

    return result


def calculate_ema(  # noqa: PLR0912
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Exponential Moving Average (EMA).

    Args:
        data: List of price data dictionaries
        period: Period for moving average
        price_field: Field name for price

    Returns:
        List of EMA values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    result: list[float | None] = []
    multiplier = 2.0 / (period + 1)

    for i in range(len(data)):
        if i >= len(data):
            break
        price = to_number(data[i].get(price_field))
        if price is None:
            result.append(None)
            continue

        if i == 0:
            result.append(price)
        elif i < period - 1:
            # Use SMA for initial values
            prices = [
                to_number(data[j].get(price_field))
                for j in range(i + 1)
                if j < len(data)
            ]
            valid_prices = [p for p in prices if p is not None]
            if valid_prices:
                result.append(sum(valid_prices) / len(valid_prices))
            else:
                result.append(None)
        elif i - 1 < len(result):
            prev_ema = result[i - 1]
            if prev_ema is None:
                result.append(price)
            else:
                ema = (price - prev_ema) * multiplier + prev_ema
                result.append(ema)
        else:
            result.append(price)

    return result


def calculate_wma(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Weighted Moving Average (WMA).

    Args:
        data: List of price data dictionaries
        period: Period for moving average
        price_field: Field name for price

    Returns:
        List of WMA values
    """
    result: list[float | None] = []

    for i in range(len(data)):
        if i < period - 1:
            result.append(None)
        else:
            weighted_sum = 0.0
            weight_sum = 0.0

            for j in range(period):
                weight = period - j
                price = to_number(data[i - j].get(price_field))
                if price is not None:
                    weighted_sum += price * weight
                    weight_sum += weight

            if weight_sum > 0:
                result.append(weighted_sum / weight_sum)
            else:
                result.append(None)

    return result


def calculate_rsi(  # noqa: PLR0912
    data: list[dict], period: int = 14, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Relative Strength Index (RSI).

    Args:
        data: List of price data dictionaries
        period: Period for RSI calculation (default: 14)
        price_field: Field name for price

    Returns:
        List of RSI values (0-100)
    """
    if not data or len(data) < 2:
        return [None] * len(data) if data else []

    result: list[float | None] = []
    gains: list[float] = []
    losses: list[float] = []

    for i in range(len(data)):
        if i == 0:
            gains.append(0.0)
            losses.append(0.0)
            result.append(None)
        else:
            current_price = to_number(data[i].get(price_field))
            prev_price = to_number(data[i - 1].get(price_field))

            if current_price is None or prev_price is None:
                gains.append(0.0)
                losses.append(0.0)
                result.append(None)
            else:
                change = current_price - prev_price
                gains.append(change if change > 0 else 0.0)
                losses.append(-change if change < 0 else 0.0)
                result.append(
                    None
                )  # Initialize with None, will be calculated in second loop

    # Calculate RSI - ensure we have enough data
    if len(result) < period:
        return result

    # Calculate RSI
    for i in range(len(data)):
        if i < period:
            if i < len(result):
                result[i] = None
        # Ensure we have enough data points
        elif i < len(gains) and i < len(losses) and i < len(result):
            avg_gain = sum(gains[i - period + 1 : i + 1]) / period
            avg_loss = sum(losses[i - period + 1 : i + 1]) / period

            if avg_loss == 0:
                result[i] = 100.0
            else:
                rs = avg_gain / avg_loss
                result[i] = 100.0 - (100.0 / (1.0 + rs))

    return result


def calculate_atr(data: list[dict], period: int = 14) -> list[float | None]:
    """
    Calculate Average True Range (ATR).

    Args:
        data: List of price data dictionaries with high, low, close
        period: Period for ATR calculation

    Returns:
        List of ATR values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    tr_values: list[float] = []

    for i in range(len(data)):
        if i >= len(data):
            break
        high = (
            to_number(data[i].get("high_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )
        low = (
            to_number(data[i].get("low_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )

        if i == 0:
            tr_values.append(high - low)
        elif i - 1 < len(data):
            prev_close = to_number(data[i - 1].get("close_price")) or 0.0
            tr1 = high - low
            tr2 = abs(high - prev_close)
            tr3 = abs(low - prev_close)
            tr_values.append(max(tr1, tr2, tr3))
        else:
            tr_values.append(high - low)

    # Calculate ATR as SMA of TR
    return calculate_sma(
        [{"close_price": tr} for tr in tr_values], period, price_field="close_price"
    )


def calculate_macd(
    data: list[dict],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
    price_field: str = "close_price",
) -> dict[str, list[float | None]]:
    """
    Calculate MACD (Moving Average Convergence Divergence).

    Args:
        data: List of price data dictionaries
        fast_period: Fast EMA period (default: 12)
        slow_period: Slow EMA period (default: 26)
        signal_period: Signal line EMA period (default: 9)
        price_field: Field name for price

    Returns:
        Dictionary with 'macd', 'signal', and 'histogram' lists
    """
    if not data:
        return {"macd": [], "signal": [], "histogram": []}

    fast_ema = calculate_ema(data, fast_period, price_field)
    slow_ema = calculate_ema(data, slow_period, price_field)

    # MACD line
    macd_line: list[float | None] = []
    min_len = min(len(fast_ema), len(slow_ema), len(data))
    for i in range(min_len):
        if i < len(fast_ema) and i < len(slow_ema):
            if fast_ema[i] is not None and slow_ema[i] is not None:
                macd_line.append(fast_ema[i] - slow_ema[i])
            else:
                macd_line.append(None)
        else:
            macd_line.append(None)

    # Signal line (EMA of MACD line)
    macd_data = [{"close_price": val if val is not None else 0.0} for val in macd_line]
    signal_line = calculate_ema(macd_data, signal_period, price_field="close_price")

    # Histogram
    histogram: list[float | None] = []
    min_len = min(len(macd_line), len(signal_line))
    for i in range(min_len):
        if i < len(macd_line) and i < len(signal_line):
            if macd_line[i] is not None and signal_line[i] is not None:
                histogram.append(macd_line[i] - signal_line[i])
            else:
                histogram.append(None)
        else:
            histogram.append(None)

    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


def calculate_bollinger_bands(
    data: list[dict],
    period: int = 20,
    std_dev: float = 2.0,
    price_field: str = "close_price",
) -> dict[str, list[float | None]]:
    """
    Calculate Bollinger Bands.

    Args:
        data: List of price data dictionaries
        period: Period for moving average (default: 20)
        std_dev: Standard deviation multiplier (default: 2.0)
        price_field: Field name for price

    Returns:
        Dictionary with 'upper', 'middle' (SMA), and 'lower' lists
    """
    if not data:
        return {"upper": [], "middle": [], "lower": []}

    sma = calculate_sma(data, period, price_field)
    upper: list[float | None] = []
    lower: list[float | None] = []

    for i in range(len(data)):
        if i < period - 1:
            upper.append(None)
            lower.append(None)
        elif i < len(sma):
            mean = sma[i]
            if mean is None:
                upper.append(None)
                lower.append(None)
            else:
                # Calculate standard deviation
                slice_data = data[i - period + 1 : i + 1]
                if len(slice_data) < period:
                    upper.append(None)
                    lower.append(None)
                    continue
                prices = [to_number(item.get(price_field)) for item in slice_data]
                valid_prices = [p for p in prices if p is not None]

                if valid_prices:
                    variance = sum((p - mean) ** 2 for p in valid_prices) / len(
                        valid_prices
                    )
                    std = variance**0.5
                    upper.append(mean + std_dev * std)
                    lower.append(mean - std_dev * std)
                else:
                    upper.append(None)
                    lower.append(None)
        else:
            upper.append(None)
            lower.append(None)

    return {"upper": upper, "middle": sma, "lower": lower}


def calculate_stochastic(
    data: list[dict], k_period: int = 14, d_period: int = 3
) -> dict[str, list[float | None]]:
    """
    Calculate Stochastic Oscillator (%K and %D).

    Args:
        data: List of price data dictionaries
        k_period: Period for %K calculation (default: 14)
        d_period: Period for %D smoothing (default: 3)

    Returns:
        Dictionary with 'k' (%K) and 'd' (%D) lists
    """
    k_values: list[float | None] = []

    for i in range(len(data)):
        if i < k_period - 1:
            k_values.append(None)
        else:
            slice_data = data[i - k_period + 1 : i + 1]
            highs = [
                to_number(item.get("high_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]
            lows = [
                to_number(item.get("low_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]
            close = to_number(data[i].get("close_price"))

            valid_highs = [h for h in highs if h is not None]
            valid_lows = [low for low in lows if low is not None]

            if valid_highs and valid_lows and close is not None:
                highest_high = max(valid_highs)
                lowest_low = min(valid_lows)

                if highest_high != lowest_low:
                    k = ((close - lowest_low) / (highest_high - lowest_low)) * 100.0
                    k_values.append(k)
                else:
                    k_values.append(50.0)  # Neutral value
            else:
                k_values.append(None)

    # Calculate %D as SMA of %K
    k_data = [{"close_price": val if val is not None else 50.0} for val in k_values]
    d_values = calculate_sma(k_data, d_period, price_field="close_price")

    return {"k": k_values, "d": d_values}


def calculate_cci(data: list[dict], period: int = 20) -> list[float | None]:
    """
    Calculate Commodity Channel Index (CCI).

    Args:
        data: List of price data dictionaries
        period: Period for CCI calculation (default: 20)

    Returns:
        List of CCI values
    """
    result: list[float | None] = []

    for i in range(len(data)):
        if i < period - 1:
            result.append(None)
        else:
            slice_data = data[i - period + 1 : i + 1]
            typical_prices: list[float] = []

            for item in slice_data:
                high = (
                    to_number(item.get("high_price"))
                    or to_number(item.get("close_price"))
                    or 0.0
                )
                low = (
                    to_number(item.get("low_price"))
                    or to_number(item.get("close_price"))
                    or 0.0
                )
                close = to_number(item.get("close_price")) or 0.0
                tp = (high + low + close) / 3.0
                typical_prices.append(tp)

            sma = sum(typical_prices) / period
            mean_deviation = sum(abs(tp - sma) for tp in typical_prices) / period

            if mean_deviation == 0:
                result.append(0.0)
            else:
                current_tp = typical_prices[-1]
                cci = (current_tp - sma) / (0.015 * mean_deviation)
                result.append(cci)

    return result


def calculate_vwap(data: list[dict]) -> list[float | None]:
    """
    Calculate Volume Weighted Average Price (VWAP).

    Args:
        data: List of price data dictionaries with volume

    Returns:
        List of VWAP values
    """
    result: list[float | None] = []
    cumulative_tpv = 0.0  # Typical Price * Volume
    cumulative_volume = 0.0

    for item in data:
        high = (
            to_number(item.get("high_price"))
            or to_number(item.get("close_price"))
            or 0.0
        )
        low = (
            to_number(item.get("low_price"))
            or to_number(item.get("close_price"))
            or 0.0
        )
        close = to_number(item.get("close_price")) or 0.0
        volume = to_number(item.get("volume")) or 0.0

        typical_price = (high + low + close) / 3.0
        cumulative_tpv += typical_price * volume
        cumulative_volume += volume

        if cumulative_volume == 0:
            result.append(None)
        else:
            result.append(cumulative_tpv / cumulative_volume)

    return result


def calculate_obv(data: list[dict]) -> list[float | None]:
    """
    Calculate On-Balance Volume (OBV).

    Args:
        data: List of price data dictionaries with volume

    Returns:
        List of OBV values
    """
    result: list[float | None] = []
    obv = 0.0

    for i, item in enumerate(data):
        close = to_number(item.get("close_price"))
        volume = to_number(item.get("volume")) or 0.0

        if close is None:
            result.append(None)
            continue

        if i == 0:
            obv = volume
        else:
            prev_close = to_number(data[i - 1].get("close_price"))
            if prev_close is not None:
                if close > prev_close:
                    obv += volume
                elif close < prev_close:
                    obv -= volume
                # If close == prev_close, OBV stays the same

        result.append(obv)

    return result


def calculate_williams_r(data: list[dict], period: int = 14) -> list[float | None]:
    """
    Calculate Williams %R.

    Args:
        data: List of price data dictionaries
        period: Period for calculation (default: 14)

    Returns:
        List of Williams %R values (-100 to 0)
    """
    result: list[float | None] = []

    for i in range(len(data)):
        if i < period - 1:
            result.append(None)
        else:
            slice_data = data[i - period + 1 : i + 1]
            highs = [
                to_number(item.get("high_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]
            lows = [
                to_number(item.get("low_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]
            close = to_number(data[i].get("close_price"))

            valid_highs = [h for h in highs if h is not None]
            valid_lows = [low for low in lows if low is not None]

            if valid_highs and valid_lows and close is not None:
                highest_high = max(valid_highs)
                lowest_low = min(valid_lows)

                if highest_high != lowest_low:
                    wr = ((highest_high - close) / (highest_high - lowest_low)) * -100.0
                    result.append(wr)
                else:
                    result.append(-50.0)  # Neutral value
            else:
                result.append(None)

    return result


def calculate_adx(data: list[dict], period: int = 14) -> dict[str, list[float | None]]:  # noqa: PLR0912, PLR0915
    """
    Calculate Average Directional Index (ADX) with +DI and -DI.

    Args:
        data: List of price data dictionaries
        period: Period for ADX calculation (default: 14)

    Returns:
        Dictionary with 'adx', 'plus_di', and 'minus_di' lists
    """
    if len(data) < period + 1:
        return {
            "adx": [None] * len(data),
            "plus_di": [None] * len(data),
            "minus_di": [None] * len(data),
        }

    # Calculate True Range and Directional Movement
    tr_values: list[float | None] = []
    plus_dm_values: list[float | None] = []
    minus_dm_values: list[float | None] = []

    for i in range(len(data)):
        if i == 0:
            tr_values.append(None)
            plus_dm_values.append(None)
            minus_dm_values.append(None)
            continue

        high = to_number(data[i].get("high_price")) or 0.0
        low = to_number(data[i].get("low_price")) or 0.0
        prev_close = to_number(data[i - 1].get("close_price")) or 0.0

        # True Range
        tr1 = high - low
        tr2 = abs(high - prev_close)
        tr3 = abs(low - prev_close)
        tr = max(tr1, tr2, tr3)
        tr_values.append(tr)

        # Directional Movement
        prev_high = to_number(data[i - 1].get("high_price")) or 0.0
        prev_low = to_number(data[i - 1].get("low_price")) or 0.0

        plus_dm = high - prev_high if high > prev_high else 0.0
        minus_dm = prev_low - low if prev_low > low else 0.0

        if plus_dm > minus_dm:
            plus_dm_values.append(plus_dm)
            minus_dm_values.append(0.0)
        elif minus_dm > plus_dm:
            plus_dm_values.append(0.0)
            minus_dm_values.append(minus_dm)
        else:
            plus_dm_values.append(0.0)
            minus_dm_values.append(0.0)

    # Calculate smoothed TR, +DM, -DM
    atr_values = calculate_atr(data, period)
    smoothed_plus_dm: list[float | None] = [None] * period
    smoothed_minus_dm: list[float | None] = [None] * period

    # Initial sum
    if len(plus_dm_values) >= period:
        smoothed_plus_dm.append(sum(plus_dm_values[1 : period + 1]))
        smoothed_minus_dm.append(sum(minus_dm_values[1 : period + 1]))

    # Smoothing
    for i in range(period + 1, len(data)):
        if smoothed_plus_dm[i - 1] is not None and atr_values[i] is not None:
            prev_plus = smoothed_plus_dm[i - 1] or 0.0
            prev_minus = smoothed_minus_dm[i - 1] or 0.0
            smoothed_plus_dm.append(
                prev_plus - (prev_plus / period) + (plus_dm_values[i] or 0.0)
            )
            smoothed_minus_dm.append(
                prev_minus - (prev_minus / period) + (minus_dm_values[i] or 0.0)
            )
        else:
            smoothed_plus_dm.append(None)
            smoothed_minus_dm.append(None)

    # Calculate +DI and -DI
    plus_di: list[float | None] = []
    minus_di: list[float | None] = []

    for i in range(len(data)):
        if atr_values[i] is not None and atr_values[i] > 0:
            plus_di_val = (
                (smoothed_plus_dm[i] or 0.0) / atr_values[i] * 100.0
                if smoothed_plus_dm[i] is not None
                else None
            )
            minus_di_val = (
                (smoothed_minus_dm[i] or 0.0) / atr_values[i] * 100.0
                if smoothed_minus_dm[i] is not None
                else None
            )
            plus_di.append(plus_di_val)
            minus_di.append(minus_di_val)
        else:
            plus_di.append(None)
            minus_di.append(None)

    # Calculate DX and ADX
    dx_values: list[float | None] = []
    for i in range(len(data)):
        if plus_di[i] is not None and minus_di[i] is not None:
            di_sum = plus_di[i] + minus_di[i]
            if di_sum > 0:
                dx = abs(plus_di[i] - minus_di[i]) / di_sum * 100.0
                dx_values.append(dx)
            else:
                dx_values.append(None)
        else:
            dx_values.append(None)

    # ADX is smoothed DX
    adx = calculate_sma(
        [{"close_price": dx if dx is not None else 0.0} for dx in dx_values],
        period,
        price_field="close_price",
    )

    return {
        "adx": adx,
        "plus_di": plus_di,
        "minus_di": minus_di,
    }


def calculate_parabolic_sar(  # noqa: PLR0912
    data: list[dict], acceleration: float = 0.02, maximum: float = 0.20
) -> list[float | None]:
    """
    Calculate Parabolic SAR.

    Args:
        data: List of price data dictionaries
        acceleration: Acceleration factor (default: 0.02)
        maximum: Maximum acceleration (default: 0.20)

    Returns:
        List of Parabolic SAR values
    """
    if len(data) < 2:
        return [None] * len(data)

    result: list[float | None] = [None]
    sar = None
    ep = None  # Extreme Point
    af = acceleration  # Acceleration Factor
    trend = None  # 1 for uptrend, -1 for downtrend

    for i in range(1, len(data)):
        high = to_number(data[i].get("high_price")) or 0.0
        low = to_number(data[i].get("low_price")) or 0.0
        prev_high = to_number(data[i - 1].get("high_price")) or 0.0
        prev_low = to_number(data[i - 1].get("low_price")) or 0.0

        if i == 1:
            # Initialize
            if high > prev_high:
                trend = 1
                ep = high
                sar = prev_low
            else:
                trend = -1
                ep = low
                sar = prev_high
        else:
            # Update SAR
            prev_sar = result[i - 1]
            if prev_sar is None:
                result.append(None)
                continue

            if trend == 1:
                # Uptrend
                sar = prev_sar + af * (ep - prev_sar)
                sar = min(sar, prev_low, low)

                if high > ep:
                    ep = high
                    af = min(af + acceleration, maximum)

                if low < sar:
                    # Trend reversal
                    trend = -1
                    sar = ep
                    ep = low
                    af = acceleration
            else:
                # Downtrend
                sar = prev_sar + af * (ep - prev_sar)
                sar = max(sar, prev_high, high)

                if low < ep:
                    ep = low
                    af = min(af + acceleration, maximum)

                if high > sar:
                    # Trend reversal
                    trend = 1
                    sar = ep
                    ep = high
                    af = acceleration

        result.append(sar)

    return result


def calculate_pivot_points(data: list[dict]) -> dict[str, list[float | None]]:
    """
    Calculate Pivot Points (Standard, Fibonacci, Camarilla).

    Args:
        data: List of price data dictionaries

    Returns:
        Dictionary with pivot point levels
    """
    result = {
        "pivot": [],
        "r1": [],
        "r2": [],
        "r3": [],
        "s1": [],
        "s2": [],
        "s3": [],
        "fib_r1": [],
        "fib_r2": [],
        "fib_r3": [],
        "fib_s1": [],
        "fib_s2": [],
        "fib_s3": [],
    }

    for i in range(len(data)):
        high = to_number(data[i].get("high_price"))
        low = to_number(data[i].get("low_price"))
        close = to_number(data[i].get("close_price"))

        if high is None or low is None or close is None:
            for value_list in result.values():
                value_list.append(None)
            continue

        # Standard Pivot Points
        pivot = (high + low + close) / 3.0
        r1 = 2 * pivot - low
        r2 = pivot + (high - low)
        r3 = high + 2 * (pivot - low)
        s1 = 2 * pivot - high
        s2 = pivot - (high - low)
        s3 = low - 2 * (high - pivot)

        result["pivot"].append(pivot)
        result["r1"].append(r1)
        result["r2"].append(r2)
        result["r3"].append(r3)
        result["s1"].append(s1)
        result["s2"].append(s2)
        result["s3"].append(s3)

        # Fibonacci Pivot Points
        diff = high - low
        result["fib_r1"].append(pivot + 0.382 * diff)
        result["fib_r2"].append(pivot + 0.618 * diff)
        result["fib_r3"].append(pivot + 1.000 * diff)
        result["fib_s1"].append(pivot - 0.382 * diff)
        result["fib_s2"].append(pivot - 0.618 * diff)
        result["fib_s3"].append(pivot - 1.000 * diff)

    return result


def calculate_ichimoku(  # noqa: PLR0912, PLR0915
    data: list[dict],
    tenkan_period: int = 9,
    kijun_period: int = 26,
    senkou_b_period: int = 52,
) -> dict[str, list[float | None]]:
    """
    Calculate Ichimoku Cloud components.

    Args:
        data: List of price data dictionaries
        tenkan_period: Tenkan-sen period (default: 9)
        kijun_period: Kijun-sen period (default: 26)
        senkou_b_period: Senkou Span B period (default: 52)

    Returns:
        Dictionary with Ichimoku components
    """
    if len(data) < senkou_b_period:
        return {
            "tenkan": [None] * len(data),
            "kijun": [None] * len(data),
            "senkou_a": [None] * len(data),
            "senkou_b": [None] * len(data),
            "chikou": [None] * len(data),
        }

    # Tenkan-sen (Conversion Line)
    tenkan: list[float | None] = []
    for i in range(len(data)):
        if i < tenkan_period - 1:
            tenkan.append(None)
        else:
            slice_data = data[i - tenkan_period + 1 : i + 1]
            highs = [to_number(item.get("high_price")) for item in slice_data]
            lows = [to_number(item.get("low_price")) for item in slice_data]
            valid_highs = [h for h in highs if h is not None]
            valid_lows = [low for low in lows if low is not None]
            if valid_highs and valid_lows:
                tenkan.append((max(valid_highs) + min(valid_lows)) / 2.0)
            else:
                tenkan.append(None)

    # Kijun-sen (Base Line)
    kijun: list[float | None] = []
    for i in range(len(data)):
        if i < kijun_period - 1:
            kijun.append(None)
        else:
            slice_data = data[i - kijun_period + 1 : i + 1]
            highs = [to_number(item.get("high_price")) for item in slice_data]
            lows = [to_number(item.get("low_price")) for item in slice_data]
            valid_highs = [h for h in highs if h is not None]
            valid_lows = [low for low in lows if low is not None]
            if valid_highs and valid_lows:
                kijun.append((max(valid_highs) + min(valid_lows)) / 2.0)
            else:
                kijun.append(None)

    # Senkou Span A (Leading Span A)
    senkou_a: list[float | None] = []
    for i in range(len(data)):
        if tenkan[i] is not None and kijun[i] is not None:
            # Shifted forward by kijun_period
            if i >= kijun_period:
                senkou_a.append(
                    (tenkan[i - kijun_period] + kijun[i - kijun_period]) / 2.0
                )
            else:
                senkou_a.append(None)
        else:
            senkou_a.append(None)

    # Senkou Span B (Leading Span B)
    senkou_b: list[float | None] = []
    for i in range(len(data)):
        if i < senkou_b_period - 1:
            senkou_b.append(None)
        else:
            slice_data = data[i - senkou_b_period + 1 : i + 1]
            highs = [to_number(item.get("high_price")) for item in slice_data]
            lows = [to_number(item.get("low_price")) for item in slice_data]
            valid_highs = [h for h in highs if h is not None]
            valid_lows = [low for low in lows if low is not None]
            if valid_highs and valid_lows:
                # Shifted forward by kijun_period
                if i >= kijun_period:
                    senkou_b.append((max(valid_highs) + min(valid_lows)) / 2.0)
                else:
                    senkou_b.append(None)
            else:
                senkou_b.append(None)

    # Chikou Span (Lagging Span) - Close price shifted back by kijun_period
    chikou: list[float | None] = []
    for i in range(len(data)):
        if i + kijun_period < len(data):
            chikou.append(to_number(data[i + kijun_period].get("close_price")))
        else:
            chikou.append(None)

    return {
        "tenkan": tenkan,
        "kijun": kijun,
        "senkou_a": senkou_a,
        "senkou_b": senkou_b,
        "chikou": chikou,
    }


def calculate_dema(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Double Exponential Moving Average (DEMA).

    Args:
        data: List of price data dictionaries
        period: Period for moving average
        price_field: Field name for price

    Returns:
        List of DEMA values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    # Calculate EMA
    ema = calculate_ema(data, period, price_field)

    # Calculate EMA of EMA
    ema_data = [{"close_price": val if val is not None else 0.0} for val in ema]
    ema_of_ema = calculate_ema(ema_data, period, price_field="close_price")

    # DEMA = 2 x EMA - EMA(EMA)
    result: list[float | None] = []
    for i in range(len(data)):
        if ema[i] is not None and ema_of_ema[i] is not None:
            dema = 2.0 * ema[i] - ema_of_ema[i]
            result.append(dema if not (math.isnan(dema) or math.isinf(dema)) else None)
        else:
            result.append(None)

    return result


def calculate_tema(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Triple Exponential Moving Average (TEMA).

    Args:
        data: List of price data dictionaries
        period: Period for moving average
        price_field: Field name for price

    Returns:
        List of TEMA values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    # Calculate EMA
    ema = calculate_ema(data, period, price_field)

    # Calculate EMA of EMA
    ema_data = [{"close_price": val if val is not None else 0.0} for val in ema]
    ema_of_ema = calculate_ema(ema_data, period, price_field="close_price")

    # Calculate EMA of EMA of EMA
    ema_of_ema_data = [
        {"close_price": val if val is not None else 0.0} for val in ema_of_ema
    ]
    ema_of_ema_of_ema = calculate_ema(
        ema_of_ema_data, period, price_field="close_price"
    )

    # TEMA = 3 x EMA - 3 x EMA(EMA) + EMA(EMA(EMA))
    result: list[float | None] = []
    for i in range(len(data)):
        if (
            ema[i] is not None
            and ema_of_ema[i] is not None
            and ema_of_ema_of_ema[i] is not None
        ):
            tema = 3.0 * ema[i] - 3.0 * ema_of_ema[i] + ema_of_ema_of_ema[i]
            result.append(tema if not (math.isnan(tema) or math.isinf(tema)) else None)
        else:
            result.append(None)

    return result


def calculate_tma(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Triangular Moving Average (TMA).

    Args:
        data: List of price data dictionaries
        period: Period for moving average
        price_field: Field name for price

    Returns:
        List of TMA values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    # TMA is SMA of SMA
    # First calculate SMA with period/2
    half_period = max(1, period // 2)
    first_sma = calculate_sma(data, half_period, price_field)

    # Then calculate SMA of the first SMA
    sma_data = [{"close_price": val if val is not None else 0.0} for val in first_sma]
    return calculate_sma(sma_data, half_period, price_field="close_price")


def calculate_hma(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Hull Moving Average (HMA).

    Args:
        data: List of price data dictionaries
        period: Period for moving average
        price_field: Field name for price

    Returns:
        List of HMA values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    # HMA = WMA(2 x WMA(Price, Period/2) - WMA(Price, Period), sqrt(Period))
    half_period = max(1, int(period / 2))
    sqrt_period = max(1, int(math.sqrt(period)))

    # Calculate WMA with half period
    wma_half = calculate_wma(data, half_period, price_field)

    # Calculate WMA with full period
    wma_full = calculate_wma(data, period, price_field)

    # Calculate 2 x WMA(half) - WMA(full)
    diff_data: list[dict] = []
    for i in range(len(data)):
        if wma_half[i] is not None and wma_full[i] is not None:
            diff = 2.0 * wma_half[i] - wma_full[i]
            diff_data.append({"close_price": diff})
        else:
            diff_data.append({"close_price": 0.0})

    # Calculate WMA of the difference
    return calculate_wma(diff_data, sqrt_period, price_field="close_price")


def calculate_mcginley(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate McGinley Dynamic Indicator.

    Args:
        data: List of price data dictionaries
        period: Period for moving average
        price_field: Field name for price

    Returns:
        List of McGinley Dynamic values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    result: list[float | None] = []
    prev_mdi = None

    for i in range(len(data)):
        price = to_number(data[i].get(price_field))
        if price is None:
            result.append(None)
            continue

        if i == 0:
            result.append(price)
            prev_mdi = price
        elif prev_mdi is not None and prev_mdi != 0:
            # MDI = Previous MDI + (Price - Previous MDI) / (Period x (Price / Previous MDI)^4)
            ratio = price / prev_mdi
            denominator = period * (ratio**4)
            if denominator != 0:
                mdi = prev_mdi + (price - prev_mdi) / denominator
                result.append(mdi if not (math.isnan(mdi) or math.isinf(mdi)) else None)
                prev_mdi = mdi
            else:
                result.append(prev_mdi)
        else:
            result.append(price)
            prev_mdi = price

    return result


def calculate_vwap_ma(
    data: list[dict], period: int, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate VWAP Moving Average (SMA of VWAP).

    Args:
        data: List of price data dictionaries with volume
        period: Period for moving average
        price_field: Field name for price (not used, VWAP uses typical price)

    Returns:
        List of VWAP MA values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    # Calculate VWAP first
    vwap = calculate_vwap(data)

    # Then calculate SMA of VWAP
    vwap_data = [{"close_price": val if val is not None else 0.0} for val in vwap]
    return calculate_sma(vwap_data, period, price_field="close_price")


def calculate_keltner_channels(
    data: list[dict],
    period: int = 20,
    multiplier: float = 2.0,
    price_field: str = "close_price",
) -> dict[str, list[float | None]]:
    """
    Calculate Keltner Channels.

    Args:
        data: List of price data dictionaries
        period: Period for EMA (default: 20)
        multiplier: ATR multiplier (default: 2.0)
        price_field: Field name for price

    Returns:
        Dictionary with 'upper', 'middle' (EMA), and 'lower' lists
    """
    if not data:
        return {"upper": [], "middle": [], "lower": []}

    # Middle line is EMA
    middle = calculate_ema(data, period, price_field)

    # Calculate ATR
    atr = calculate_atr(data, period)

    # Upper and lower bands
    upper: list[float | None] = []
    lower: list[float | None] = []

    for i in range(len(data)):
        if middle[i] is not None and atr[i] is not None:
            upper.append(middle[i] + multiplier * atr[i])
            lower.append(middle[i] - multiplier * atr[i])
        else:
            upper.append(None)
            lower.append(None)

    return {"upper": upper, "middle": middle, "lower": lower}


def calculate_donchian_channels(
    data: list[dict], period: int = 20
) -> dict[str, list[float | None]]:
    """
    Calculate Donchian Channels.

    Args:
        data: List of price data dictionaries
        period: Period for calculation (default: 20)

    Returns:
        Dictionary with 'upper', 'middle', and 'lower' lists
    """
    if not data:
        return {"upper": [], "middle": [], "lower": []}

    if period < 1:
        return {
            "upper": [None] * len(data),
            "middle": [None] * len(data),
            "lower": [None] * len(data),
        }

    upper: list[float | None] = []
    lower: list[float | None] = []
    middle: list[float | None] = []

    for i in range(len(data)):
        if i < period - 1:
            upper.append(None)
            lower.append(None)
            middle.append(None)
        else:
            slice_data = data[i - period + 1 : i + 1]
            highs = [
                to_number(item.get("high_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]
            lows = [
                to_number(item.get("low_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]

            valid_highs = [h for h in highs if h is not None]
            valid_lows = [low for low in lows if low is not None]

            if valid_highs and valid_lows:
                highest_high = max(valid_highs)
                lowest_low = min(valid_lows)
                upper.append(highest_high)
                lower.append(lowest_low)
                middle.append((highest_high + lowest_low) / 2.0)
            else:
                upper.append(None)
                lower.append(None)
                middle.append(None)

    return {"upper": upper, "middle": middle, "lower": lower}


def calculate_fractal_bands(
    data: list[dict], period: int = 5
) -> dict[str, list[float | None]]:
    """
    Calculate Fractal Chaos Bands.

    Args:
        data: List of price data dictionaries
        period: Period for fractal calculation (default: 5)

    Returns:
        Dictionary with 'upper' and 'lower' lists
    """
    if not data:
        return {"upper": [], "lower": []}

    if period < 1:
        return {"upper": [None] * len(data), "lower": [None] * len(data)}

    upper: list[float | None] = []
    lower: list[float | None] = []

    # Fractal high: high is highest in the period
    # Fractal low: low is lowest in the period
    for i in range(len(data)):
        if i < period - 1:
            upper.append(None)
            lower.append(None)
        else:
            slice_data = data[i - period + 1 : i + period]
            if len(slice_data) < period * 2 - 1:
                upper.append(None)
                lower.append(None)
                continue

            center_idx = period - 1
            center_high = to_number(
                slice_data[center_idx].get("high_price")
            ) or to_number(slice_data[center_idx].get("close_price"))
            center_low = to_number(
                slice_data[center_idx].get("low_price")
            ) or to_number(slice_data[center_idx].get("close_price"))

            if center_high is None or center_low is None:
                upper.append(None)
                lower.append(None)
                continue

            # For simplicity, use highest high and lowest low in the period
            highs = [
                to_number(item.get("high_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]
            lows = [
                to_number(item.get("low_price")) or to_number(item.get("close_price"))
                for item in slice_data
            ]

            valid_highs = [h for h in highs if h is not None]
            valid_lows = [low for low in lows if low is not None]

            if valid_highs and valid_lows:
                upper.append(max(valid_highs))
                lower.append(min(valid_lows))
            else:
                upper.append(None)
                lower.append(None)

    return {"upper": upper, "lower": lower}


def calculate_mfi(data: list[dict], period: int = 14) -> list[float | None]:
    """
    Calculate Money Flow Index (MFI).

    Args:
        data: List of price data dictionaries with volume
        period: Period for MFI calculation (default: 14)

    Returns:
        List of MFI values (0-100)
    """
    if not data or len(data) < 2:
        return [None] * len(data) if data else []

    if period < 1:
        return [None] * len(data)

    result: list[float | None] = [None]  # First value is None

    raw_money_flow: list[float] = []
    positive_flow: list[float] = []
    negative_flow: list[float] = []

    for i in range(1, len(data)):
        high = (
            to_number(data[i].get("high_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )
        low = (
            to_number(data[i].get("low_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )
        close = to_number(data[i].get("close_price")) or 0.0
        volume = to_number(data[i].get("volume")) or 0.0

        prev_close = to_number(data[i - 1].get("close_price")) or 0.0

        typical_price = (high + low + close) / 3.0
        money_flow = typical_price * volume
        raw_money_flow.append(money_flow)

        if typical_price > prev_close:
            positive_flow.append(money_flow)
            negative_flow.append(0.0)
        elif typical_price < prev_close:
            positive_flow.append(0.0)
            negative_flow.append(money_flow)
        else:
            positive_flow.append(0.0)
            negative_flow.append(0.0)

    # Calculate MFI
    for i in range(1, len(data)):
        if i < period:
            result.append(None)
        else:
            sum_positive = sum(positive_flow[i - period : i])
            sum_negative = sum(negative_flow[i - period : i])

            if sum_negative == 0:
                result.append(100.0)
            else:
                money_flow_ratio = sum_positive / sum_negative
                mfi = 100.0 - (100.0 / (1.0 + money_flow_ratio))
                result.append(mfi if not (math.isnan(mfi) or math.isinf(mfi)) else None)

    return result


def calculate_momentum(
    data: list[dict], period: int = 10, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Momentum Indicator.

    Args:
        data: List of price data dictionaries
        period: Period for momentum calculation (default: 10)
        price_field: Field name for price

    Returns:
        List of momentum values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    result: list[float | None] = []

    for i in range(len(data)):
        if i < period:
            result.append(None)
        else:
            current_price = to_number(data[i].get(price_field))
            past_price = to_number(data[i - period].get(price_field))

            if current_price is not None and past_price is not None:
                momentum = current_price - past_price
                result.append(
                    momentum
                    if not (math.isnan(momentum) or math.isinf(momentum))
                    else None
                )
            else:
                result.append(None)

    return result


def calculate_proc(
    data: list[dict], period: int = 12, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Price Rate of Change (PROC).

    Args:
        data: List of price data dictionaries
        period: Period for PROC calculation (default: 12)
        price_field: Field name for price

    Returns:
        List of PROC values (percentage)
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    result: list[float | None] = []

    for i in range(len(data)):
        if i < period:
            result.append(None)
        else:
            current_price = to_number(data[i].get(price_field))
            past_price = to_number(data[i - period].get(price_field))

            if current_price is not None and past_price is not None and past_price != 0:
                proc = ((current_price - past_price) / past_price) * 100.0
                result.append(
                    proc if not (math.isnan(proc) or math.isinf(proc)) else None
                )
            else:
                result.append(None)

    return result


def calculate_atr_trailing_stop(
    data: list[dict], period: int = 14, multiplier: float = 2.0
) -> list[float | None]:
    """
    Calculate ATR Trailing Stop Loss.

    Args:
        data: List of price data dictionaries
        period: Period for ATR calculation (default: 14)
        multiplier: ATR multiplier (default: 2.0)

    Returns:
        List of ATR trailing stop values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    # Calculate ATR
    atr = calculate_atr(data, period)

    # Calculate trailing stop
    result: list[float | None] = [None]
    trend = None  # 1 for uptrend, -1 for downtrend
    trailing_stop = None

    for i in range(1, len(data)):
        high = (
            to_number(data[i].get("high_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )
        low = (
            to_number(data[i].get("low_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )
        close = to_number(data[i].get("close_price")) or 0.0

        if atr[i] is None:
            result.append(None)
            continue

        if i == 1:
            # Initialize
            trailing_stop = close - multiplier * atr[i]
            trend = 1
            result.append(trailing_stop)
            continue

        prev_trailing = result[i - 1]
        if prev_trailing is None:
            trailing_stop = close - multiplier * atr[i]
            trend = 1
            result.append(trailing_stop)
            continue

        if trend == 1:
            # Uptrend: trailing stop below price
            new_trailing = close - multiplier * atr[i]
            trailing_stop = max(prev_trailing, new_trailing)

            if low < trailing_stop:
                # Trend reversal
                trend = -1
                trailing_stop = close + multiplier * atr[i]
        else:
            # Downtrend: trailing stop above price
            new_trailing = close + multiplier * atr[i]
            trailing_stop = min(prev_trailing, new_trailing)

            if high > trailing_stop:
                # Trend reversal
                trend = 1
                trailing_stop = close - multiplier * atr[i]

        result.append(trailing_stop)

    return result


def calculate_supertrend(
    data: list[dict], period: int = 10, multiplier: float = 3.0
) -> dict[str, list[float | None]]:
    """
    Calculate Supertrend indicator.

    Args:
        data: List of price data dictionaries
        period: Period for ATR calculation (default: 10)
        multiplier: ATR multiplier (default: 3.0)

    Returns:
        Dictionary with 'supertrend' and 'trend' lists (trend: 1 for up, -1 for down)
    """
    if not data:
        return {"supertrend": [], "trend": []}

    if period < 1:
        return {
            "supertrend": [None] * len(data),
            "trend": [None] * len(data),
        }

    # Calculate ATR
    atr = calculate_atr(data, period)

    supertrend: list[float | None] = []
    trend: list[int | None] = []

    for i in range(len(data)):
        if i == 0 or atr[i] is None:
            supertrend.append(None)
            trend.append(None)
            continue

        high = (
            to_number(data[i].get("high_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )
        low = (
            to_number(data[i].get("low_price"))
            or to_number(data[i].get("close_price"))
            or 0.0
        )
        close = to_number(data[i].get("close_price")) or 0.0

        hl_avg = (high + low) / 2.0
        upper_band = hl_avg + multiplier * atr[i]
        lower_band = hl_avg - multiplier * atr[i]

        if i == 1:
            supertrend.append(lower_band)
            trend.append(1)
            continue

        prev_supertrend = supertrend[i - 1]
        prev_trend = trend[i - 1]

        if prev_supertrend is None or prev_trend is None:
            supertrend.append(lower_band)
            trend.append(1)
            continue

        # Update bands
        if prev_trend == 1:
            upper_band = min(upper_band, prev_supertrend)
        else:
            lower_band = max(lower_band, prev_supertrend)

        # Determine trend
        if close > upper_band:
            current_trend = 1
            current_supertrend = lower_band
        elif close < lower_band:
            current_trend = -1
            current_supertrend = upper_band
        else:
            current_trend = prev_trend
            current_supertrend = lower_band if prev_trend == 1 else upper_band

        supertrend.append(current_supertrend)
        trend.append(current_trend)

    return {"supertrend": supertrend, "trend": trend}


def calculate_alligator(
    data: list[dict],
    jaw_period: int = 13,
    teeth_period: int = 8,
    lips_period: int = 5,
    price_field: str = "close_price",
) -> dict[str, list[float | None]]:
    """
    Calculate Alligator indicator (Jaw, Teeth, Lips).

    Args:
        data: List of price data dictionaries
        jaw_period: Period for Jaw (default: 13)
        teeth_period: Period for Teeth (default: 8)
        lips_period: Period for Lips (default: 5)
        price_field: Field name for price

    Returns:
        Dictionary with 'jaw', 'teeth', and 'lips' lists
    """
    if not data:
        return {"jaw": [], "teeth": [], "lips": []}

    # Alligator uses Smoothed Moving Average (SMMA)
    # SMMA is similar to EMA but with different calculation
    # For simplicity, we'll use EMA as approximation

    jaw = calculate_ema(data, jaw_period, price_field)
    teeth = calculate_ema(data, teeth_period, price_field)
    lips = calculate_ema(data, lips_period, price_field)

    return {"jaw": jaw, "teeth": teeth, "lips": lips}


def calculate_linear_regression(
    data: list[dict], period: int = 14, price_field: str = "close_price"
) -> list[float | None]:
    """
    Calculate Linear Regression Forecast.

    Args:
        data: List of price data dictionaries
        period: Period for linear regression (default: 14)
        price_field: Field name for price

    Returns:
        List of linear regression forecast values
    """
    if not data:
        return []

    if period < 1:
        return [None] * len(data)

    result: list[float | None] = []

    for i in range(len(data)):
        if i < period - 1:
            result.append(None)
        else:
            slice_data = data[i - period + 1 : i + 1]
            prices = [to_number(item.get(price_field)) for item in slice_data]
            valid_prices = [p for p in prices if p is not None]

            if len(valid_prices) < period:
                result.append(None)
                continue

            # Calculate linear regression: y = a + b*x
            # where x is the index (0 to period-1) and y is the price
            n = period
            sum_x = sum(range(n))
            sum_y = sum(valid_prices)
            sum_xy = sum(j * valid_prices[j] for j in range(n))
            sum_x2 = sum(j * j for j in range(n))

            denominator = n * sum_x2 - sum_x * sum_x
            if denominator == 0:
                result.append(None)
                continue

            b = (n * sum_xy - sum_x * sum_y) / denominator
            a = (sum_y - b * sum_x) / n

            # Forecast for next period (x = n)
            forecast = a + b * n
            result.append(
                forecast if not (math.isnan(forecast) or math.isinf(forecast)) else None
            )

    return result
