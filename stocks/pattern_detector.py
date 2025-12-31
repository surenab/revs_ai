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
        possible_gain: float | None = None,
        possible_loss: float | None = None,
        gain_probability: float | None = None,
        loss_probability: float | None = None,
        timeframe_prediction: dict | None = None,
        consequences: dict | None = None,
    ):
        self.pattern = pattern
        self.pattern_name = pattern_name
        self.index = index
        self.candles = candles
        self.signal = signal  # "bullish", "bearish", or "neutral"
        self.confidence = confidence  # 0.0 to 1.0
        self.description = description
        self.possible_gain = possible_gain
        self.possible_loss = possible_loss
        self.gain_probability = gain_probability
        self.loss_probability = loss_probability
        self.timeframe_prediction = timeframe_prediction or {}
        self.consequences = consequences or {}

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        result = {
            "pattern": self.pattern,
            "pattern_name": self.pattern_name,
            "index": self.index,
            "candles": self.candles,
            "signal": self.signal,
            "confidence": self.confidence,
            "description": self.description,
        }
        # Add prediction fields if they exist
        if self.possible_gain is not None:
            result["possible_gain"] = self.possible_gain
        if self.possible_loss is not None:
            result["possible_loss"] = self.possible_loss
        if self.gain_probability is not None:
            result["gain_probability"] = self.gain_probability
        if self.loss_probability is not None:
            result["loss_probability"] = self.loss_probability
        if self.timeframe_prediction:
            result["timeframe_prediction"] = self.timeframe_prediction
        if self.consequences:
            result["consequences"] = self.consequences
        return result


