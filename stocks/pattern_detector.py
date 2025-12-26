"""
Chart Pattern Detection Utilities
Backend implementation of candlestick pattern detection for trading bot analysis.
"""

import logging
import math
from typing import Any

logger = logging.getLogger(__name__)


def to_number(value: Any) -> float | None:
    """Convert a value to a number."""
    if value is None:
        return None
    if isinstance(value, int | float):
        num = float(value)
        return num if not (math.isnan(num) or math.isinf(num)) else None
    if isinstance(value, str):
        try:
            num = float(value)
        except (ValueError, TypeError):
            return None
        else:
            return num if not (math.isnan(num) or math.isinf(num)) else None
    return None


class Candlestick:
    """Represents a single candlestick."""

    def __init__(
        self, open_price: float, high: float, low: float, close: float, index: int
    ):
        self.open = open_price
        self.high = high
        self.low = low
        self.close = close
        self.index = index

    @property
    def is_bullish(self) -> bool:
        """Check if candle is bullish (close > open)."""
        return self.close > self.open

    @property
    def body_size(self) -> float:
        """Get body size."""
        return abs(self.close - self.open)

    @property
    def upper_wick(self) -> float:
        """Get upper wick size."""
        return self.high - max(self.open, self.close)

    @property
    def lower_wick(self) -> float:
        """Get lower wick size."""
        return min(self.open, self.close) - self.low

    @property
    def total_range(self) -> float:
        """Get total range (high - low)."""
        return self.high - self.low if self.high > self.low else 0.0


class PatternMatch:
    """Represents a detected pattern match."""

    def __init__(
        self,
        pattern: str,
        pattern_name: str,
        index: int,
        candles: int,
        signal: str,
        confidence: float,
        description: str,
    ):
        self.pattern = pattern
        self.pattern_name = pattern_name
        self.index = index
        self.candles = candles
        self.signal = signal  # "bullish", "bearish", or "neutral"
        self.confidence = confidence  # 0.0 to 1.0
        self.description = description

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "pattern": self.pattern,
            "pattern_name": self.pattern_name,
            "index": self.index,
            "candles": self.candles,
            "signal": self.signal,
            "confidence": self.confidence,
            "description": self.description,
        }


def to_candlestick(data: dict, index: int) -> Candlestick | None:
    """Convert price data to Candlestick object."""
    open_price = to_number(data.get("open_price")) or to_number(data.get("close_price"))
    high = to_number(data.get("high_price")) or to_number(data.get("close_price"))
    low = to_number(data.get("low_price")) or to_number(data.get("close_price"))
    close = to_number(data.get("close_price"))

    if open_price is None or high is None or low is None or close is None:
        return None

    return Candlestick(open_price, high, low, close, index)


