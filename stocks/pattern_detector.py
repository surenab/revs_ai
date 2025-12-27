"""
Chart Pattern Detection Utilities
Backend implementation of candlestick pattern detection for trading bot analysis.
"""

import logging
import math
from typing import Any

logger = logging.getLogger(__name__)


def to_number(value: Any) -> float | None:  # noqa: PLR0911
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
    # Handle Decimal type
    if hasattr(value, "__float__"):
        try:
            num = float(value)
            return num if not (math.isnan(num) or math.isinf(num)) else None
        except (ValueError, TypeError):
            return None
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


def detect_head_and_shoulders(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Head and Shoulders pattern (bearish reversal).

    Three peaks: left shoulder, higher head, right shoulder at similar level.
    """
    matches: list[PatternMatch] = []

    if len(data) < 20:
        return matches

    for i in range(20, len(data)):
        # Look for three peaks
        peaks = []
        for j in range(i - 20, i):
            if j > 0 and j < len(data) - 1:
                high = to_number(data[j].get("high_price"))
                prev_high = to_number(data[j - 1].get("high_price"))
                next_high = to_number(data[j + 1].get("high_price"))

                if (
                    high
                    and prev_high
                    and next_high
                    and high > prev_high
                    and high > next_high
                ):
                    peaks.append((j, high))

        if len(peaks) >= 3:
            # Check if peaks form head and shoulders pattern
            peaks = sorted(peaks, key=lambda x: x[0])[-3:]  # Last 3 peaks
            left_shoulder_idx, left_shoulder_high = peaks[0]
            _, head_high = peaks[1]
            _, right_shoulder_high = peaks[2]

            # Head should be higher than both shoulders
            # Shoulders should be at similar levels
            shoulder_diff = abs(left_shoulder_high - right_shoulder_high) / max(
                left_shoulder_high, right_shoulder_high
            )
            head_above = (
                head_high > left_shoulder_high and head_high > right_shoulder_high
            )

            if head_above and shoulder_diff < 0.05:  # Shoulders within 5% of each other
                # Check for neckline (troughs between peaks)
                confidence = 0.75 if shoulder_diff < 0.02 else 0.65
                matches.append(
                    PatternMatch(
                        pattern="head_and_shoulders",
                        pattern_name="Head and Shoulders",
                        index=i,
                        candles=i - left_shoulder_idx,
                        signal="bearish",
                        confidence=confidence,
                        description=f"Bearish reversal pattern. Head at {head_high:.2f}, shoulders at ~{left_shoulder_high:.2f}",
                    )
                )

    return matches


def detect_double_top(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Double Top pattern (bearish reversal).

    Two peaks at similar levels with a trough between them.
    """
    matches: list[PatternMatch] = []

    if len(data) < 15:
        return matches

    for i in range(15, len(data)):
        # Look for two peaks
        peaks = []
        for j in range(i - 15, i):
            if j > 0 and j < len(data) - 1:
                high = to_number(data[j].get("high_price"))
                prev_high = to_number(data[j - 1].get("high_price"))
                next_high = to_number(data[j + 1].get("high_price"))

                if (
                    high
                    and prev_high
                    and next_high
                    and high > prev_high
                    and high > next_high
                ):
                    peaks.append((j, high))

        if len(peaks) >= 2:
            peaks = sorted(peaks, key=lambda x: x[0])[-2:]  # Last 2 peaks
            peak1_idx, peak1_high = peaks[0]
            peak2_idx, peak2_high = peaks[1]

            # Peaks should be at similar levels
            peak_diff = abs(peak1_high - peak2_high) / max(peak1_high, peak2_high)
            if peak_diff < 0.03:  # Within 3%
                # Check for trough between peaks
                trough = min(
                    to_number(data[j].get("low_price")) or float("inf")
                    for j in range(peak1_idx, peak2_idx)
                )
                if trough < float("inf"):
                    confidence = 0.7 if peak_diff < 0.01 else 0.6
                    matches.append(
                        PatternMatch(
                            pattern="double_top",
                            pattern_name="Double Top",
                            index=i,
                            candles=i - peak1_idx,
                            signal="bearish",
                            confidence=confidence,
                            description=f"Bearish reversal pattern. Two peaks at ~{peak1_high:.2f}",
                        )
                    )

    return matches


def detect_double_bottom(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Double Bottom pattern (bullish reversal).

    Two troughs at similar levels with a peak between them.
    """
    matches: list[PatternMatch] = []

    if len(data) < 15:
        return matches

    for i in range(15, len(data)):
        # Look for two troughs
        troughs = []
        for j in range(i - 15, i):
            if j > 0 and j < len(data) - 1:
                low = to_number(data[j].get("low_price"))
                prev_low = to_number(data[j - 1].get("low_price"))
                next_low = to_number(data[j + 1].get("low_price"))

                if low and prev_low and next_low and low < prev_low and low < next_low:
                    troughs.append((j, low))

        if len(troughs) >= 2:
            troughs = sorted(troughs, key=lambda x: x[0])[-2:]  # Last 2 troughs
            trough1_idx, trough1_low = troughs[0]
            trough2_idx, trough2_low = troughs[1]

            # Troughs should be at similar levels
            trough_diff = abs(trough1_low - trough2_low) / max(trough1_low, trough2_low)
            if trough_diff < 0.03:  # Within 3%
                # Check for peak between troughs
                peak = max(
                    to_number(data[j].get("high_price")) or 0.0
                    for j in range(trough1_idx, trough2_idx)
                )
                if peak > 0:
                    confidence = 0.7 if trough_diff < 0.01 else 0.6
                    matches.append(
                        PatternMatch(
                            pattern="double_bottom",
                            pattern_name="Double Bottom",
                            index=i,
                            candles=i - trough1_idx,
                            signal="bullish",
                            confidence=confidence,
                            description=f"Bullish reversal pattern. Two troughs at ~{trough1_low:.2f}",
                        )
                    )

    return matches


def detect_flag(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Flag pattern (continuation).

    Sharp price movement (flagpole) followed by consolidation (flag).
    """
    matches: list[PatternMatch] = []

    if len(data) < 10:
        return matches

    for i in range(10, len(data)):
        # Look for flagpole (sharp move)
        flagpole_start = i - 10
        flagpole_end = i - 5
        flag_start = i - 5
        flag_end = i

        flagpole_high = max(
            to_number(data[j].get("high_price")) or 0.0
            for j in range(flagpole_start, flagpole_end)
        )
        flagpole_low = min(
            to_number(data[j].get("low_price")) or float("inf")
            for j in range(flagpole_start, flagpole_end)
        )
        flag_high = max(
            to_number(data[j].get("high_price")) or 0.0
            for j in range(flag_start, flag_end)
        )
        flag_low = min(
            to_number(data[j].get("low_price")) or float("inf")
            for j in range(flag_start, flag_end)
        )

        if flagpole_low < float("inf") and flag_low < float("inf"):
            flagpole_size = flagpole_high - flagpole_low
            flag_size = flag_high - flag_low

            # Flagpole should be significant
            # Flag should be smaller and consolidating
            if flagpole_size > 0 and flag_size > 0:
                flagpole_ratio = flagpole_size / flag_low if flag_low > 0 else 0
                flag_ratio = flag_size / flag_low if flag_low > 0 else 0

                # Flag should be 20-50% of flagpole
                if 0.2 <= flag_ratio / flagpole_ratio <= 0.5 and flagpole_ratio > 0.05:
                    # Determine direction
                    start_price = (
                        to_number(data[flagpole_start].get("close_price")) or 0.0
                    )
                    end_price = to_number(data[flag_end].get("close_price")) or 0.0
                    direction = "bullish" if end_price > start_price else "bearish"

                    matches.append(
                        PatternMatch(
                            pattern="flag",
                            pattern_name="Flag",
                            index=i,
                            candles=10,
                            signal=direction,
                            confidence=0.65,
                            description=f"{direction.capitalize()} continuation pattern. Flagpole: {flagpole_size:.2f}, Flag: {flag_size:.2f}",
                        )
                    )

    return matches


def detect_pennant(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Pennant pattern (continuation).

    Sharp price movement followed by converging trend lines.
    """
    matches: list[PatternMatch] = []

    if len(data) < 10:
        return matches

    for i in range(10, len(data)):
        # Look for pennant (similar to flag but with converging lines)
        flagpole_start = i - 10
        flagpole_end = i - 6
        pennant_start = i - 6
        pennant_end = i

        flagpole_high = max(
            to_number(data[j].get("high_price")) or 0.0
            for j in range(flagpole_start, flagpole_end)
        )
        flagpole_low = min(
            to_number(data[j].get("low_price")) or float("inf")
            for j in range(flagpole_start, flagpole_end)
        )

        # Check for converging trend in pennant
        pennant_highs = [
            to_number(data[j].get("high_price"))
            for j in range(pennant_start, pennant_end)
        ]
        pennant_lows = [
            to_number(data[j].get("low_price"))
            for j in range(pennant_start, pennant_end)
        ]

        valid_highs = [h for h in pennant_highs if h is not None]
        valid_lows = [
            low for low in pennant_lows if low is not None and low < float("inf")
        ]

        if (
            len(valid_highs) >= 3
            and len(valid_lows) >= 3
            and flagpole_low < float("inf")
        ):
            # Check if highs are decreasing and lows are increasing (converging)
            high_trend = valid_highs[-1] < valid_highs[0]
            low_trend = valid_lows[-1] > valid_lows[0]

            if high_trend and low_trend:
                flagpole_size = flagpole_high - flagpole_low
                pennant_size = max(valid_highs) - min(valid_lows)

                if flagpole_size > 0 and pennant_size > 0:
                    flagpole_ratio = (
                        flagpole_size / flagpole_low if flagpole_low > 0 else 0
                    )
                    pennant_ratio = (
                        pennant_size / min(valid_lows) if min(valid_lows) > 0 else 0
                    )

                    # Pennant should be smaller than flagpole
                    if pennant_ratio < flagpole_ratio * 0.6 and flagpole_ratio > 0.05:
                        start_price = (
                            to_number(data[flagpole_start].get("close_price")) or 0.0
                        )
                        end_price = (
                            to_number(data[pennant_end].get("close_price")) or 0.0
                        )
                        direction = "bullish" if end_price > start_price else "bearish"

                        matches.append(
                            PatternMatch(
                                pattern="pennant",
                                pattern_name="Pennant",
                                index=i,
                                candles=10,
                                signal=direction,
                                confidence=0.7,
                                description=f"{direction.capitalize()} continuation pattern with converging trend lines",
                            )
                        )

    return matches


def detect_wedge(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Wedge pattern (reversal or continuation).

    Converging trend lines, can be rising or falling.
    """
    matches: list[PatternMatch] = []

    if len(data) < 15:
        return matches

    for i in range(15, len(data)):
        # Look for wedge (converging lines over longer period)
        wedge_start = i - 15
        wedge_end = i

        highs = [
            to_number(data[j].get("high_price")) for j in range(wedge_start, wedge_end)
        ]
        lows = [
            to_number(data[j].get("low_price")) for j in range(wedge_start, wedge_end)
        ]

        valid_highs = [h for h in highs if h is not None]
        valid_lows = [low for low in lows if low is not None and low < float("inf")]

        if len(valid_highs) >= 5 and len(valid_lows) >= 5:
            # Check for converging trend
            high_trend = valid_highs[-1] < valid_highs[0]
            low_trend = valid_lows[-1] > valid_lows[0]

            # Both should be converging
            if high_trend and low_trend:
                # Determine if rising or falling wedge
                start_price = to_number(data[wedge_start].get("close_price")) or 0.0
                end_price = to_number(data[wedge_end].get("close_price")) or 0.0

                if end_price > start_price:
                    pattern_type = "rising_wedge"
                    signal = "bearish"  # Rising wedge is bearish
                    confidence = 0.65
                else:
                    pattern_type = "falling_wedge"
                    signal = "bullish"  # Falling wedge is bullish
                    confidence = 0.65

                matches.append(
                    PatternMatch(
                        pattern=pattern_type,
                        pattern_name=pattern_type.replace("_", " ").title(),
                        index=i,
                        candles=15,
                        signal=signal,
                        confidence=confidence,
                        description=f"{signal.capitalize()} {pattern_type.replace('_', ' ')} pattern with converging trend lines",
                    )
                )

    return matches


def detect_tri_star(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Tri Star pattern (neutral reversal).

    Three consecutive doji candles with gaps between them.
    """
    matches: list[PatternMatch] = []

    for i in range(2, len(data)):
        c1 = to_candlestick(data[i - 2], i - 2)
        c2 = to_candlestick(data[i - 1], i - 1)
        c3 = to_candlestick(data[i], i)

        if not (c1 and c2 and c3):
            continue

        # All three candles should be dojis (small body)
        doji_threshold = 0.1
        if (
            c1.body_size / c1.total_range > doji_threshold
            or c2.body_size / c2.total_range > doji_threshold
            or c3.body_size / c3.total_range > doji_threshold
        ):
            continue

        # There should be gaps between the candles
        if c2.low <= c1.high or c3.low <= c2.high:
            continue

        # Determine signal based on position
        signal = "bullish" if c3.close > c1.close else "bearish"

        matches.append(
            PatternMatch(
                pattern="tri_star",
                pattern_name="Tri Star",
                index=i,
                candles=3,
                signal=signal,
                confidence=0.75,
                description="Reversal pattern. Three consecutive doji candles with gaps between them, indicating indecision and potential reversal.",
            )
        )

    return matches


def detect_advance_block(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Advance Block pattern (bearish reversal).

    Three bullish candles with decreasing body sizes and increasing upper wicks.
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

        # But the bodies should be getting smaller (weakening momentum)
        if not (c2.body_size < c1.body_size and c3.body_size < c2.body_size):
            continue

        # Upper wicks should be getting longer
        if not (c2.upper_wick > c1.upper_wick and c3.upper_wick > c2.upper_wick):
            continue

        matches.append(
            PatternMatch(
                pattern="advance_block",
                pattern_name="Advance Block",
                index=i,
                candles=3,
                signal="bearish",
                confidence=0.7,
                description="Bearish reversal pattern. Three bullish candles with decreasing body sizes and increasing upper wicks, indicating weakening upward momentum.",
            )
        )

    return matches


def detect_conceal_baby_swallow(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Conceal Baby Swallow pattern (bullish continuation).

    Four candles: two bearish marubozu, gap down bearish, then small bearish.
    """
    matches: list[PatternMatch] = []

    for i in range(3, len(data)):
        c1 = to_candlestick(data[i - 3], i - 3)
        c2 = to_candlestick(data[i - 2], i - 2)
        c3 = to_candlestick(data[i - 1], i - 1)
        c4 = to_candlestick(data[i], i)

        if not (c1 and c2 and c3 and c4):
            continue

        # First two candles should be bearish marubozu (no wicks)
        if c1.is_bullish or c2.is_bullish:
            continue
        if c1.upper_wick > 0.01 or c1.lower_wick > 0.01:
            continue
        if c2.upper_wick > 0.01 or c2.lower_wick > 0.01:
            continue

        # Third candle should gap down and be bearish
        if c3.low >= c2.close:  # No gap down
            continue
        if c3.is_bullish:
            continue

        # Fourth candle should be a small bearish candle within the third candle's range
        if c4.is_bullish:
            continue
        if c4.high > c3.high or c4.low < c3.low:
            continue
        if c4.body_size >= c3.body_size:
            continue

        matches.append(
            PatternMatch(
                pattern="conceal_baby_swallow",
                pattern_name="Conceal Baby Swallow",
                index=i,
                candles=4,
                signal="bullish",
                confidence=0.8,
                description="Bullish continuation pattern. Two bearish marubozu candles, followed by a gap down bearish candle, then a smaller bearish candle, indicating potential reversal.",
            )
        )

    return matches


def detect_stick_sandwich(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Stick Sandwich pattern (bullish reversal).

    Two bearish candles with similar closes sandwiching a bullish candle.
    """
    matches: list[PatternMatch] = []

    for i in range(2, len(data)):
        c1 = to_candlestick(data[i - 2], i - 2)
        c2 = to_candlestick(data[i - 1], i - 1)
        c3 = to_candlestick(data[i], i)

        if not (c1 and c2 and c3):
            continue

        # First and third candles should be bearish with similar closes
        if c1.is_bullish or c3.is_bullish:
            continue
        close_diff = (
            abs(c1.close - c3.close) / max(c1.close, c3.close)
            if max(c1.close, c3.close) > 0
            else 1.0
        )
        if close_diff > 0.02:  # Closes should be within 2%
            continue

        # Second candle should be bullish and close above both first and third
        if not c2.is_bullish:
            continue
        if c2.close <= c1.close or c2.close <= c3.close:
            continue

        matches.append(
            PatternMatch(
                pattern="stick_sandwich",
                pattern_name="Stick Sandwich",
                index=i,
                candles=3,
                signal="bullish",
                confidence=0.75,
                description="Bullish reversal pattern. Two bearish candles with similar closes sandwiching a bullish candle that closes above both.",
            )
        )

    return matches


def detect_morning_star(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Morning Star pattern (bullish reversal).

    Bearish candle, small body (star), then bullish candle.
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

        # Second candle should have a small body (can be bullish or bearish)
        if c2.total_range == 0:
            continue
        body_ratio = c2.body_size / c2.total_range
        if body_ratio > 0.3:
            continue

        # There should be a gap between first and second candle
        if c2.low >= c1.close:  # No gap down
            continue

        # Third candle should be bullish and close above the midpoint of first candle
        if not c3.is_bullish:
            continue
        first_midpoint = (c1.open + c1.close) / 2.0
        if c3.close <= first_midpoint:
            continue

        matches.append(
            PatternMatch(
                pattern="morning_star",
                pattern_name="Morning Star",
                index=i,
                candles=3,
                signal="bullish",
                confidence=0.75,
                description="Bullish reversal pattern. Bearish candle, small body (star), then bullish candle closing above the first candle's midpoint.",
            )
        )

    return matches


def detect_kicking(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Kicking pattern (bullish reversal).

    Two marubozu candles with a gap between them.
    """
    matches: list[PatternMatch] = []

    for i in range(1, len(data)):
        c1 = to_candlestick(data[i - 1], i - 1)
        c2 = to_candlestick(data[i], i)

        if not (c1 and c2):
            continue

        # First candle should be bearish marubozu (no wicks)
        if c1.is_bullish:
            continue
        if c1.upper_wick > 0.01 or c1.lower_wick > 0.01:
            continue

        # Second candle should be bullish marubozu (no wicks)
        if not c2.is_bullish:
            continue
        if c2.upper_wick > 0.01 or c2.lower_wick > 0.01:
            continue

        # There should be a gap between them
        if c2.low <= c1.high:
            continue

        matches.append(
            PatternMatch(
                pattern="kicking",
                pattern_name="Kicking",
                index=i,
                candles=2,
                signal="bullish",
                confidence=0.85,
                description="Strong bullish reversal pattern. Two marubozu candles (bearish then bullish) with a gap between them, indicating a significant momentum shift.",
            )
        )

    return matches


def detect_spinning_top(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Spinning Top pattern (neutral/indecision).

    Small body with long wicks on both sides.
    """
    matches: list[PatternMatch] = []

    for i in range(len(data)):
        c = to_candlestick(data[i], i)

        if not c:
            continue

        if c.total_range == 0:
            continue

        # Small body relative to total range
        body_ratio = c.body_size / c.total_range
        if body_ratio > 0.3:
            continue

        # Long wicks on both sides
        upper_wick_ratio = c.upper_wick / c.total_range if c.total_range > 0 else 0
        lower_wick_ratio = c.lower_wick / c.total_range if c.total_range > 0 else 0

        if upper_wick_ratio < 0.3 or lower_wick_ratio < 0.3:
            continue

        matches.append(
            PatternMatch(
                pattern="spinning_top",
                pattern_name="Spinning Top",
                index=i,
                candles=1,
                signal="neutral",
                confidence=0.55,
                description="Indecision pattern. Small body with long wicks on both sides, indicating market uncertainty.",
            )
        )

    return matches


def detect_homing_pigeon(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Homing Pigeon pattern (bullish reversal).

    Two bearish candles where the second is contained within the first.
    """
    matches: list[PatternMatch] = []

    for i in range(1, len(data)):
        c1 = to_candlestick(data[i - 1], i - 1)
        c2 = to_candlestick(data[i], i)

        if not (c1 and c2):
            continue

        # Both candles should be bearish
        if c1.is_bullish or c2.is_bullish:
            continue

        # Second candle should be contained within the first
        if c2.high > c1.high or c2.low < c1.low:
            continue

        # Second candle should be smaller
        if c2.body_size >= c1.body_size:
            continue

        matches.append(
            PatternMatch(
                pattern="homing_pigeon",
                pattern_name="Homing Pigeon",
                index=i,
                candles=2,
                signal="bullish",
                confidence=0.65,
                description="Bullish reversal pattern. Two bearish candles where the second is smaller and contained within the first, suggesting weakening bearish momentum.",
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
        # Candlestick Patterns
        "three_white_soldiers": detect_three_white_soldiers,
        "morning_doji_star": detect_morning_doji_star,
        "morning_star": detect_morning_star,
        "abandoned_baby": detect_abandoned_baby,
        "conceal_baby_swallow": detect_conceal_baby_swallow,
        "stick_sandwich": detect_stick_sandwich,
        "kicking": detect_kicking,
        "engulfing": detect_engulfing,
        "bullish_engulfing": detect_engulfing,
        "bearish_engulfing": detect_engulfing,
        "homing_pigeon": detect_homing_pigeon,
        "advance_block": detect_advance_block,
        "tri_star": detect_tri_star,
        "spinning_top": detect_spinning_top,
        # Chart Patterns
        "head_and_shoulders": detect_head_and_shoulders,
        "double_top": detect_double_top,
        "double_bottom": detect_double_bottom,
        "flag": detect_flag,
        "pennant": detect_pennant,
        "wedge": detect_wedge,
        "rising_wedge": detect_wedge,
        "falling_wedge": detect_wedge,
    }

    # Only detect all patterns if selected_patterns is None (not provided)
    # If selected_patterns is an empty list, detect nothing
    if selected_patterns is None:
        patterns_to_detect = list(pattern_detectors.keys())
    elif len(selected_patterns) == 0:
        patterns_to_detect = []
    else:
        patterns_to_detect = selected_patterns

    for pattern_id in patterns_to_detect:
        detector = pattern_detectors.get(pattern_id)
        if detector:
            try:
                matches = detector(data)
                all_matches.extend(matches)
                if matches:
                    logger.debug(
                        f"Pattern {pattern_id}: detected {len(matches)} matches"
                    )
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Error detecting pattern {pattern_id}: {e}")
        else:
            logger.warning(
                f"Pattern detector not found for pattern_id: {pattern_id}. "
                f"Available patterns: {list(pattern_detectors.keys())}"
            )

    # Sort by index
    all_matches.sort(key=lambda x: x.index)

    return all_matches
