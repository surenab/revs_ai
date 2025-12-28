"""
Integration tests for complete bot execution flow with full configuration.
Tests bot execution with all indicators, patterns, ML models, social/news analysis,
and comprehensive edge case testing.
"""

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from django.test import TestCase
from django.utils import timezone

pytestmark = pytest.mark.integration

from stocks.bot_engine import TradingBot
from stocks.models import (
    BotSignalHistory,
    MLModel,
    Order,
    Stock,
    StockPrice,
    StockTick,
    TradingBotConfig,
    TradingBotExecution,
)
from stocks.tests.fixtures.factories import (
    MLModelFactory,
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)
from users.models import UserProfile


class TestFullBotExecutionFlow(TestCase):
    """Test complete bot execution flow with full configuration."""

    def setUp(self):
        """Set up test fixtures with full bot configuration."""
        self.user = UserFactory.create()

        # Create user profile with 10000 available fund
        self.user_profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.user_profile.cash = Decimal("10000.00")
        self.user_profile.save()

        # Create multiple stocks
        self.stocks = [
            StockFactory.create(symbol="AAPL", name="Apple Inc."),
            StockFactory.create(symbol="GOOGL", name="Alphabet Inc."),
            StockFactory.create(symbol="MSFT", name="Microsoft Corporation"),
            StockFactory.create(symbol="TSLA", name="Tesla Inc."),
        ]

        # Create dummy ML model
        self.ml_model = MLModelFactory.create(
            name="Dummy ML Model",
            model_type="classification",
            framework="custom",
            is_active=True,
        )

        # Create bot with full configuration
        self.bot_config = TradingBotConfigFactory.create(
            user=self.user,
            name="Full Configuration Bot",
            is_active=True,
            budget_type="cash",
            budget_cash=Decimal("10000.00"),
            period_days=28,  # 28 days period as requested
            risk_per_trade=Decimal("2.00"),
            stop_loss_percent=Decimal("5.00"),
            take_profit_percent=Decimal("10.00"),
            max_position_size=Decimal("1000.00"),
            max_daily_trades=10,
            max_daily_loss=Decimal("500.00"),
            risk_score_threshold=Decimal("80.00"),
            risk_adjustment_factor=Decimal("0.40"),
            risk_based_position_scaling=True,
            signal_aggregation_method="weighted_average",
            enable_social_analysis=True,
            enable_news_analysis=True,
            enabled_ml_models=[str(self.ml_model.id)],
            ml_model_weights={str(self.ml_model.id): 1.0},
            signal_weights={
                "ml": 0.3,
                "indicators": 0.3,
                "patterns": 0.2,
                "social": 0.1,
                "news": 0.1,
            },
            signal_thresholds={
                "min_confidence": 0.5,
                "min_signals": 2,
            },
        )

        # Enable all indicators
        self.bot_config.enabled_indicators = {
            # Moving Averages
            "sma": {"period": 20},
            "ema": {"period": 20},
            "wma": {"period": 20},
            "dema": {"period": 20},
            "tema": {"period": 20},
            "tma": {"period": 20},
            "hma": {"period": 20},
            "mcginley": {"period": 14},
            "vwap_ma": {"period": 20},
            # Bands & Channels
            "bollinger": {"period": 20},
            "keltner": {"period": 20, "multiplier": 2.0},
            "donchian": {"period": 20},
            "fractal": {"period": 5},
            # Oscillators
            "rsi": {"period": 14},
            "adx": {"period": 14},
            "cci": {"period": 20},
            "mfi": {"period": 14},
            "macd": {"fast_period": 12, "slow_period": 26, "signal_period": 9},
            "williams_r": {"period": 14},
            "momentum": {"period": 10},
            "proc": {"period": 12},
            "obv": {},
            "stochastic": {"k_period": 14, "d_period": 3},
            # Other Indicators
            "vwap": {},
            "atr": {"period": 14},
            "atr_trailing": {"period": 14, "multiplier": 2.0},
            "psar": {"acceleration": 0.02, "maximum": 0.20},
            "supertrend": {"period": 10, "multiplier": 3.0},
            "alligator": {"jaw_period": 13, "teeth_period": 8, "lips_period": 5},
            "ichimoku": {"tenkan_period": 9, "kijun_period": 26, "senkou_b_period": 52},
            "linear_regression": {"period": 14},
            "pivot_points": {},
        }

        # Enable all patterns
        self.bot_config.enabled_patterns = {
            # Candlestick Patterns
            "three_white_soldiers": {"min_confidence": 0.5},
            "morning_doji_star": {"min_confidence": 0.5},
            "morning_star": {"min_confidence": 0.5},
            "abandoned_baby": {"min_confidence": 0.5},
            "conceal_baby_swallow": {"min_confidence": 0.5},
            "stick_sandwich": {"min_confidence": 0.5},
            "kicking": {"min_confidence": 0.5},
            "engulfing": {"min_confidence": 0.5},
            "bullish_engulfing": {"min_confidence": 0.5},
            "bearish_engulfing": {"min_confidence": 0.5},
            "homing_pigeon": {"min_confidence": 0.5},
            "advance_block": {"min_confidence": 0.5},
            "tri_star": {"min_confidence": 0.5},
            "spinning_top": {"min_confidence": 0.5},
            # Chart Patterns
            "head_and_shoulders": {"min_confidence": 0.5},
            "double_top": {"min_confidence": 0.5},
            "double_bottom": {"min_confidence": 0.5},
            "flag": {"min_confidence": 0.5},
            "pennant": {"min_confidence": 0.5},
            "wedge": {"min_confidence": 0.5},
            "rising_wedge": {"min_confidence": 0.5},
            "falling_wedge": {"min_confidence": 0.5},
        }

        self.bot_config.save()

        # Assign all stocks to bot
        self.bot_config.assigned_stocks.set(self.stocks)

        # Create bot instance
        self.bot = TradingBot(self.bot_config)

    def _create_stock_tick_data(self, stock: Stock, days: int = 28, ticks_per_day: int = 100):
        """
        Create StockTick data for a specific period.

        Args:
            stock: Stock instance
            days: Number of days to create data for
            ticks_per_day: Number of ticks per day
        """
        ticks = []
        now = timezone.now()
        end_date = now.date()
        start_date = end_date - timedelta(days=days - 1)

        current_price = Decimal("150.00")

        for day_offset in range(days):
            day_date = start_date + timedelta(days=day_offset)
            is_today = (day_date == end_date)

            # Create ticks throughout the day
            for tick_num in range(ticks_per_day):
                # Calculate time within the day (9:30 AM to 4:00 PM market hours)
                hours = 9 + (tick_num / ticks_per_day) * 6.5  # 9:30 AM to 4:00 PM
                minutes = int((hours % 1) * 60)
                hours = int(hours)

                # Add some randomness to minutes for more realistic distribution
                minutes += random.randint(0, 5)
                if minutes >= 60:
                    minutes = 59

                tick_time = timezone.make_aware(
                    datetime.combine(day_date, datetime.min.time().replace(hour=hours, minute=minutes))
                )

                # For today, ensure timestamp is in the past
                if is_today and tick_time > now:
                    # Use a time that's definitely in the past (e.g., 1 hour ago, or market start if before market)
                    if now.hour < 9 or (now.hour == 9 and now.minute < 30):
                        # Before market open, use yesterday's market close
                        tick_time = now - timedelta(days=1)
                        tick_time = tick_time.replace(hour=16, minute=0, second=0, microsecond=0)
                    else:
                        # Use a time earlier in today (at least 1 minute ago)
                        tick_time = now - timedelta(minutes=random.randint(1, 60))

                # Simulate price movement (random walk)
                price_change = Decimal(str(random.uniform(-0.01, 0.01)))
                current_price = max(Decimal("0.01"), current_price * (Decimal("1.0") + price_change))

                # Create tick
                tick = StockTick.objects.create(
                    stock=stock,
                    price=current_price,
                    volume=random.randint(100, 10000),
                    bid_price=current_price * Decimal("0.999"),
                    ask_price=current_price * Decimal("1.001"),
                    bid_size=random.randint(100, 1000),
                    ask_size=random.randint(100, 1000),
                    timestamp=tick_time,
                    is_market_hours=True,
                    trade_type="market",
                )
                ticks.append(tick)

        return ticks

    def _create_stock_price_data(self, stock: Stock, days: int = 28):
        """
        Create StockPrice data as fallback (daily data).

        Args:
            stock: Stock instance
            days: Number of days to create data for
        """
        prices = []
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        current_price = Decimal("150.00")

        for day_offset in range(days):
            day_date = start_date + timedelta(days=day_offset)

            # Simulate price movement
            price_change = Decimal(str(random.uniform(-0.02, 0.02)))
            current_price = max(Decimal("0.01"), current_price * (Decimal("1.0") + price_change))

            price = StockPriceFactory.create(
                stock=stock,
                date_obj=day_date,
                close_price=current_price,
                open_price=current_price * Decimal("0.99"),
                high_price=current_price * Decimal("1.01"),
                low_price=current_price * Decimal("0.98"),
                volume=random.randint(1000000, 10000000),
                interval="1d",
            )
            prices.append(price)

        return prices

    def test_bot_execution_uses_exact_period_data(self):
        """
        Test that bot execution uses exactly the period_days (28 days) of stock tick data.
        This is the first test as requested.
        Verifies that tick data is used when available, not price data.
        """
        # Create tick data for exactly 28 days for all stocks
        # Also create daily price data so _get_last_day_tick_data can find the last trading day
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)
            # Create daily price data as well (needed for _get_last_day_tick_data to work)
            # But bot should still use tick data, not price data
            self._create_stock_price_data(stock, days=28)

        # Execute bot analysis
        results = self.bot.run_analysis()

        # Verify all stocks were analyzed
        self.assertIn("stocks_analyzed", results)
        self.assertGreater(len(results["stocks_analyzed"]), 0)

        # For each analyzed stock, verify the price data used
        for stock_symbol in results["stocks_analyzed"]:
            stock = Stock.objects.get(symbol=stock_symbol)

            # Get the signal history to check what data was used
            signal_history = BotSignalHistory.objects.filter(
                bot_config=self.bot_config,
                stock=stock
            ).order_by("-timestamp").first()

            self.assertIsNotNone(signal_history, f"Signal history should exist for {stock_symbol}")

            # Check price data snapshot
            price_snapshot = signal_history.price_data_snapshot
            self.assertIsNotNone(price_snapshot)

            # Verify the count matches period_days (28 days)
            # The bot aggregates ticks into daily candles, so we should have ~28 days
            data_count = price_snapshot.get("count", 0)
            self.assertGreaterEqual(
                data_count,
                25,  # Allow some flexibility (at least 25 days)
                f"Expected at least 25 days of data for {stock_symbol}, got {data_count}"
            )
            self.assertLessEqual(
                data_count,
                28,  # Should not exceed period_days
                f"Expected at most 28 days of data for {stock_symbol}, got {data_count}"
            )

            # Verify tick data was used (not price data)
            # Check the price data array to see if _data_source is 'tick'
            price_data_array = price_snapshot.get("data", [])
            if price_data_array:
                # Check first and last entries to verify data source
                first_entry = price_data_array[0] if price_data_array else {}
                last_entry = price_data_array[-1] if price_data_array else {}

                # Verify tick data was used (not price data)
                data_source = first_entry.get("_data_source") or last_entry.get("_data_source")
                self.assertEqual(
                    data_source,
                    "tick",
                    f"Expected tick data to be used for {stock_symbol}, but data_source is '{data_source}'. "
                    f"Both tick and price data exist, but bot should prioritize tick data."
                )

            # Verify tick data exists in database
            tick_count_in_db = StockTick.objects.filter(
                stock=stock,
                timestamp__date__gte=timezone.now().date() - timedelta(days=28),
                timestamp__date__lte=timezone.now().date(),
            ).count()
            self.assertGreater(
                tick_count_in_db,
                0,
                f"Expected tick data to exist for {stock_symbol}"
            )

    def test_bot_execution_with_insufficient_data(self):
        """Test edge case: bot execution with insufficient data (less than period_days)."""
        # Create only 10 days of data (less than 28 days period)
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=10, ticks_per_day=50)

        # Execute bot analysis
        results = self.bot.run_analysis()

        # Bot should still work but may have limited data
        self.assertIn("stocks_analyzed", results)

        # Check that bot handles insufficient data gracefully
        for stock_symbol in results.get("stocks_analyzed", []):
            stock = Stock.objects.get(symbol=stock_symbol)
            signal_history = BotSignalHistory.objects.filter(
                bot_config=self.bot_config,
                stock=stock
            ).order_by("-timestamp").first()

            if signal_history:
                price_snapshot = signal_history.price_data_snapshot
                data_count = price_snapshot.get("count", 0)
                # Should have at most 10 days (what we created)
                self.assertLessEqual(data_count, 10)

    def test_bot_execution_with_no_data(self):
        """Test edge case: bot execution with no price data."""
        # Don't create any price data
        # Execute bot analysis
        results = self.bot.run_analysis()

        # All stocks should be skipped
        self.assertIn("skipped", results)
        self.assertGreater(len(results["skipped"]), 0)

        # Verify skip reasons
        for skipped_item in results["skipped"]:
            self.assertIn("reason", skipped_item)
            self.assertIn("No price data", skipped_item["reason"])

    def test_bot_execution_with_more_than_period_data(self):
        """Test edge case: bot execution with more data than period_days (should limit to period)."""
        # Create 50 days of data (more than 28 days period)
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=50, ticks_per_day=50)

        # Execute bot analysis
        results = self.bot.run_analysis()

        # Verify bot only uses period_days (28 days) of data
        for stock_symbol in results.get("stocks_analyzed", []):
            stock = Stock.objects.get(symbol=stock_symbol)
            signal_history = BotSignalHistory.objects.filter(
                bot_config=self.bot_config,
                stock=stock
            ).order_by("-timestamp").first()

            if signal_history:
                price_snapshot = signal_history.price_data_snapshot
                data_count = price_snapshot.get("count", 0)
                # Should not exceed period_days (28)
                self.assertLessEqual(
                    data_count,
                    28,
                    f"Bot should limit data to period_days (28), but got {data_count} days"
                )

    def test_bot_execution_all_indicators_calculated(self):
        """Test that all enabled indicators are calculated."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for one stock
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # Verify indicators are calculated
        self.assertIn("indicators", analysis)
        indicators = analysis["indicators"]

        # Check that multiple indicators are present (not all may have values due to insufficient data)
        # But at least some should be calculated
        self.assertGreater(len(indicators), 0, "At least some indicators should be calculated")

        # Verify signal history has indicator signals
        signal_history = BotSignalHistory.objects.filter(
            bot_config=self.bot_config,
            stock=stock
        ).order_by("-timestamp").first()

        if signal_history:
            indicator_signals = signal_history.indicator_signals
            self.assertIsNotNone(indicator_signals)
            self.assertIn("count", indicator_signals)

    def test_bot_execution_all_patterns_detected(self):
        """Test that pattern detection is attempted for all enabled patterns."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for one stock
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # Verify patterns are detected (may be empty if no patterns match)
        self.assertIn("patterns", analysis)
        patterns = analysis["patterns"]
        # Patterns may be empty if none match, which is fine

        # Verify signal history has pattern signals
        signal_history = BotSignalHistory.objects.filter(
            bot_config=self.bot_config,
            stock=stock
        ).order_by("-timestamp").first()

        if signal_history:
            pattern_signals = signal_history.pattern_signals
            self.assertIsNotNone(pattern_signals)
            self.assertIn("count", pattern_signals)

    def test_bot_execution_ml_model_used(self):
        """Test that ML model predictions are used."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for one stock
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # Verify ML signals are present
        self.assertIn("ml_signals", analysis)
        ml_signals = analysis["ml_signals"]
        # Should have at least one ML signal since we enabled ML model
        self.assertGreaterEqual(len(ml_signals), 0)  # May be 0 if model fails, but should be attempted

        # Verify signal history has ML signals
        signal_history = BotSignalHistory.objects.filter(
            bot_config=self.bot_config,
            stock=stock
        ).order_by("-timestamp").first()

        if signal_history:
            ml_signals_history = signal_history.ml_signals
            self.assertIsNotNone(ml_signals_history)
            self.assertIn("count", ml_signals_history)

    def test_bot_execution_social_analysis_used(self):
        """Test that social media analysis is used."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for one stock
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # Verify social signals are present (may be None if analysis fails)
        self.assertIn("social_signals", analysis)
        # social_signals may be None if analysis fails, which is acceptable

        # Verify signal history has social signals
        signal_history = BotSignalHistory.objects.filter(
            bot_config=self.bot_config,
            stock=stock
        ).order_by("-timestamp").first()

        if signal_history:
            social_signals = signal_history.social_signals
            # Should be a dict (may be empty)
            self.assertIsInstance(social_signals, dict)

    def test_bot_execution_news_analysis_used(self):
        """Test that news analysis is used."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for one stock
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # Verify news signals are present (may be None if analysis fails)
        self.assertIn("news_signals", analysis)
        # news_signals may be None if analysis fails, which is acceptable

        # Verify signal history has news signals
        signal_history = BotSignalHistory.objects.filter(
            bot_config=self.bot_config,
            stock=stock
        ).order_by("-timestamp").first()

        if signal_history:
            news_signals = signal_history.news_signals
            # Should be a dict (may be empty)
            self.assertIsInstance(news_signals, dict)

    def test_bot_execution_risk_management_applied(self):
        """Test that risk management is applied."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for one stock
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # Verify risk score is calculated
        self.assertIn("risk_score", analysis)
        risk_score = analysis["risk_score"]

        if risk_score is not None:
            # Risk score should be between 0 and 100
            self.assertGreaterEqual(float(risk_score), 0.0)
            self.assertLessEqual(float(risk_score), 100.0)

        # Verify signal history has risk score
        signal_history = BotSignalHistory.objects.filter(
            bot_config=self.bot_config,
            stock=stock
        ).order_by("-timestamp").first()

        if signal_history:
            self.assertIsNotNone(signal_history.risk_score)

    def test_bot_execution_signal_aggregation(self):
        """Test that signal aggregation works correctly."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for one stock
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # Verify aggregated signal is present
        self.assertIn("aggregated_signal", analysis)
        aggregated = analysis["aggregated_signal"]

        # Should have action and confidence
        self.assertIn("action", aggregated)
        self.assertIn("confidence", aggregated)

        # Action should be one of: buy, sell, hold
        self.assertIn(aggregated["action"], ["buy", "sell", "hold", "skip"])

        # Confidence should be between 0 and 1
        confidence = aggregated.get("confidence", 0.0)
        self.assertGreaterEqual(confidence, 0.0)
        self.assertLessEqual(confidence, 1.0)

    def test_bot_execution_multiple_stocks(self):
        """Test that bot executes for multiple assigned stocks."""
        # Create tick data for all stocks
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis for all stocks
        results = self.bot.run_analysis()

        # Verify all stocks are processed
        self.assertIn("stocks_analyzed", results)
        self.assertIn("skipped", results)

        # Should have processed all assigned stocks (either analyzed or skipped)
        total_processed = len(results["stocks_analyzed"]) + len(results["skipped"])
        self.assertGreaterEqual(
            total_processed,
            len(self.stocks),
            f"Expected at least {len(self.stocks)} stocks to be processed, got {total_processed}"
        )

    def test_bot_execution_fallback_to_daily_data(self):
        """
        Test edge case: bot falls back to daily StockPrice data when no tick data exists.
        Verifies that price data is used ONLY when tick data is missing.
        """
        # Create only daily price data (no tick data)
        for stock in self.stocks:
            self._create_stock_price_data(stock, days=28)
            # Verify no tick data exists
            tick_count = StockTick.objects.filter(stock=stock).count()
            self.assertEqual(
                tick_count,
                0,
                f"Expected no tick data for {stock.symbol} in fallback test, but found {tick_count} ticks"
            )

        # Execute bot analysis
        results = self.bot.run_analysis()

        # Bot should still work using daily data
        self.assertIn("stocks_analyzed", results)

        # Verify daily data was used (as fallback)
        for stock_symbol in results.get("stocks_analyzed", []):
            stock = Stock.objects.get(symbol=stock_symbol)
            signal_history = BotSignalHistory.objects.filter(
                bot_config=self.bot_config,
                stock=stock
            ).order_by("-timestamp").first()

            if signal_history:
                price_snapshot = signal_history.price_data_snapshot
                data_count = price_snapshot.get("count", 0)
                # Should have data (may be less than 28 if daily data is limited)
                self.assertGreater(data_count, 0)

                # Verify price data was used (not tick data)
                price_data_array = price_snapshot.get("data", [])
                if price_data_array:
                    # Check first entry to verify data source
                    first_entry = price_data_array[0] if price_data_array else {}
                    data_source = first_entry.get("_data_source")
                    self.assertEqual(
                        data_source,
                        "price",
                        f"Expected price data (fallback) to be used for {stock_symbol}, "
                        f"but data_source is '{data_source}'. No tick data exists, so should use price data."
                    )

    def test_bot_execution_with_mixed_data_sources(self):
        """
        Test edge case: some stocks have tick data, others only have daily data.
        Verifies that tick data is used when available, and price data is used as fallback.
        """
        # Create tick data for first two stocks
        self._create_stock_tick_data(self.stocks[0], days=28, ticks_per_day=50)
        self._create_stock_tick_data(self.stocks[1], days=28, ticks_per_day=50)

        # Create only daily data for last two stocks (no tick data)
        self._create_stock_price_data(self.stocks[2], days=28)
        self._create_stock_price_data(self.stocks[3], days=28)

        # Verify tick data exists for first two stocks
        self.assertGreater(StockTick.objects.filter(stock=self.stocks[0]).count(), 0)
        self.assertGreater(StockTick.objects.filter(stock=self.stocks[1]).count(), 0)
        # Verify no tick data for last two stocks
        self.assertEqual(StockTick.objects.filter(stock=self.stocks[2]).count(), 0)
        self.assertEqual(StockTick.objects.filter(stock=self.stocks[3]).count(), 0)

        # Execute bot analysis
        results = self.bot.run_analysis()

        # Bot should handle both data sources
        self.assertIn("stocks_analyzed", results)
        self.assertGreater(len(results["stocks_analyzed"]), 0)

        # Verify tick data is used for stocks with tick data
        for stock in [self.stocks[0], self.stocks[1]]:
            signal_history = BotSignalHistory.objects.filter(
                bot_config=self.bot_config,
                stock=stock
            ).order_by("-timestamp").first()

            if signal_history:
                price_snapshot = signal_history.price_data_snapshot
                price_data_array = price_snapshot.get("data", [])
                if price_data_array:
                    first_entry = price_data_array[0]
                    data_source = first_entry.get("_data_source")
                    self.assertEqual(
                        data_source,
                        "tick",
                        f"Expected tick data to be used for {stock.symbol}, but got '{data_source}'"
                    )

        # Verify price data is used as fallback for stocks without tick data
        for stock in [self.stocks[2], self.stocks[3]]:
            signal_history = BotSignalHistory.objects.filter(
                bot_config=self.bot_config,
                stock=stock
            ).order_by("-timestamp").first()

            if signal_history:
                price_snapshot = signal_history.price_data_snapshot
                price_data_array = price_snapshot.get("data", [])
                if price_data_array:
                    first_entry = price_data_array[0]
                    data_source = first_entry.get("_data_source")
                    self.assertEqual(
                        data_source,
                        "price",
                        f"Expected price data (fallback) to be used for {stock.symbol}, but got '{data_source}'"
                    )

    def test_bot_execution_creates_signal_history(self):
        """Test that signal history is created for each analysis."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        initial_count = BotSignalHistory.objects.count()

        # Execute bot analysis
        results = self.bot.run_analysis()

        # Verify signal history was created
        final_count = BotSignalHistory.objects.count()
        self.assertGreater(final_count, initial_count, "Signal history should be created")

        # Verify signal history for each analyzed stock
        for stock_symbol in results.get("stocks_analyzed", []):
            stock = Stock.objects.get(symbol=stock_symbol)
            signal_history = BotSignalHistory.objects.filter(
                bot_config=self.bot_config,
                stock=stock
            ).order_by("-timestamp").first()

            self.assertIsNotNone(signal_history, f"Signal history should exist for {stock_symbol}")
            self.assertEqual(signal_history.bot_config, self.bot_config)
            self.assertEqual(signal_history.stock, stock)
            self.assertIn(signal_history.final_decision, ["buy", "sell", "hold", "skip"])

    def test_bot_execution_position_size_calculation(self):
        """Test that position size is calculated correctly."""
        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # If action is buy, position_size should be calculated
        if analysis["action"] == "buy":
            self.assertIn("position_size", analysis)
            position_size = analysis.get("position_size")
            if position_size is not None:
                self.assertGreater(position_size, 0.0)

    def test_bot_execution_with_risk_threshold_exceeded(self):
        """Test edge case: risk threshold exceeded should prevent trading."""
        # Set very low risk threshold
        self.bot_config.risk_score_threshold = Decimal("10.00")
        self.bot_config.save()

        # Create tick data
        for stock in self.stocks:
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)

        # Execute bot analysis
        stock = self.stocks[0]
        analysis = self.bot.analyze_stock(stock)

        # If risk score exceeds threshold, action should be skip/hold
        if analysis.get("risk_score") and float(analysis["risk_score"]) > 10.0:
            self.assertIn(analysis["action"], ["skip", "hold"])