def detect_three_white_soldiers(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Three White Soldiers pattern (bullish reversal).

    Three consecutive bullish candles, each closing higher than the previous.
    """
    matches: list[PatternMatch] = []

    for i in range(2, len(data)):
        c1 = to_candlestick(data[i - 2], i - 2)
        c2 = to_candlestick(data[i - 1], i - 1)
        c3 = to_candlestick(data[i], i)

        if not (c1 and c2 and c3):
            continue

        # All three candles should be bullish
        if not (c1.is_bullish and c2.is_bullish and c3.is_bullish):
            continue

        # Each candle should close higher than the previous
        if not (c2.close > c1.close and c3.close > c2.close):
            continue

        # Each candle should open within the previous candle's body
        if not (c2.open > c1.open and c3.open > c2.open):
            continue

        # All candles should have relatively small wicks
        if c1.total_range == 0 or c2.total_range == 0 or c3.total_range == 0:
            continue

        wick_ratio1 = (c1.upper_wick + c1.lower_wick) / c1.total_range
        wick_ratio2 = (c2.upper_wick + c2.lower_wick) / c2.total_range
        wick_ratio3 = (c3.upper_wick + c3.lower_wick) / c3.total_range

        if wick_ratio1 > 0.4 or wick_ratio2 > 0.4 or wick_ratio3 > 0.4:
            continue

        matches.append(
            PatternMatch(
                pattern="three_white_soldiers",
                pattern_name="Three White Soldiers",
                index=i,
                candles=3,
                signal="bullish",
                confidence=0.8,
                description="Strong bullish reversal pattern. Three consecutive bullish candles with each closing higher than the previous.",
            )
        )

    return matches


def detect_morning_doji_star(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Morning Doji Star pattern (bullish reversal).

    Bearish candle, doji, then bullish candle.
    """
    matches: list[PatternMatch] = []

    for i in range(2, len(data)):
        c1 = to_candlestick(data[i - 2], i - 2)
        c2 = to_candlestick(data[i - 1], i - 1)
        c3 = to_candlestick(data[i], i)

        if not (c1 and c2 and c3):
            continue

        # First candle should be bearish
        if c1.is_bullish:
            continue

        # Second candle should be a doji (small body)
        doji_threshold = c2.total_range * 0.1
        if c2.body_size > doji_threshold:
            continue

        # Third candle should be bullish and close above first candle's midpoint
        if not c3.is_bullish:
            continue

        midpoint = (c1.open + c1.close) / 2.0
        if c3.close <= midpoint:
            continue

        matches.append(
            PatternMatch(
                pattern="morning_doji_star",
                pattern_name="Morning Doji Star",
                index=i,
                candles=3,
                signal="bullish",
                confidence=0.75,
                description="Bullish reversal pattern with a bearish candle, doji, and bullish candle.",
            )
        )

    return matches


def detect_engulfing(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Engulfing pattern (bullish or bearish).

    Bullish: Bearish candle followed by larger bullish candle that engulfs it.
    Bearish: Bullish candle followed by larger bearish candle that engulfs it.
    """
    matches: list[PatternMatch] = []

    for i in range(1, len(data)):
        c1 = to_candlestick(data[i - 1], i - 1)
        c2 = to_candlestick(data[i], i)

        if not (c1 and c2):
            continue

        # Bullish engulfing
        if (
            not c1.is_bullish
            and c2.is_bullish
            and c2.open < c1.close
            and c2.close > c1.open
            and c2.body_size > c1.body_size
        ):
            matches.append(
                PatternMatch(
                    pattern="bullish_engulfing",
                    pattern_name="Bullish Engulfing",
                    index=i,
                    candles=2,
                    signal="bullish",
                    confidence=0.7,
                    description="Bullish reversal pattern. Bearish candle followed by larger bullish candle that engulfs it.",
                )
            )

        # Bearish engulfing
        elif (
            c1.is_bullish
            and not c2.is_bullish
            and c2.open > c1.close
            and c2.close < c1.open
            and c2.body_size > c1.body_size
        ):
            matches.append(
                PatternMatch(
                    pattern="bearish_engulfing",
                    pattern_name="Bearish Engulfing",
                    index=i,
                    candles=2,
                    signal="bearish",
                    confidence=0.7,
                    description="Bearish reversal pattern. Bullish candle followed by larger bearish candle that engulfs it.",
                )
            )

    return matches


def detect_abandoned_baby(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Abandoned Baby pattern (bullish reversal).

    Bearish candle, doji with gaps on both sides, then bullish candle.
    """
    matches: list[PatternMatch] = []

    for i in range(2, len(data)):
        c1 = to_candlestick(data[i - 2], i - 2)
        c2 = to_candlestick(data[i - 1], i - 1)
        c3 = to_candlestick(data[i], i)

        if not (c1 and c2 and c3):
            continue

        # First candle should be bearish
        if c1.is_bullish:
            continue

        # Second candle should be a doji with gaps
        doji_threshold = c2.total_range * 0.1
        if c2.body_size > doji_threshold:
            continue

        # Check for gaps
        gap_down = c2.high < c1.low
        gap_up = c3.low > c2.high

        if not (gap_down and gap_up):
            continue

        # Third candle should be bullish
        if not c3.is_bullish:
            continue

        matches.append(
            PatternMatch(
                pattern="abandoned_baby",
                pattern_name="Abandoned Baby",
                index=i,
                candles=3,
                signal="bullish",
                confidence=0.85,
                description="Strong bullish reversal pattern with gaps on both sides of a doji.",
            )
        )

    return matches


def detect_all_patterns(
    data: list[dict], selected_patterns: list[str] | None = None
) -> list[PatternMatch]:
    """
    Detect all patterns in the data.

    Args:
        data: List of price data dictionaries
        selected_patterns: List of pattern IDs to detect (None = all patterns)

    Returns:
        List of PatternMatch objects
    """
    all_matches: list[PatternMatch] = []

    pattern_detectors = {
        "three_white_soldiers": detect_three_white_soldiers,
        "morning_doji_star": detect_morning_doji_star,
        "engulfing": detect_engulfing,
        "bullish_engulfing": detect_engulfing,
        "bearish_engulfing": detect_engulfing,
        "abandoned_baby": detect_abandoned_baby,
    }

    patterns_to_detect = (
        selected_patterns if selected_patterns else list(pattern_detectors.keys())
    )

    for pattern_id in patterns_to_detect:
        detector = pattern_detectors.get(pattern_id)
        if detector:
            try:
                matches = detector(data)
                all_matches.extend(matches)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Error detecting pattern {pattern_id}: {e}")

    # Sort by index
    all_matches.sort(key=lambda x: x.index)

    return all_matches
