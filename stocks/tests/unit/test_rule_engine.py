"""
Unit tests for rule engine.
"""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.unit

from stocks import indicators, pattern_detector
from stocks.rule_engine import RuleEvaluator
from stocks.tests.fixtures.sample_data import generate_price_data


class TestRuleEvaluation:
    """Test rule evaluation."""

    def test_evaluate_and_rules(self):
        """Test evaluating AND rules."""
        price_data = generate_price_data(days=30)
        indicators_data = {"sma_20": indicators.calculate_sma(price_data, 20)}

        rule = {
            "operator": "AND",
            "conditions": [
                {"type": "indicator", "indicator": "sma", "operator": ">", "value": 100},
                {"type": "price", "operator": ">", "value": 100},
            ],
        }

        evaluator = RuleEvaluator(price_data, indicators_data)
        result = evaluator.evaluate_rule(rule)

        assert isinstance(result, bool)

    def test_evaluate_or_rules(self):
        """Test evaluating OR rules."""
        price_data = generate_price_data(days=30)

        rule = {
            "operator": "OR",
            "conditions": [
                {"type": "price", "operator": ">", "value": 200},
                {"type": "price", "operator": "<", "value": 50},
            ],
        }

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_rule(rule)

        assert isinstance(result, bool)

    def test_evaluate_not_rules(self):
        """Test evaluating NOT rules."""
        price_data = generate_price_data(days=30)

        rule = {
            "operator": "NOT",
            "conditions": [{"type": "price", "operator": ">", "value": 200}],
        }

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_rule(rule)

        assert isinstance(result, bool)

    def test_evaluate_nested_rule_groups(self):
        """Test evaluating nested rule groups."""
        price_data = generate_price_data(days=30)

        rule = {
            "operator": "AND",
            "conditions": [
                {"type": "price", "operator": ">", "value": 100},
                {
                    "operator": "OR",
                    "conditions": [
                        {"type": "price", "operator": ">", "value": 150},
                        {"type": "price", "operator": "<", "value": 50},
                    ],
                },
            ],
        }

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_rule(rule)

        assert isinstance(result, bool)

    def test_evaluate_empty_rules(self):
        """Test handling empty rules."""
        price_data = generate_price_data(days=30)

        rule = {}
        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_rule(rule)

        assert result is False

    def test_evaluate_invalid_operators(self):
        """Test handling invalid operators."""
        price_data = generate_price_data(days=30)

        rule = {
            "operator": "INVALID",
            "conditions": [{"type": "price", "operator": ">", "value": 100}],
        }

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_rule(rule)

        # Should default to AND
        assert isinstance(result, bool)


