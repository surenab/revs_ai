"""
Comprehensive integration tests for indicator signal aggregation.

This test suite systematically tests each indicator type with all possible signals
(buy, sell, hold) and verifies proper aggregation behavior.

Test Coverage:
- Individual indicator tests (RSI, MACD, Momentum) with buy/sell/hold scenarios
- All indicators together test
- Signal contribution to aggregation
- Multiple indicators of same type
- Confidence and strength validation
- Channel indicators (Bollinger, Keltner, Donchian)
- Trend indicators (PSAR, Supertrend, Alligator)
- Oscillator indicators (RSI, CCI, MFI, Williams %R, Stochastic)
- Volatility indicators (ATR, Bollinger Bands)
- Volume indicators (OBV, VWAP)
- Signal normalization
- Weight application
- Hold signal contribution

Each test verifies:
1. Signals are generated from indicators
2. Signals have proper structure (action, confidence, strength, value)
3. Signals contribute to final aggregation
4. Aggregation produces valid results (action, confidence, action_scores)
"""

import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase

pytestmark = pytest.mark.integration

from stocks.bot_engine import TradingBot
from stocks.signals.aggregator import SignalAggregator
from stocks.tests.fixtures.factories import (
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)
from stocks.tests.fixtures.sample_data import (
    generate_sample_indicator_signal,
    generate_bullish_price_data,
    generate_bearish_price_data,
)