def _calculate_pattern_predictions(
    pattern_type: str,
    signal: str,
    confidence: float,
    price_data: list[dict] | None = None,
) -> dict:
    """
    Calculate predictions for pattern signals.

    Args:
        pattern_type: Type of pattern (e.g., 'three_white_soldiers')
        signal: Signal type ('bullish', 'bearish', 'neutral')
        confidence: Pattern confidence (0-1)
        price_data: Optional price data for calculating targets

    Returns:
        Dictionary with prediction fields
    """
    predictions: dict = {}

    # Pattern-specific parameters
    pattern_params: dict[str, dict] = {
        "three_white_soldiers": {
            "bullish_gain": (5.0, 15.0),
            "bullish_loss": (2.0, 5.0),
            "timeframe": ("3d", "7d", "5d"),
            "success_rate": 0.70,
        },
        "morning_doji_star": {
            "bullish_gain": (4.0, 12.0),
            "bullish_loss": (1.5, 4.0),
            "timeframe": ("3d", "7d", "5d"),
            "success_rate": 0.68,
        },
        "head_and_shoulders": {
            "bearish_gain": (3.0, 10.0),
            "bearish_loss": (2.0, 6.0),
            "timeframe": ("5d", "14d", "10d"),
            "success_rate": 0.65,
        },
        "double_top": {
            "bearish_gain": (3.0, 10.0),
            "bearish_loss": (2.0, 6.0),
            "timeframe": ("5d", "14d", "10d"),
            "success_rate": 0.63,
        },
        "double_bottom": {
            "bullish_gain": (4.0, 12.0),
            "bullish_loss": (1.5, 4.0),
            "timeframe": ("3d", "10d", "7d"),
            "success_rate": 0.66,
        },
        "trending_regime": {
            "bullish_gain": (5.0, 20.0),
            "bullish_loss": (2.0, 6.0),
            "bearish_gain": (5.0, 20.0),
            "bearish_loss": (2.0, 6.0),
            "timeframe": ("5d", "21d", "14d"),
            "success_rate": 0.68,
        },
        "ranging_regime": {
            "bullish_gain": (2.0, 8.0),
            "bullish_loss": (1.0, 3.0),
            "bearish_gain": (2.0, 8.0),
            "bearish_loss": (1.0, 3.0),
            "timeframe": ("3d", "14d", "7d"),
            "success_rate": 0.55,
        },
        "volatile_regime": {
            "bullish_gain": (3.0, 15.0),
            "bullish_loss": (2.0, 8.0),
            "bearish_gain": (3.0, 15.0),
            "bearish_loss": (2.0, 8.0),
            "timeframe": ("1d", "7d", "3d"),
            "success_rate": 0.50,
        },
        "regime_transition": {
            "bullish_gain": (4.0, 15.0),
            "bullish_loss": (2.0, 6.0),
            "bearish_gain": (4.0, 15.0),
            "bearish_loss": (2.0, 6.0),
            "timeframe": ("3d", "14d", "7d"),
            "success_rate": 0.60,
        },
    }

    # Get default parameters
    default_params = {
        "bullish_gain": (3.0, 10.0),
        "bullish_loss": (1.5, 4.0),
        "bearish_gain": (3.0, 10.0),
        "bearish_loss": (2.0, 6.0),
        "timeframe": ("3d", "7d", "5d"),
        "success_rate": 0.60,
    }

    params = pattern_params.get(pattern_type, default_params)

    if signal in ["bullish", "bearish"]:
        # Determine gain/loss ranges
        if signal == "bullish":
            gain_range = params.get("bullish_gain", default_params["bullish_gain"])
            loss_range = params.get("bullish_loss", default_params["bullish_loss"])
        else:
            gain_range = params.get("bearish_gain", default_params["bearish_gain"])
            loss_range = params.get("bearish_loss", default_params["bearish_loss"])

        # Calculate possible gain/loss scaled by confidence
        possible_gain = gain_range[0] + (gain_range[1] - gain_range[0]) * confidence
        possible_loss = loss_range[0] + (loss_range[1] - loss_range[0]) * (
            1.0 - confidence
        )

        predictions["possible_gain"] = round(possible_gain, 2)
        predictions["possible_loss"] = round(possible_loss, 2)

        # Calculate probabilities
        success_rate = params.get("success_rate", default_params["success_rate"])
        gain_probability = success_rate * confidence
        loss_probability = (1.0 - success_rate) * (1.0 - confidence)

        predictions["gain_probability"] = round(min(0.95, gain_probability), 4)
        predictions["loss_probability"] = round(min(0.95, loss_probability), 4)

        # Timeframe prediction
        tf_min, tf_max, tf_expected = params.get(
            "timeframe", default_params["timeframe"]
        )
        predictions["timeframe_prediction"] = {
            "min_timeframe": tf_min,
            "max_timeframe": tf_max,
            "expected_timeframe": tf_expected,
            "timeframe_confidence": round(confidence, 4),
        }

        # Scenario analysis
        best_gain = gain_range[1] * confidence
        base_gain = possible_gain
        worst_loss = -loss_range[1] * (1.0 - confidence)

        predictions["consequences"] = {
            "best_case": {
                "gain": round(best_gain, 2),
                "probability": round(gain_probability * 0.8, 4),
                "timeframe": tf_min,
            },
            "base_case": {
                "gain": round(base_gain, 2),
                "probability": round(gain_probability, 4),
                "timeframe": tf_expected,
            },
            "worst_case": {
                "loss": round(abs(worst_loss), 2),
                "probability": round(loss_probability, 4),
                "timeframe": tf_max,
            },
        }

    return predictions


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

        # Calculate predictions for this pattern
        predictions = _calculate_pattern_predictions(
            "three_white_soldiers", "bullish", 0.8, data[max(0, i - 10) : i + 1]
        )

        matches.append(
            PatternMatch(
                pattern="three_white_soldiers",
                pattern_name="Three White Soldiers",
                index=i,
                candles=3,
                signal="bullish",
                confidence=0.8,
                description="Strong bullish reversal pattern. Three consecutive bullish candles with each closing higher than the previous.",
                possible_gain=predictions.get("possible_gain"),
                possible_loss=predictions.get("possible_loss"),
                gain_probability=predictions.get("gain_probability"),
                loss_probability=predictions.get("loss_probability"),
                timeframe_prediction=predictions.get("timeframe_prediction"),
                consequences=predictions.get("consequences"),
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
            c1.total_range == 0
            or c2.total_range == 0
            or c3.total_range == 0
            or c1.body_size / c1.total_range > doji_threshold
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


def _determine_trending_signal(
    current_plus_di: float | None,
    current_minus_di: float | None,
    price_above_sma: bool,
    price_momentum: float,
    current_adx: float,
    is_strong_trend: bool,
) -> tuple[str, float, str] | None:
    """Determine signal, confidence, and trend strength for trending regime."""
    # Determine signal based on DI and price position
    if current_plus_di is not None and current_minus_di is not None:
        if current_plus_di > current_minus_di and price_above_sma:
            signal = "bullish"
            confidence = min(0.95, 0.6 + (current_adx - 20) / 50.0)
            trend_strength = "strong" if is_strong_trend else "moderate"
            return signal, confidence, trend_strength
        if current_minus_di > current_plus_di and not price_above_sma:
            signal = "bearish"
            confidence = min(0.95, 0.6 + (current_adx - 20) / 50.0)
            trend_strength = "strong" if is_strong_trend else "moderate"
            return signal, confidence, trend_strength
        return None

    # Fallback to price momentum
    if price_momentum > 0.02:  # 2% above SMA
        return "bullish", 0.65, "moderate"
    if price_momentum < -0.02:  # 2% below SMA
        return "bearish", 0.65, "moderate"
    return None


def detect_trending_regime(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Trending Regime pattern.

    Identifies strong directional trends using ADX, moving averages, and price momentum.
    A trending regime indicates sustained directional movement (bullish or bearish).
    """
    matches: list[PatternMatch] = []

    if len(data) < 20:
        return matches

    # Import indicators module
    from stocks import indicators

    # Calculate required indicators
    adx_data = indicators.calculate_adx(data, period=14)
    adx_values = adx_data.get("adx", [])
    plus_di = adx_data.get("plus_di", [])
    minus_di = adx_data.get("minus_di", [])

    sma_20 = indicators.calculate_sma(data, period=20)

    # Check for trending regime in recent periods
    lookback = min(10, len(data) - 1)
    for i in range(len(data) - lookback, len(data)):
        if i < 20:  # Need at least 20 periods for ADX
            continue

        current_adx = adx_values[i] if i < len(adx_values) else None
        current_plus_di = plus_di[i] if i < len(plus_di) else None
        current_minus_di = minus_di[i] if i < len(minus_di) else None

        if current_adx is None:
            continue

        # Strong trend: ADX > 25 indicates strong trend
        # ADX > 20 indicates moderate trend
        is_strong_trend = current_adx > 25
        is_moderate_trend = current_adx > 20

        if not (is_strong_trend or is_moderate_trend):
            continue

        # Determine trend direction
        current_price = to_number(data[i].get("close_price"))
        sma_20_val = sma_20[i] if i < len(sma_20) and sma_20[i] is not None else None

        if current_price is None or sma_20_val is None:
            continue

        # Check price momentum
        price_above_sma = current_price > sma_20_val
        price_momentum = (
            (current_price - sma_20_val) / sma_20_val if sma_20_val > 0 else 0
        )

        # Determine signal using helper function
        signal_result = _determine_trending_signal(
            current_plus_di,
            current_minus_di,
            price_above_sma,
            price_momentum,
            current_adx,
            is_strong_trend,
        )
        if signal_result is None:
            continue
        signal, confidence, trend_strength = signal_result

        # Calculate predictions
        predictions = _calculate_pattern_predictions(
            "trending_regime", signal, confidence, data[max(0, i - 20) : i + 1]
        )

        matches.append(
            PatternMatch(
                pattern="trending_regime",
                pattern_name="Trending Regime",
                index=i,
                candles=20,
                signal=signal,
                confidence=confidence,
                description=f"{trend_strength.capitalize()} {signal} trending regime. ADX: {current_adx:.2f}, Price momentum: {price_momentum * 100:.2f}%",
                possible_gain=predictions.get("possible_gain"),
                possible_loss=predictions.get("possible_loss"),
                gain_probability=predictions.get("gain_probability"),
                loss_probability=predictions.get("loss_probability"),
                timeframe_prediction=predictions.get("timeframe_prediction"),
                consequences=predictions.get("consequences"),
            )
        )

    return matches


def detect_ranging_regime(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Ranging Regime pattern.

    Detects sideways consolidation using Bollinger Bands width, ATR, and price oscillation.
    A ranging regime indicates consolidation with support/resistance levels.
    """
    matches: list[PatternMatch] = []

    if len(data) < 20:
        return matches

    # Import indicators module
    from stocks import indicators

    # Calculate required indicators
    bb_data = indicators.calculate_bollinger_bands(data, period=20)
    bb_upper = bb_data.get("upper", [])
    bb_middle = bb_data.get("middle", [])
    bb_lower = bb_data.get("lower", [])

    atr_values = indicators.calculate_atr(data, period=14)

    # Check for ranging regime in recent periods
    lookback = min(10, len(data) - 1)
    for i in range(len(data) - lookback, len(data)):
        if i < 20:  # Need at least 20 periods
            continue

        current_price = to_number(data[i].get("close_price"))
        bb_upper_val = bb_upper[i] if i < len(bb_upper) else None
        bb_middle_val = bb_middle[i] if i < len(bb_middle) else None
        bb_lower_val = bb_lower[i] if i < len(bb_lower) else None
        atr_val = atr_values[i] if i < len(atr_values) else None

        if (
            current_price is None
            or bb_upper_val is None
            or bb_middle_val is None
            or bb_lower_val is None
            or atr_val is None
        ):
            continue

        # Calculate Bollinger Band width (normalized)
        bb_width = (
            (bb_upper_val - bb_lower_val) / bb_middle_val if bb_middle_val > 0 else 0
        )

        # Check price oscillation in recent periods
        recent_prices = [
            to_number(data[j].get("close_price"))
            for j in range(max(0, i - 10), i + 1)
            if to_number(data[j].get("close_price")) is not None
        ]

        if len(recent_prices) < 5:
            continue

        price_range = max(recent_prices) - min(recent_prices)
        price_oscillation = price_range / bb_middle_val if bb_middle_val > 0 else 0

        # Ranging regime characteristics:
        # 1. Narrow Bollinger Bands (low volatility)
        # 2. Price oscillating within bands
        # 3. Low ATR relative to price
        is_narrow_bands = bb_width < 0.05  # Less than 5% width
        is_low_oscillation = price_oscillation < 0.08  # Less than 8% oscillation
        is_price_in_bands = bb_lower_val <= current_price <= bb_upper_val

        # Check if price is near middle band (ranging)
        distance_from_middle = abs(current_price - bb_middle_val) / bb_middle_val
        is_near_middle = distance_from_middle < 0.02  # Within 2% of middle

        if (is_narrow_bands or is_low_oscillation) and is_price_in_bands:
            # Determine signal (neutral for ranging, but can be slightly bullish/bearish)
            if current_price > bb_middle_val:
                signal = "bullish"  # Slight bullish bias
                confidence = 0.55
            elif current_price < bb_middle_val:
                signal = "bearish"  # Slight bearish bias
                confidence = 0.55
            else:
                signal = "neutral"
                confidence = 0.6

            # Higher confidence if price is near middle
            if is_near_middle:
                confidence = 0.7

            matches.append(
                PatternMatch(
                    pattern="ranging_regime",
                    pattern_name="Ranging Regime",
                    index=i,
                    candles=20,
                    signal=signal,
                    confidence=confidence,
                    description=f"Sideways consolidation regime. BB width: {bb_width * 100:.2f}%, Price oscillation: {price_oscillation * 100:.2f}%, Price near middle: {is_near_middle}",
                )
            )

    return matches


def detect_volatile_regime(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Volatile Regime pattern.

    Identifies high volatility periods using ATR, Bollinger Band expansion, and price range.
    A volatile regime indicates high volatility with large price swings.
    """
    matches: list[PatternMatch] = []

    if len(data) < 20:
        return matches

    # Import indicators module
    from stocks import indicators

    # Calculate required indicators
    bb_data = indicators.calculate_bollinger_bands(data, period=20)
    bb_upper = bb_data.get("upper", [])
    bb_middle = bb_data.get("middle", [])
    bb_lower = bb_data.get("lower", [])

    atr_values = indicators.calculate_atr(data, period=14)

    # Calculate average ATR for comparison
    recent_atr = [
        atr_values[j]
        for j in range(max(0, len(data) - 20), len(data))
        if atr_values[j] is not None
    ]
    avg_atr = sum(recent_atr) / len(recent_atr) if recent_atr else None

    # Check for volatile regime in recent periods
    lookback = min(10, len(data) - 1)
    for i in range(len(data) - lookback, len(data)):
        if i < 20:  # Need at least 20 periods
            continue

        current_price = to_number(data[i].get("close_price"))
        high_price = to_number(data[i].get("high_price"))
        low_price = to_number(data[i].get("low_price"))
        bb_upper_val = bb_upper[i] if i < len(bb_upper) else None
        bb_middle_val = bb_middle[i] if i < len(bb_middle) else None
        bb_lower_val = bb_lower[i] if i < len(bb_lower) else None
        atr_val = atr_values[i] if i < len(atr_values) else None

        if (
            current_price is None
            or high_price is None
            or low_price is None
            or bb_upper_val is None
            or bb_middle_val is None
            or bb_lower_val is None
            or atr_val is None
            or avg_atr is None
        ):
            continue

        # Calculate Bollinger Band width (normalized)
        bb_width = (
            (bb_upper_val - bb_lower_val) / bb_middle_val if bb_middle_val > 0 else 0
        )

        # Calculate daily price range
        daily_range = high_price - low_price
        range_ratio = daily_range / current_price if current_price > 0 else 0

        # Volatile regime characteristics:
        # 1. Wide Bollinger Bands (high volatility)
        # 2. High ATR relative to average
        # 3. Large daily price range
        is_wide_bands = bb_width > 0.10  # More than 10% width
        is_high_atr = atr_val > avg_atr * 1.5  # 50% above average
        is_large_range = range_ratio > 0.03  # More than 3% daily range

        # Check if price is touching bands (high volatility)
        is_touching_upper = current_price >= bb_upper_val * 0.98
        is_touching_lower = current_price <= bb_lower_val * 1.02

        if (is_wide_bands or is_high_atr) and is_large_range:
            # Determine signal based on price position
            if is_touching_upper:
                signal = "bearish"  # Overbought in volatile market
                confidence = 0.65
            elif is_touching_lower:
                signal = "bullish"  # Oversold in volatile market
                confidence = 0.65
            else:
                signal = "neutral"  # High volatility, direction uncertain
                confidence = 0.6

            volatility_level = "extreme" if bb_width > 0.15 else "high"

            matches.append(
                PatternMatch(
                    pattern="volatile_regime",
                    pattern_name="Volatile Regime",
                    index=i,
                    candles=20,
                    signal=signal,
                    confidence=confidence,
                    description=f"{volatility_level.capitalize()} volatility regime. BB width: {bb_width * 100:.2f}%, ATR: {atr_val / current_price * 100:.2f}%, Daily range: {range_ratio * 100:.2f}%",
                )
            )

    return matches


def _calculate_transition_indicators(
    current_adx: float,
    prev_adx: float,
    current_bb_width: float,
    prev_bb_width: float,
    current_price: float,
    prev_prices: list[float],
) -> tuple[bool, bool, bool]:
    """Calculate transition indicators."""
    adx_change = abs(current_adx - prev_adx)
    is_adx_transition = adx_change > 5  # Significant change

    bb_width_change = abs(current_bb_width - prev_bb_width)
    is_bb_transition = bb_width_change > 0.02  # 2% change

    if prev_prices:
        prev_range_high = max(prev_prices)
        prev_range_low = min(prev_prices)
        is_breaking_out = (
            current_price > prev_range_high * 1.02
            or current_price < prev_range_low * 0.98
        )
    else:
        is_breaking_out = False

    return is_adx_transition, is_bb_transition, is_breaking_out


def _determine_transition_type(
    current_adx: float,
    prev_adx: float,
    current_bb_width: float,
    prev_bb_width: float,
    current_price: float,
    bb_middle_val: float,
) -> tuple[str, str]:
    """Determine transition type and signal."""
    if current_adx > prev_adx:
        transition_type = "trending"
        signal = "bullish" if current_price > bb_middle_val else "bearish"
    elif current_bb_width > prev_bb_width:
        transition_type = "volatile"
        signal = "neutral"
    else:
        transition_type = "ranging"
        signal = "neutral"

    return transition_type, signal


def detect_regime_transition(data: list[dict]) -> list[PatternMatch]:
    """
    Detect Regime Transition pattern.

    Detects transitions between regimes using regime change indicators.
    A transition regime indicates the market is changing from one state to another.
    """
    matches: list[PatternMatch] = []

    if len(data) < 30:
        return matches

    # Import indicators module
    from stocks import indicators

    # Calculate ADX to detect trend changes
    adx_data = indicators.calculate_adx(data, period=14)
    adx_values = adx_data.get("adx", [])

    # Calculate Bollinger Bands to detect volatility changes
    bb_data = indicators.calculate_bollinger_bands(data, period=20)
    bb_upper = bb_data.get("upper", [])
    bb_middle = bb_data.get("middle", [])
    bb_lower = bb_data.get("lower", [])

    # Check for regime transitions in recent periods
    lookback = min(10, len(data) - 1)
    for i in range(len(data) - lookback, len(data)):
        if i < 30:  # Need at least 30 periods to detect transitions
            continue

        current_adx = adx_values[i] if i < len(adx_values) else None
        prev_adx = adx_values[i - 5] if i >= 5 and i - 5 < len(adx_values) else None

        current_price = to_number(data[i].get("close_price"))
        bb_upper_val = bb_upper[i] if i < len(bb_upper) else None
        bb_middle_val = bb_middle[i] if i < len(bb_middle) else None
        bb_lower_val = bb_lower[i] if i < len(bb_lower) else None

        if (
            current_adx is None
            or prev_adx is None
            or current_price is None
            or bb_upper_val is None
            or bb_middle_val is None
            or bb_lower_val is None
        ):
            continue

        # Calculate Bollinger Band width
        current_bb_width = (
            (bb_upper_val - bb_lower_val) / bb_middle_val if bb_middle_val > 0 else 0
        )

        # Get previous BB width
        prev_bb_upper = bb_upper[i - 5] if i >= 5 and i - 5 < len(bb_upper) else None
        prev_bb_middle = bb_middle[i - 5] if i >= 5 and i - 5 < len(bb_middle) else None
        prev_bb_lower = bb_lower[i - 5] if i >= 5 and i - 5 < len(bb_lower) else None

        if prev_bb_upper is None or prev_bb_middle is None or prev_bb_lower is None:
            continue

        prev_bb_width = (
            (prev_bb_upper - prev_bb_lower) / prev_bb_middle
            if prev_bb_middle > 0
            else 0
        )

        # Get previous prices for breakout detection
        prev_prices = [
            to_number(data[j].get("close_price"))
            for j in range(max(0, i - 10), i - 5)
            if to_number(data[j].get("close_price")) is not None
        ]

        # Calculate transition indicators
        is_adx_transition, is_bb_transition, is_breaking_out = (
            _calculate_transition_indicators(
                current_adx,
                prev_adx,
                current_bb_width,
                prev_bb_width,
                current_price,
                prev_prices,
            )
        )

        if is_adx_transition or is_bb_transition or is_breaking_out:
            # Determine transition type and signal
            transition_type, signal = _determine_transition_type(
                current_adx,
                prev_adx,
                current_bb_width,
                prev_bb_width,
                current_price,
                bb_middle_val,
            )

            confidence = 0.65
            adx_change = abs(current_adx - prev_adx)
            bb_width_change = abs(current_bb_width - prev_bb_width)

            matches.append(
                PatternMatch(
                    pattern="regime_transition",
                    pattern_name="Regime Transition",
                    index=i,
                    candles=30,
                    signal=signal,
                    confidence=confidence,
                    description=f"Market transitioning to {transition_type} regime. ADX change: {adx_change:.2f}, BB width change: {bb_width_change * 100:.2f}%, Breaking out: {is_breaking_out}",
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
        # Regime Detection Patterns
        "trending_regime": detect_trending_regime,
        "ranging_regime": detect_ranging_regime,
        "volatile_regime": detect_volatile_regime,
        "regime_transition": detect_regime_transition,
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
            except Exception as e:
                logger.exception(f"Error detecting pattern {pattern_id}: {e}")
        else:
            logger.warning(
                f"Pattern detector not found for pattern_id: {pattern_id}. "
                f"Available patterns: {list(pattern_detectors.keys())}"
            )

    # Sort by index
    all_matches.sort(key=lambda x: x.index)

    return all_matches