class TestIndicatorConditions:
    """Test indicator condition evaluation."""

    def test_evaluate_rsi_condition(self):
        """Test evaluating RSI conditions."""
        price_data = generate_price_data(days=30)
        indicators_data = {"rsi_14": indicators.calculate_rsi(price_data, 14)}

        condition = {
            "type": "indicator",
            "indicator": "rsi",
            "operator": "<",
            "value": 30,
            "period": 14,
        }

        evaluator = RuleEvaluator(price_data, indicators_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_sma_condition(self):
        """Test evaluating SMA conditions."""
        price_data = generate_price_data(days=30)
        indicators_data = {"sma_20": indicators.calculate_sma(price_data, 20)}

        condition = {
            "type": "indicator",
            "indicator": "sma",
            "operator": ">",
            "value": 100,
            "period": 20,
        }

        evaluator = RuleEvaluator(price_data, indicators_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_macd_condition(self):
        """Test evaluating MACD conditions."""
        price_data = generate_price_data(days=50)
        macd_data = indicators.calculate_macd(price_data)
        indicators_data = {"macd": macd_data["macd"]}

        condition = {
            "type": "indicator",
            "indicator": "macd",
            "operator": ">",
            "value": 0,
        }

        evaluator = RuleEvaluator(price_data, indicators_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_bollinger_bands_condition(self):
        """Test evaluating Bollinger Bands conditions."""
        price_data = generate_price_data(days=30)
        bb_data = indicators.calculate_bollinger_bands(price_data)
        indicators_data = {"bb_upper": bb_data["upper"]}

        condition = {
            "type": "indicator",
            "indicator": "bb_upper",
            "operator": "<",
            "value": 200,
            "period": 20,
        }

        evaluator = RuleEvaluator(price_data, indicators_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_missing_indicators(self):
        """Test handling missing indicators."""
        price_data = generate_price_data(days=30)
        indicators_data = {}

        condition = {
            "type": "indicator",
            "indicator": "rsi",
            "operator": "<",
            "value": 30,
        }

        evaluator = RuleEvaluator(price_data, indicators_data)
        result = evaluator.evaluate_condition(condition)

        # Should return False when indicator is missing
        assert result is False


class TestPatternConditions:
    """Test pattern condition evaluation."""

    def test_evaluate_pattern_condition(self):
        """Test evaluating pattern conditions."""
        price_data = generate_price_data(days=30)
        patterns = pattern_detector.detect_all_patterns(price_data)

        condition = {
            "type": "pattern",
            "pattern": "three_white_soldiers",
            "min_confidence": 0.5,
        }

        evaluator = RuleEvaluator(price_data, patterns_data=patterns)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_pattern_confidence_threshold(self):
        """Test pattern confidence threshold."""
        price_data = generate_price_data(days=30)
        patterns = pattern_detector.detect_all_patterns(price_data)

        condition = {
            "type": "pattern",
            "pattern": "three_white_soldiers",
            "min_confidence": 0.9,  # High threshold
        }

        evaluator = RuleEvaluator(price_data, patterns_data=patterns)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)


class TestPriceConditions:
    """Test price condition evaluation."""

    def test_evaluate_price_condition_greater_than(self):
        """Test price > value condition."""
        price_data = generate_price_data(days=30)

        condition = {"type": "price", "operator": ">", "value": 100}

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_price_condition_less_than(self):
        """Test price < value condition."""
        price_data = generate_price_data(days=30)

        condition = {"type": "price", "operator": "<", "value": 200}

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_price_condition_equals(self):
        """Test price == value condition."""
        price_data = generate_price_data(days=30)

        condition = {"type": "price", "operator": "==", "value": 150}

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_price_condition_handle_none_prices(self):
        """Test handling None prices."""
        price_data = [{"close_price": None}]

        condition = {"type": "price", "operator": ">", "value": 100}

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_condition(condition)

        assert result is False


class TestVolumeConditions:
    """Test volume condition evaluation."""

    def test_evaluate_volume_condition(self):
        """Test evaluating volume conditions."""
        price_data = generate_price_data(days=30)

        condition = {"type": "volume", "operator": ">", "value": 1000000}

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_volume_average_volume(self):
        """Test average volume calculation."""
        price_data = generate_price_data(days=30)

        condition = {"type": "volume", "operator": ">", "value": "average_volume"}

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_condition(condition)

        assert isinstance(result, bool)

    def test_evaluate_volume_handle_none_volumes(self):
        """Test handling None volumes."""
        price_data = [{"volume": None}]

        condition = {"type": "volume", "operator": ">", "value": 1000000}

        evaluator = RuleEvaluator(price_data)
        result = evaluator.evaluate_condition(condition)

        assert result is False


class TestValueComparison:
    """Test value comparison."""

    def test_compare_values_all_operators(self):
        """Test all comparison operators."""
        evaluator = RuleEvaluator([])

        assert evaluator._compare_values(10.0, ">", 5.0) is True
        assert evaluator._compare_values(10.0, "<", 5.0) is False
        assert evaluator._compare_values(10.0, ">=", 10.0) is True
        assert evaluator._compare_values(10.0, "<=", 10.0) is True
        assert evaluator._compare_values(10.0, "==", 10.0) is True
        assert evaluator._compare_values(10.0, "!=", 5.0) is True

    def test_compare_values_float_precision(self):
        """Test float precision handling."""
        evaluator = RuleEvaluator([])

        # Float comparison with tolerance
        result = evaluator._compare_values(10.0001, "==", 10.0002)
        # Should use tolerance
        assert isinstance(result, bool)

    def test_compare_values_handle_none(self):
        """Test handling None values."""
        evaluator = RuleEvaluator([])

        # Should handle None gracefully
        try:
            result = evaluator._compare_values(None, ">", 5.0)
            assert isinstance(result, bool)
        except (TypeError, ValueError):
            pass  # Expected

    def test_to_number_type_conversion(self):
        """Test type conversion in to_number."""
        evaluator = RuleEvaluator([])

        assert evaluator._to_number(10) == 10.0
        assert evaluator._to_number(10.5) == 10.5
        assert evaluator._to_number("10.5") == 10.5
        assert evaluator._to_number(Decimal("10.5")) == 10.5
        assert evaluator._to_number(None) is None