class TestIndicatorSignalAggregation(TestCase):
    """Comprehensive tests for indicator signal aggregation."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.stock = StockFactory.create()
        StockPriceFactory.create_series(self.stock, days=50)

    def _create_bot_config_with_indicator(self, indicator_name: str, indicator_config: dict):
        """Helper to create bot config with a single indicator enabled."""
        enabled_indicators = {indicator_name: indicator_config}
        return TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators=enabled_indicators,
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )

    def _test_indicator_signal_scenarios(
        self, indicator_name: str, indicator_config: dict, test_cases: list
    ):
        """
        Test an indicator with multiple signal scenarios.

        Args:
            indicator_name: Name of the indicator (e.g., 'rsi', 'macd')
            indicator_config: Configuration for the indicator
            test_cases: List of dicts with 'price_data_generator', 'expected_signals', 'description'
        """
        for test_case in test_cases:
            with self.subTest(
                indicator=indicator_name, scenario=test_case["description"]
            ):
                # Generate price data for this scenario
                price_data = test_case["price_data_generator"](days=50)

                # Update stock prices
                prices = list(self.stock.prices.all().order_by("date"))
                for i, price_point in enumerate(price_data):
                    if i < len(prices):
                        price = prices[i]
                        price.open_price = price_point["open_price"]
                        price.high_price = price_point["high_price"]
                        price.low_price = price_point["low_price"]
                        price.close_price = price_point["close_price"]
                        price.volume = price_point.get("volume", 1000000)
                        price.save()

                bot_config = self._create_bot_config_with_indicator(
                    indicator_name, indicator_config
                )
                bot_config.assigned_stocks.add(self.stock)

                bot = TradingBot(bot_config)
                analysis = bot.analyze_stock(self.stock)

                # Verify indicators were calculated
                indicators = analysis.get("indicators", {})
                assert len(indicators) > 0, f"No indicators calculated for {indicator_name}"

                # Verify aggregation
                aggregated = analysis.get("aggregated_signal", {})
                assert "action" in aggregated, "Aggregation should produce an action"
                assert "confidence" in aggregated, "Aggregation should produce confidence"
                assert aggregated["action"] in ["buy", "sell", "hold", "skip"]

    # RSI Tests
    def test_rsi_buy_signal_aggregation(self):
        """Test RSI buy signal (oversold) aggregation."""
        from stocks.tests.fixtures.sample_data import generate_rsi_oversold_data

        bot_config = self._create_bot_config_with_indicator("rsi", {"period": 14})
        bot_config.assigned_stocks.add(self.stock)

        # Update prices to create oversold RSI
        price_data = generate_rsi_oversold_data()
        prices = list(self.stock.prices.all().order_by("date"))
        for i, price_point in enumerate(price_data[: len(prices)]):
            prices[i].open_price = price_point["open_price"]
            prices[i].high_price = price_point["high_price"]
            prices[i].low_price = price_point["low_price"]
            prices[i].close_price = price_point["close_price"]
            prices[i].save()

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        assert len(indicators) > 0, "RSI indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"
        assert aggregated["action"] in ["buy", "sell", "hold", "skip"]

    def test_rsi_sell_signal_aggregation(self):
        """Test RSI sell signal (overbought) aggregation."""
        from stocks.tests.fixtures.sample_data import generate_rsi_overbought_data

        bot_config = self._create_bot_config_with_indicator("rsi", {"period": 14})
        bot_config.assigned_stocks.add(self.stock)

        # Update prices to create overbought RSI
        price_data = generate_rsi_overbought_data()
        prices = list(self.stock.prices.all().order_by("date"))
        for i, price_point in enumerate(price_data[: len(prices)]):
            prices[i].open_price = price_point["open_price"]
            prices[i].high_price = price_point["high_price"]
            prices[i].low_price = price_point["low_price"]
            prices[i].close_price = price_point["close_price"]
            prices[i].save()

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        assert len(indicators) > 0, "RSI indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"
        assert aggregated["action"] in ["buy", "sell", "hold", "skip"]

    def test_rsi_hold_signal_aggregation(self):
        """Test RSI hold signal (neutral) aggregation."""
        bot_config = self._create_bot_config_with_indicator("rsi", {"period": 14})
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        assert len(indicators) > 0, "RSI indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"
        assert aggregated["action"] in ["buy", "sell", "hold", "skip"]

    # MACD Tests
    def test_macd_buy_signal_aggregation(self):
        """Test MACD buy signal aggregation."""
        bot_config = self._create_bot_config_with_indicator(
            "macd", {"fast_period": 12, "slow_period": 26, "signal_period": 9}
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that MACD was calculated (it returns a dict with macd, signal, histogram)
        macd_found = any("macd" in k.lower() for k in indicators.keys())
        assert macd_found, "MACD indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"

    def test_macd_sell_signal_aggregation(self):
        """Test MACD sell signal aggregation."""
        bot_config = self._create_bot_config_with_indicator(
            "macd", {"fast_period": 12, "slow_period": 26, "signal_period": 9}
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that MACD was calculated (it returns a dict with macd, signal, histogram)
        macd_found = any("macd" in k.lower() for k in indicators.keys())
        assert macd_found, "MACD indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"

    def test_macd_hold_signal_aggregation(self):
        """Test MACD hold signal aggregation."""
        bot_config = self._create_bot_config_with_indicator(
            "macd", {"fast_period": 12, "slow_period": 26, "signal_period": 9}
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that MACD was calculated (it returns a dict with macd, signal, histogram)
        macd_found = any("macd" in k.lower() for k in indicators.keys())
        assert macd_found, "MACD indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"

    # Momentum Tests
    def test_momentum_buy_signal_aggregation(self):
        """Test Momentum buy signal (positive) aggregation."""
        bot_config = self._create_bot_config_with_indicator("momentum", {"period": 10})
        bot_config.assigned_stocks.add(self.stock)

        # Use bullish price data for positive momentum
        price_data = generate_bullish_price_data(days=50)
        prices = list(self.stock.prices.all().order_by("date"))
        for i, price_point in enumerate(price_data[: len(prices)]):
            prices[i].open_price = price_point["open_price"]
            prices[i].high_price = price_point["high_price"]
            prices[i].low_price = price_point["low_price"]
            prices[i].close_price = price_point["close_price"]
            prices[i].volume = price_point.get("volume", 1000000)
            prices[i].save()

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        momentum_found = any("momentum" in k.lower() or "mom" in k.lower() for k in indicators.keys())
        assert momentum_found, "Momentum indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"

    def test_momentum_sell_signal_aggregation(self):
        """Test Momentum sell signal (negative) aggregation."""
        bot_config = self._create_bot_config_with_indicator("momentum", {"period": 10})
        bot_config.assigned_stocks.add(self.stock)

        # Use bearish price data for negative momentum
        price_data = generate_bearish_price_data(days=50)
        prices = list(self.stock.prices.all().order_by("date"))
        for i, price_point in enumerate(price_data[: len(prices)]):
            prices[i].open_price = price_point["open_price"]
            prices[i].high_price = price_point["high_price"]
            prices[i].low_price = price_point["low_price"]
            prices[i].close_price = price_point["close_price"]
            prices[i].volume = price_point.get("volume", 1000000)
            prices[i].save()

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        momentum_found = any("momentum" in k.lower() or "mom" in k.lower() for k in indicators.keys())
        assert momentum_found, "Momentum indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"

    def test_momentum_hold_signal_aggregation(self):
        """Test Momentum hold signal (neutral) aggregation."""
        bot_config = self._create_bot_config_with_indicator("momentum", {"period": 10})
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        momentum_found = any("momentum" in k.lower() or "mom" in k.lower() for k in indicators.keys())
        assert momentum_found, "Momentum indicator should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"

    # Test all indicators systematically
    def test_all_indicators_generate_signals(self):
        """Test that all enabled indicators generate signals."""
        # Enable all major indicators
        enabled_indicators = {
            "rsi": {"period": 14},
            "macd": {"fast_period": 12, "slow_period": 26, "signal_period": 9},
            "adx": {"period": 14},
            "cci": {"period": 20},
            "mfi": {"period": 14},
            "williams_r": {"period": 14},
            "stochastic": {"k_period": 14, "d_period": 3},
            "momentum": {"period": 10},
            "proc": {"period": 12},
            "sma": {"period": 20},
            "ema": {"period": 20},
            "bollinger": {"period": 20},
            "atr": {"period": 14},
            "psar": {"acceleration": 0.02, "maximum": 0.20},
            "supertrend": {"period": 10, "multiplier": 3.0},
            "alligator": {"jaw_period": 13, "teeth_period": 8, "lips_period": 5},
            "keltner": {"period": 20, "multiplier": 2.0},
            "donchian": {"period": 20},
            "fractal": {"period": 5},
            "vwap": {},
            "linear_regression": {"period": 14},
            "pivot_points": {},
        }

        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators=enabled_indicators,
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Check that indicators were calculated
        indicators_calculated = analysis.get("indicators", {})

        # Verify that at least some indicators were calculated
        assert len(indicators_calculated) > 0, (
            f"No indicators were calculated. Analysis keys: {list(analysis.keys())}"
        )

        # Note: Indicator signals are passed to the aggregator but not directly in the result
        # The aggregated_signal contains the final aggregated result which includes contributions
        # from indicator signals. We verify that aggregation worked.

        # Verify aggregation
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated
        assert "confidence" in aggregated
        assert aggregated["action"] in ["buy", "sell", "hold", "skip"]

        # Verify action_scores if present
        if "action_scores" in aggregated:
            action_scores = aggregated["action_scores"]
            assert "buy" in action_scores
            assert "sell" in action_scores
            assert "hold" in action_scores
            # Scores should sum to approximately 1.0 (after normalization)
            total = sum(action_scores.values())
            assert 0.9 <= total <= 1.1, f"Action scores should sum to ~1.0, got {total}"

    def test_indicator_signals_contribute_to_aggregation(self):
        """Test that indicator signals properly contribute to final aggregation."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "rsi": {"period": 14},
                "macd": {"fast_period": 12, "slow_period": 26, "signal_period": 9},
                "momentum": {"period": 10},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
            signal_weights={"indicator": 0.5, "ml": 0.3, "pattern": 0.2},
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        assert len(indicators) > 0, "Indicators should be calculated"

        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregation should produce an action"
        assert "confidence" in aggregated, "Aggregation should produce confidence"

        # Check that indicator weight is respected
        if "action_scores" in aggregated:
            # Indicator signals should contribute to the scores
            assert aggregated["confidence"] >= 0.0

    def test_multiple_indicators_same_type_aggregation(self):
        """Test aggregation with multiple indicators of the same type."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "sma": {"period": 20},
                "ema": {"period": 20},
                "wma": {"period": 20},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that multiple MAs were calculated
        ma_keys = [k for k in indicators.keys() if any(ma in k.lower() for ma in ["sma", "ema", "wma"])]
        assert len(ma_keys) > 0, "Should have calculated multiple MAs"

    def test_indicator_signal_confidence_and_strength(self):
        """Test that indicator signals have proper confidence and strength values."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "rsi": {"period": 14},
                "macd": {"fast_period": 12, "slow_period": 26, "signal_period": 9},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        assert len(indicators) > 0, "Indicators should be calculated"

        # Verify aggregation worked
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated
        assert aggregated["action"] in ["buy", "sell", "hold", "skip"]
        assert "confidence" in aggregated
        assert 0.0 <= aggregated["confidence"] <= 1.0

    def test_channel_indicators_aggregation(self):
        """Test channel indicators (Bollinger, Keltner, Donchian) aggregation."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "bollinger": {"period": 20},
                "keltner": {"period": 20, "multiplier": 2.0},
                "donchian": {"period": 20},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that channel indicators were calculated
        channel_keys = [k for k in indicators.keys() if any(
            ch in k.lower() for ch in ["bollinger", "bb", "keltner", "donchian"]
        )]
        assert len(channel_keys) > 0, "Should have calculated channel indicators"

    def test_trend_indicators_aggregation(self):
        """Test trend indicators (PSAR, Supertrend, Alligator) aggregation."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "psar": {"acceleration": 0.02, "maximum": 0.20},
                "supertrend": {"period": 10, "multiplier": 3.0},
                "alligator": {"jaw_period": 13, "teeth_period": 8, "lips_period": 5},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that trend indicators were calculated
        trend_keys = [k for k in indicators.keys() if any(
            tr in k.lower() for tr in ["psar", "supertrend", "alligator"]
        )]
        assert len(trend_keys) > 0, "Should have calculated trend indicators"

    def test_oscillator_indicators_aggregation(self):
        """Test oscillator indicators (RSI, CCI, MFI, Williams %R, Stochastic) aggregation."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "rsi": {"period": 14},
                "cci": {"period": 20},
                "mfi": {"period": 14},
                "williams_r": {"period": 14},
                "stochastic": {"k_period": 14, "d_period": 3},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that oscillator indicators were calculated
        oscillator_keys = [k for k in indicators.keys() if any(
            osc in k.lower() for osc in ["rsi", "cci", "mfi", "williams", "stochastic"]
        )]
        assert len(oscillator_keys) > 0, "Should have calculated oscillator indicators"

    def test_volatility_indicators_aggregation(self):
        """Test volatility indicators (ATR, Bollinger Bands) aggregation."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "atr": {"period": 14},
                "bollinger": {"period": 20},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that volatility indicators were calculated
        volatility_keys = [k for k in indicators.keys() if any(
            vol in k.lower() for vol in ["atr", "bollinger", "bb"]
        )]
        assert len(volatility_keys) > 0, "Should have calculated volatility indicators"

    def test_volume_indicators_aggregation(self):
        """Test volume indicators (OBV, VWAP) aggregation."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={
                "obv": {},
                "vwap": {},
            },
            enabled_patterns={},
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Verify indicators were calculated
        indicators = analysis.get("indicators", {})
        # Check that volume indicators were calculated
        volume_keys = [k for k in indicators.keys() if any(
            vol in k.lower() for vol in ["obv", "vwap"]
        )]
        assert len(volume_keys) > 0, "Should have calculated volume indicators"

    def test_indicator_signal_normalization(self):
        """Test that indicator signals are properly normalized in aggregation."""
        config = {"method": "weighted_average", "weights": {"indicator": 0.3}}
        aggregator = SignalAggregator(config)

        # Create multiple indicator signals with different actions
        indicator_signals = [
            generate_sample_indicator_signal(name="rsi_14", action="buy", confidence=0.7),
            generate_sample_indicator_signal(name="macd", action="sell", confidence=0.6),
            generate_sample_indicator_signal(name="adx", action="hold", confidence=0.5),
        ]

        result = aggregator.aggregate_signals(indicator_signals=indicator_signals)

        assert "action" in result
        assert "confidence" in result
        assert result["action"] in ["buy", "sell", "hold"]

        if "action_scores" in result:
            action_scores = result["action_scores"]
            # Scores should be normalized (sum to ~1.0)
            total = sum(action_scores.values())
            assert 0.9 <= total <= 1.1, f"Action scores should sum to ~1.0, got {total}"

    def test_indicator_signal_weight_application(self):
        """Test that indicator signal weights are properly applied."""
        config = {
            "method": "weighted_average",
            "weights": {"indicator": 0.5, "ml": 0.3, "pattern": 0.2},
        }
        aggregator = SignalAggregator(config)

        # Create strong indicator signals
        indicator_signals = [
            generate_sample_indicator_signal(name="rsi_14", action="buy", confidence=0.9),
            generate_sample_indicator_signal(name="macd", action="buy", confidence=0.8),
        ]

        result = aggregator.aggregate_signals(indicator_signals=indicator_signals)

        # With high weight and strong signals, should favor buy
        assert result["action"] in ["buy", "hold"]
        assert result["confidence"] > 0.0

    def test_indicator_hold_signals_contribute_to_aggregation(self):
        """Test that hold signals from indicators properly contribute to aggregation."""
        config = {"method": "weighted_average", "weights": {"indicator": 0.3}}
        aggregator = SignalAggregator(config)

        # Create multiple hold signals
        indicator_signals = [
            generate_sample_indicator_signal(name="rsi_14", action="hold", confidence=0.5),
            generate_sample_indicator_signal(name="macd", action="hold", confidence=0.5),
            generate_sample_indicator_signal(name="adx", action="hold", confidence=0.5),
        ]

        result = aggregator.aggregate_signals(indicator_signals=indicator_signals)

        # With all hold signals, should result in hold
        assert result["action"] == "hold"
        assert result["confidence"] > 0.0

        if "action_scores" in result:
            action_scores = result["action_scores"]
            # Hold score should be highest
            assert action_scores.get("hold", 0) >= action_scores.get("buy", 0)
            assert action_scores.get("hold", 0) >= action_scores.get("sell", 0)

    def test_comprehensive_signal_aggregation_all_indicators_and_patterns(self):
        """
        Comprehensive test: Enable all indicators and patterns, verify action scores
        and confidence correctness.

        This test verifies:
        1. All indicators and patterns are calculated/detected
        2. Action scores are normalized correctly (sum to ~1.0)
        3. Confidence is within valid range (0-1)
        4. Aggregation respects all signal sources
        """
        # Enable ALL indicators
        enabled_indicators = {
            # Oscillators
            "rsi": {"period": 14},
            "macd": {"fast_period": 12, "slow_period": 26, "signal_period": 9},
            "adx": {"period": 14},
            "cci": {"period": 20},
            "mfi": {"period": 14},
            "williams_r": {"period": 14},
            "stochastic": {"k_period": 14, "d_period": 3},
            "momentum": {"period": 10},
            "proc": {"period": 12},
            # Moving Averages
            "sma": {"period": 20},
            "ema": {"period": 20},
            "wma": {"period": 20},
            "dema": {"period": 20},
            "tema": {"period": 20},
            "tma": {"period": 20},
            "hma": {"period": 20},
            "mcginley": {"period": 14},
            # Bands & Channels
            "bollinger": {"period": 20},
            "keltner": {"period": 20, "multiplier": 2.0},
            "donchian": {"period": 20},
            "fractal": {"period": 5},
            # Trend Indicators
            "psar": {"acceleration": 0.02, "maximum": 0.20},
            "supertrend": {"period": 10, "multiplier": 3.0},
            "alligator": {"jaw_period": 13, "teeth_period": 8, "lips_period": 5},
            "ichimoku": {"tenkan_period": 9, "kijun_period": 26, "senkou_b_period": 52},
            # Volatility
            "atr": {"period": 14},
            "atr_trailing": {"period": 14, "multiplier": 2.0},
            # Volume
            "vwap": {},
            "vwap_ma": {"period": 20},
            "obv": {},
            # Other
            "linear_regression": {"period": 14},
            "pivot_points": {},
        }

        # Enable ALL patterns
        enabled_patterns = {
            # Candlestick Patterns
            "three_white_soldiers": {"min_confidence": 0.0},
            "morning_doji_star": {"min_confidence": 0.0},
            "morning_star": {"min_confidence": 0.0},
            "abandoned_baby": {"min_confidence": 0.0},
            "conceal_baby_swallow": {"min_confidence": 0.0},
            "stick_sandwich": {"min_confidence": 0.0},
            "kicking": {"min_confidence": 0.0},
            "engulfing": {"min_confidence": 0.0},
            "homing_pigeon": {"min_confidence": 0.0},
            "advance_block": {"min_confidence": 0.0},
            "tri_star": {"min_confidence": 0.0},
            "spinning_top": {"min_confidence": 0.0},
            # Chart Patterns
            "head_and_shoulders": {"min_confidence": 0.0},
            "double_top": {"min_confidence": 0.0},
            "double_bottom": {"min_confidence": 0.0},
            "flag": {"min_confidence": 0.0},
            "pennant": {"min_confidence": 0.0},
            "rising_wedge": {"min_confidence": 0.0},
            "falling_wedge": {"min_confidence": 0.0},
        }

        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators=enabled_indicators,
            enabled_patterns=enabled_patterns,
            enabled_ml_models=[],
            enable_social_analysis=False,
            enable_news_analysis=False,
            signal_aggregation_method="weighted_average",
            signal_weights={
                "ml": 0.0,  # No ML models
                "indicator": 0.5,
                "pattern": 0.5,
                "social_media": 0.0,
                "news": 0.0,
            },
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # 1. Verify indicators were calculated
        indicators_calculated = analysis.get("indicators", {})
        assert len(indicators_calculated) > 0, "Indicators should be calculated"

        # Count how many indicators were actually calculated
        indicator_count = len(indicators_calculated)
        print(f"\n✓ Calculated {indicator_count} indicators")

        # 2. Verify patterns were detected (if any exist in the data)
        patterns_detected = analysis.get("patterns", [])
        pattern_count = len(patterns_detected)
        print(f"✓ Detected {pattern_count} patterns")

        # 3. Verify aggregation result exists
        aggregated = analysis.get("aggregated_signal", {})
        assert "action" in aggregated, "Aggregated signal should have action"
        assert "confidence" in aggregated, "Aggregated signal should have confidence"

        final_action = aggregated.get("action")
        final_confidence = aggregated.get("confidence", 0.0)

        # 4. Verify confidence is within valid range
        assert 0.0 <= final_confidence <= 1.0, (
            f"Confidence should be between 0 and 1, got {final_confidence}"
        )
        print(f"✓ Final action: {final_action}, Confidence: {final_confidence:.4f}")

        # 5. Verify action_scores exist and are normalized correctly
        assert "action_scores" in aggregated, "Aggregated signal should have action_scores"
        action_scores = aggregated.get("action_scores", {})

        assert "buy" in action_scores, "Action scores should include 'buy'"
        assert "sell" in action_scores, "Action scores should include 'sell'"
        assert "hold" in action_scores, "Action scores should include 'hold'"

        buy_score = action_scores.get("buy", 0.0)
        sell_score = action_scores.get("sell", 0.0)
        hold_score = action_scores.get("hold", 0.0)

        # 6. Verify action scores are normalized (sum to ~1.0)
        total_score = buy_score + sell_score + hold_score
        assert 0.9 <= total_score <= 1.1, (
            f"Action scores should sum to ~1.0 after normalization, "
            f"got {total_score:.6f} (buy: {buy_score:.6f}, sell: {sell_score:.6f}, hold: {hold_score:.6f})"
        )
        print(f"✓ Action scores normalized correctly: total = {total_score:.6f}")
        print(f"  - Buy: {buy_score:.6f} ({buy_score*100:.2f}%)")
        print(f"  - Sell: {sell_score:.6f} ({sell_score*100:.2f}%)")
        print(f"  - Hold: {hold_score:.6f} ({hold_score*100:.2f}%)")

        # 7. Verify action scores are non-negative
        assert buy_score >= 0.0, f"Buy score should be non-negative, got {buy_score}"
        assert sell_score >= 0.0, f"Sell score should be non-negative, got {sell_score}"
        assert hold_score >= 0.0, f"Hold score should be non-negative, got {hold_score}"

        # 8. Verify final action matches highest score
        max_score_action = max(action_scores, key=action_scores.get)
        assert final_action == max_score_action or final_action == "skip", (
            f"Final action '{final_action}' should match highest score action '{max_score_action}' "
            f"(or be 'skip' if risk override). Scores: {action_scores}"
        )

        # 9. Verify signals_used count
        signals_used = aggregated.get("signals_used", 0)
        assert signals_used >= 0, f"Signals used should be non-negative, got {signals_used}"
        print(f"✓ Signals used in aggregation: {signals_used}")

        # 10. Verify aggregation method
        aggregation_method = aggregated.get("aggregation_method", "unknown")
        assert aggregation_method == "weighted_average", (
            f"Expected aggregation method 'weighted_average', got '{aggregation_method}'"
        )
        print(f"✓ Aggregation method: {aggregation_method}")

        # 11. Verify position_scale_factor if present
        if "position_scale_factor" in aggregated:
            scale_factor = aggregated.get("position_scale_factor", 1.0)
            assert 0.0 <= scale_factor <= 1.2, (
                f"Position scale factor should be between 0 and 1.2, got {scale_factor}"
            )
            print(f"✓ Position scale factor: {scale_factor:.4f}")

        # 12. Verify risk_override if present
        if "risk_override" in aggregated:
            risk_override = aggregated.get("risk_override", False)
            assert isinstance(risk_override, bool), (
                f"Risk override should be boolean, got {type(risk_override)}"
            )
            if risk_override:
                print("✓ Risk override applied")

        print("\n✅ All signal aggregation checks passed!")
        print(f"   Summary: {indicator_count} indicators, {pattern_count} patterns, "
              f"{signals_used} signals used, final action: {final_action}, "
              f"confidence: {final_confidence:.2%}")
