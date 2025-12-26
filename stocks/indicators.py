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
