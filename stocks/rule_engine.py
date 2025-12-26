"""
Rule Engine for Trading Bot
Evaluates JSON-based trading rules using indicators, patterns, and price data.
"""

import logging
from decimal import Decimal
from typing import Any

from . import indicators, pattern_detector

logger = logging.getLogger(__name__)


class RuleEvaluator:
    """Evaluates trading rules based on market data."""

    def __init__(
        self,
        price_data: list[dict],
        indicators_data: dict[str, Any] | None = None,
        patterns_data: list[pattern_detector.PatternMatch] | None = None,
    ):
        """
        Initialize rule evaluator.

        Args:
            price_data: List of price data dictionaries (OHLCV)
            indicators_data: Dictionary of calculated indicators
            patterns_data: List of detected patterns
        """
        self.price_data = price_data
        self.indicators_data = indicators_data or {}
        self.patterns_data = patterns_data or []
        self.latest_index = len(price_data) - 1 if price_data else -1

    def evaluate_rule(self, rule: dict[str, Any]) -> bool:
        """
        Evaluate a single rule or rule group.

        Args:
            rule: Rule dictionary with 'operator' and 'conditions'

        Returns:
            True if rule is satisfied, False otherwise
        """
        if not rule:
            return False

        operator = rule.get("operator", "AND").upper()
        conditions = rule.get("conditions", [])

        if not conditions:
            return False

        results = []
        for condition in conditions:
            if isinstance(condition, dict) and "operator" in condition:
                # Nested rule group
                results.append(self.evaluate_rule(condition))
            else:
                # Single condition
                results.append(self.evaluate_condition(condition))

        if operator == "AND":
            return all(results)
        if operator == "OR":
            return any(results)
        if operator == "NOT":
            return not results[0] if results else False
        logger.warning(f"Unknown operator: {operator}, defaulting to AND")
        return all(results)

    def evaluate_condition(self, condition: dict[str, Any]) -> bool:
        """
        Evaluate a single condition.

        Args:
            condition: Condition dictionary with 'type', 'operator', etc.

        Returns:
            True if condition is satisfied
        """
        condition_type = condition.get("type")

        if condition_type == "indicator":
            return self._evaluate_indicator_condition(condition)
        if condition_type == "pattern":
            return self._evaluate_pattern_condition(condition)
        if condition_type == "price":
            return self._evaluate_price_condition(condition)
        if condition_type == "volume":
            return self._evaluate_volume_condition(condition)
        if condition_type == "time":
            return self._evaluate_time_condition(condition)
        logger.warning(f"Unknown condition type: {condition_type}")
        return False

    def _evaluate_indicator_condition(self, condition: dict[str, Any]) -> bool:
        """Evaluate indicator-based condition."""
        indicator_name = condition.get("indicator", "").lower()
        operator = condition.get("operator", ">")
        value = condition.get("value")
        period = condition.get("period", 14)

        # Get indicator value
        indicator_value = self._get_indicator_value(indicator_name, period)

        if indicator_value is None:
            return False

        # Compare
        return self._compare_values(indicator_value, operator, value)

    def _evaluate_pattern_condition(self, condition: dict[str, Any]) -> bool:
        """Evaluate pattern-based condition."""
        pattern_id = condition.get("pattern", "")
        min_confidence = condition.get("min_confidence", 0.5)

        # Check if pattern is detected in recent data
        for pattern in self.patterns_data:
            if (
                pattern.pattern == pattern_id
                and pattern.index == self.latest_index
                and pattern.confidence >= min_confidence
            ):
                return True

        return False

    def _evaluate_price_condition(self, condition: dict[str, Any]) -> bool:
        """Evaluate price-based condition."""
        if not self.price_data or self.latest_index < 0:
            return False

        latest_price_data = self.price_data[self.latest_index]
        current_price = self._to_number(latest_price_data.get("close_price"))

        if current_price is None:
            return False

        operator = condition.get("operator", ">")
        value = condition.get("value")

        # Handle special values like "take_profit_percent", "stop_loss_percent"
        if isinstance(value, str):
            if value == "take_profit_percent":
                # This would need to be passed from bot config
                return False
            if value == "stop_loss_percent":
                return False
            # Try to parse as number
            value = self._to_number(value)

        if value is None:
            return False

        return self._compare_values(current_price, operator, value)

    def _evaluate_volume_condition(self, condition: dict[str, Any]) -> bool:
        """Evaluate volume-based condition."""
        if not self.price_data or self.latest_index < 0:
            return False

        latest_price_data = self.price_data[self.latest_index]
        current_volume = self._to_number(latest_price_data.get("volume"))

        if current_volume is None:
            return False

        operator = condition.get("operator", ">")
        value = condition.get("value")

        if isinstance(value, str):
            # Could be "average_volume" or similar
            if value == "average_volume":
                # Calculate average volume
                volumes = [
                    self._to_number(d.get("volume"))
                    for d in self.price_data[-20:]  # Last 20 periods
                ]
                valid_volumes = [v for v in volumes if v is not None]
                if valid_volumes:
                    value = sum(valid_volumes) / len(valid_volumes)
                else:
                    return False
            else:
                value = self._to_number(value)

        if value is None:
            return False

        return self._compare_values(current_volume, operator, value)

    def _evaluate_time_condition(self, condition: dict[str, Any]) -> bool:
        """Evaluate time-based condition."""
        # This would check market hours, day of week, etc.
        # For now, return True (can be implemented later)
        logger.debug("Time condition evaluation not fully implemented")
        return True

    def _get_indicator_value(  # noqa: PLR0912
        self, indicator_name: str, period: int
    ) -> float | None:
        """Get the latest value for an indicator."""
        # Check if already calculated
        key = f"{indicator_name}_{period}"
        if key in self.indicators_data:
            values = self.indicators_data[key]
            if isinstance(values, list) and values:
                return values[-1] if isinstance(values[-1], int | float) else None

        # Calculate on the fly if not cached
        try:
            if indicator_name == "sma":
                values = indicators.calculate_sma(self.price_data, period)
            elif indicator_name == "ema":
                values = indicators.calculate_ema(self.price_data, period)
            elif indicator_name == "rsi":
                values = indicators.calculate_rsi(self.price_data, period)
            elif indicator_name == "macd":
                macd_data = indicators.calculate_macd(self.price_data, 12, 26, 9)
                values = macd_data.get("macd", [])
            elif indicator_name == "atr":
                values = indicators.calculate_atr(self.price_data, period)
            elif indicator_name == "bb_upper":
                bb_data = indicators.calculate_bollinger_bands(self.price_data, period)
                values = bb_data.get("upper", [])
            elif indicator_name == "bb_lower":
                bb_data = indicators.calculate_bollinger_bands(self.price_data, period)
                values = bb_data.get("lower", [])
            elif indicator_name == "bb_middle":
                bb_data = indicators.calculate_bollinger_bands(self.price_data, period)
                values = bb_data.get("middle", [])
            else:
                logger.warning(f"Unknown indicator: {indicator_name}")
                return None

            if values and self.latest_index >= 0 and self.latest_index < len(values):
                return (
                    values[self.latest_index]
                    if isinstance(values[self.latest_index], int | float)
                    else None
                )
        except Exception:
            logger.exception(f"Error calculating indicator {indicator_name}")

        return None

    def _compare_values(  # noqa: PLR0911
        self, left: float, operator: str, right: float
    ) -> bool:
        """Compare two values using the given operator."""
        try:
            if operator == ">":
                return left > right
            if operator == "<":
                return left < right
            if operator == ">=":
                return left >= right
            if operator == "<=":
                return left <= right
            if operator in ("==", "="):
                return abs(left - right) < 0.0001  # Float comparison
            if operator == "!=":
                return abs(left - right) >= 0.0001
            logger.warning(f"Unknown operator: {operator}")
        except (TypeError, ValueError):
            logger.exception("Error comparing values")
            return False
        else:
            return False  # Unknown operator case

    def _to_number(self, value: Any) -> float | None:
        """Convert value to number."""
        if value is None:
            return None
        if isinstance(value, int | float):
            return float(value)
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except (ValueError, TypeError):
                return None
        return None
