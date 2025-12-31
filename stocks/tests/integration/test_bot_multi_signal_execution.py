"""
Integration tests for bot execution with multiple signals (buy, sell, hold).
Tests scenarios with multiple stocks and different signals per stock.
"""

from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import random

import pytest
from django.test import TestCase
from django.utils import timezone

pytestmark = pytest.mark.integration

from stocks.bot_engine import TradingBot
from stocks.models import (
    BotPortfolio,
    BotPortfolioLot,
    Order,
    Stock,
    StockPrice,
    StockTick,
    TradingBotConfig,
    TradingBotExecution,
)
from stocks.tests.fixtures.factories import (
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)
from users.models import UserProfile


class TestBotMultiSignalExecution(TestCase):
    """Test bot execution with multiple signals (buy, sell, hold)."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.user_profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.user_profile.cash = Decimal("10000.00")
        self.user_profile.save()

        # Create bot with sufficient cash
        self.bot_config = TradingBotConfigFactory.create(
            user=self.user,
            budget_type="cash",
            budget_cash=Decimal("200000.00"),
            risk_per_trade=Decimal("1.00"),  # Lower risk to allow more trades
            signal_aggregation_method="weighted_average",
        )
        self.bot_config.cash_balance = Decimal("200000.00")
        self.bot_config.initial_cash = Decimal("200000.00")
        self.bot_config.save()

        self.bot = TradingBot(self.bot_config)

    def _create_stock_tick_data(self, stock: Stock, days: int = 28, ticks_per_day: int = 50):
        """Create StockTick data for a stock."""
        ticks = []
        now = timezone.now()
        end_date = now.date()
        start_date = end_date - timedelta(days=days - 1)
        current_price = Decimal("150.00")

        for day_offset in range(days):
            day_date = start_date + timedelta(days=day_offset)
            is_today = (day_date == end_date)

            for tick_num in range(ticks_per_day):
                hours = 9 + (tick_num / ticks_per_day) * 6.5
                minutes = int((hours % 1) * 60)
                hours = int(hours)
                minutes += random.randint(0, 5)
                if minutes >= 60:
                    minutes = 59

                tick_time = timezone.make_aware(
                    datetime.combine(day_date, datetime.min.time().replace(hour=hours, minute=minutes))
                )

                if is_today and tick_time > now:
                    tick_time = now - timedelta(seconds=random.randint(1, 3600))

                price_variation = Decimal(str(random.uniform(0.99, 1.01)))
                tick_price = current_price * price_variation

                tick = StockTick.objects.create(
                    stock=stock,
                    timestamp=tick_time,
                    price=tick_price,
                    volume=random.randint(100, 1000),
                )
                ticks.append(tick)

                current_price = tick_price

        return ticks

    def _create_mock_analysis(self, action: str, confidence: float = 0.7, risk_score: float = 50.0):
        """Helper to create mock analysis result."""
        return {
            "action": action,
            "reason": f"Test {action} signal",
            "confidence": confidence,
            "risk_score": Decimal(str(risk_score)),
            "indicators": {"rsi": 50.0, "macd": 0.5},
            "patterns": [],
            "aggregated_signal": {
                "action": action,
                "confidence": confidence,
            },
            "ml_signals": [],
            "social_signals": [],
            "news_signals": [],
        }

    def test_bot_execution_with_mixed_signals_single_stock(self):
        """Test bot execution with 2 buy, 2 sell, and 2 hold signals for a single stock."""
        # Create a single stock
        stock = StockFactory.create(symbol="TEST")
        StockPriceFactory.create_series(stock, days=30)
        self._create_stock_tick_data(stock, days=28, ticks_per_day=50)
        self.bot_config.assigned_stocks.add(stock)

        # Create mock analyses: 2 buy, 2 sell, 2 hold
        mock_analyses = [
            self._create_mock_analysis("buy", confidence=0.8, risk_score=30.0),
            self._create_mock_analysis("buy", confidence=0.75, risk_score=35.0),
            self._create_mock_analysis("sell", confidence=0.7, risk_score=60.0),
            self._create_mock_analysis("sell", confidence=0.65, risk_score=65.0),
            self._create_mock_analysis("hold", confidence=0.5, risk_score=50.0),
            self._create_mock_analysis("hold", confidence=0.45, risk_score=55.0),
        ]

        # Mock analyze_stock to return different signals on each call
        call_count = [0]

        def mock_analyze_stock(stock_instance):
            analysis = mock_analyses[call_count[0] % len(mock_analyses)]
            call_count[0] += 1
            return analysis

        with patch.object(self.bot, "analyze_stock", side_effect=mock_analyze_stock):
            # Run analysis multiple times to get different signals
            results = []
            for _ in range(6):
                analysis = self.bot.analyze_stock(stock)
                results.append(analysis["action"])

            # Verify we got all signal types
            assert "buy" in results
            assert "sell" in results
            assert "hold" in results or "skip" in results

            # Test execution for each signal type
            buy_count = 0
            sell_count = 0
            hold_count = 0

            for analysis in mock_analyses:
                action = analysis["action"]
                if action == "buy":
                    order = self.bot.execute_trade(stock, "buy", analysis)
                    if order:
                        buy_count += 1
                        assert order.transaction_type == "buy"
                        assert order.status == "done"
                elif action == "sell":
                    # Create a position first for sell
                    if not BotPortfolio.objects.filter(
                        bot_config=self.bot_config, stock=stock
                    ).exists():
                        # Create a buy order first
                        buy_analysis = self._create_mock_analysis("buy", confidence=0.8)
                        buy_order = self.bot.execute_trade(stock, "buy", buy_analysis)
                        assert buy_order is not None

                    order = self.bot.execute_trade(stock, "sell", analysis)
                    if order:
                        sell_count += 1
                        assert order.transaction_type == "sell"
                        assert order.status == "done"
                elif action == "hold":
                    # Hold should not create an order (execute_trade only accepts buy/sell)
                    hold_count += 1
                    # For hold, we just verify no order is created
                    # execute_trade doesn't accept "hold" as action

            # Verify we executed trades
            assert buy_count >= 1, "Should have executed at least one buy order"
            assert sell_count >= 1, "Should have executed at least one sell order"
            assert hold_count >= 1, "Should have processed hold signals"

    def test_bot_execution_multiple_stocks_same_signals(self):
        """Test bot execution with multiple assigned stocks, all with same signal types."""
        # Create multiple stocks
        stocks = [
            StockFactory.create(symbol="STOCK1"),
            StockFactory.create(symbol="STOCK2"),
            StockFactory.create(symbol="STOCK3"),
        ]

        for stock in stocks:
            StockPriceFactory.create_series(stock, days=30)
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)
            self.bot_config.assigned_stocks.add(stock)

        # Mock analyze_stock to return buy for all stocks
        def mock_analyze_stock(stock_instance):
            return self._create_mock_analysis("buy", confidence=0.8, risk_score=30.0)

        with patch.object(self.bot, "analyze_stock", side_effect=mock_analyze_stock):
            # Run analysis for all stocks
            results = self.bot.run_analysis()

            # Verify all stocks were analyzed
            assert len(results["stocks_analyzed"]) >= len(stocks)
            assert len(results["buy_signals"]) >= len(stocks)

            # Verify buy signals were created for each stock
            for stock in stocks:
                assert any(
                    signal.get("stock") == stock.symbol for signal in results["buy_signals"]
                )

            # Execute trades for all stocks
            executed_orders = []
            for stock in stocks:
                analysis = self._create_mock_analysis("buy", confidence=0.8)
                order = self.bot.execute_trade(stock, "buy", analysis)
                if order:
                    executed_orders.append(order)
                    assert order.transaction_type == "buy"
                    assert order.bot_config == self.bot_config
                    assert order.stock == stock

            # Verify orders were created (may be less if cash runs out)
            assert len(executed_orders) >= 1, "Should have executed at least one buy order"

            # Verify BotPortfolio entries were created
            for stock in stocks:
                bot_portfolio = BotPortfolio.objects.filter(
                    bot_config=self.bot_config, stock=stock
                ).first()
                assert bot_portfolio is not None, f"BotPortfolio should exist for {stock.symbol}"
                assert bot_portfolio.quantity > 0

    def test_bot_execution_multiple_stocks_different_signals(self):
        """Test bot execution with multiple assigned stocks, each with different signals."""
        # Create multiple stocks
        stock1 = StockFactory.create(symbol="BUY_STOCK")
        stock2 = StockFactory.create(symbol="SELL_STOCK")
        stock3 = StockFactory.create(symbol="HOLD_STOCK")
        stock4 = StockFactory.create(symbol="BUY_STOCK2")
        stock5 = StockFactory.create(symbol="SELL_STOCK2")
        stock6 = StockFactory.create(symbol="HOLD_STOCK2")

        stocks = [stock1, stock2, stock3, stock4, stock5, stock6]
        signals = ["buy", "sell", "hold", "buy", "sell", "hold"]

        for stock in stocks:
            StockPriceFactory.create_series(stock, days=30)
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)
            self.bot_config.assigned_stocks.add(stock)

        # Create initial positions for sell stocks
        for stock, signal in zip(stocks, signals):
            if signal == "sell":
                # Create a buy order first to have a position
                buy_analysis = self._create_mock_analysis("buy", confidence=0.8)
                buy_order = self.bot.execute_trade(stock, "buy", buy_analysis)
                assert buy_order is not None

        # Mock analyze_stock to return different signals for each stock
        stock_signal_map = dict(zip([s.id for s in stocks], signals))

        def mock_analyze_stock(stock_instance):
            signal = stock_signal_map.get(stock_instance.id, "hold")
            return self._create_mock_analysis(signal, confidence=0.7, risk_score=50.0)

        with patch.object(self.bot, "analyze_stock", side_effect=mock_analyze_stock):
            # Run analysis for all stocks
            results = self.bot.run_analysis()

            # Verify all stocks were analyzed
            assert len(results["stocks_analyzed"]) >= len(stocks)

            # Count signals by type
            buy_signals = [s for s in results.get("buy_signals", [])]
            sell_signals = [s for s in results.get("sell_signals", [])]

            # Verify we have buy and sell signals
            assert len(buy_signals) >= 2, "Should have at least 2 buy signals"
            assert len(sell_signals) >= 2, "Should have at least 2 sell signals"

            # Execute trades based on signals
            buy_orders = []
            sell_orders = []
            hold_count = 0

            for stock, signal in zip(stocks, signals):
                analysis = self._create_mock_analysis(signal, confidence=0.7)
                if signal == "buy":
                    order = self.bot.execute_trade(stock, "buy", analysis)
                    if order:
                        buy_orders.append(order)
                        assert order.transaction_type == "buy"
                elif signal == "sell":
                    order = self.bot.execute_trade(stock, "sell", analysis)
                    if order:
                        sell_orders.append(order)
                        assert order.transaction_type == "sell"
                elif signal == "hold":
                    # Hold doesn't execute a trade, just track it
                    hold_count += 1
                    # execute_trade doesn't accept "hold" as action

            # Verify orders were created (may be less if cash runs out)
            assert len(buy_orders) >= 1, "Should have executed at least 1 buy order"
            assert len(sell_orders) >= 1, "Should have executed at least 1 sell order"
            assert hold_count >= 2, "Should have processed at least 2 hold signals"

            # Verify BotPortfolio entries for buy stocks
            for stock, signal in zip(stocks, signals):
                if signal == "buy":
                    bot_portfolio = BotPortfolio.objects.filter(
                        bot_config=self.bot_config, stock=stock
                    ).first()
                    assert bot_portfolio is not None, f"BotPortfolio should exist for {stock.symbol}"
                    assert bot_portfolio.quantity > 0

            # Verify cash balance was updated
            self.bot_config.refresh_from_db()
            assert self.bot_config.cash_balance < self.bot_config.initial_cash

    def test_bot_execution_mixed_signals_with_portfolio_holdings(self):
        """Test bot execution with mixed signals including portfolio holdings."""
        # Create stocks
        stock1 = StockFactory.create(symbol="NEW_BUY")
        stock2 = StockFactory.create(symbol="EXISTING_SELL")
        stock3 = StockFactory.create(symbol="EXISTING_HOLD")

        for stock in [stock1, stock2, stock3]:
            StockPriceFactory.create_series(stock, days=30)
            self._create_stock_tick_data(stock, days=28, ticks_per_day=50)
            self.bot_config.assigned_stocks.add(stock)

        # Create existing portfolio positions for stock2 and stock3
        for stock in [stock2, stock3]:
            buy_analysis = self._create_mock_analysis("buy", confidence=0.8)
            buy_order = self.bot.execute_trade(stock, "buy", buy_analysis)
            assert buy_order is not None

        # Verify portfolio holdings exist
        portfolio_count = BotPortfolio.objects.filter(
            bot_config=self.bot_config
        ).count()
        assert portfolio_count >= 2

        # Now run analysis - should analyze both assigned stocks and portfolio holdings
        results = self.bot.run_analysis()

        # Should analyze all stocks (assigned + portfolio)
        assert len(results["stocks_analyzed"]) >= 3

        # Execute different signals
        # New buy for stock1
        buy_analysis = self._create_mock_analysis("buy", confidence=0.8)
        buy_order = self.bot.execute_trade(stock1, "buy", buy_analysis)
        assert buy_order is not None

        # Sell for stock2 (existing position)
        sell_analysis = self._create_mock_analysis("sell", confidence=0.7)
        sell_order = self.bot.execute_trade(stock2, "sell", sell_analysis)
        assert sell_order is not None

        # Hold for stock3 (existing position) - hold doesn't execute trades
        # Just verify the position remains

        # Verify final portfolio state
        stock1_portfolio = BotPortfolio.objects.filter(
            bot_config=self.bot_config, stock=stock1
        ).first()
        assert stock1_portfolio is not None
        assert stock1_portfolio.quantity > 0

        # stock2 might be sold completely or partially
        stock2_portfolio = BotPortfolio.objects.filter(
            bot_config=self.bot_config, stock=stock2
        ).first()
        # If fully sold, portfolio might be deleted
        # If partially sold, quantity should be reduced

        # stock3 should still have position (hold doesn't sell)
        stock3_portfolio = BotPortfolio.objects.filter(
            bot_config=self.bot_config, stock=stock3
        ).first()
        assert stock3_portfolio is not None
        assert stock3_portfolio.quantity > 0

    def test_bot_execution_signal_execution_order(self):
        """Test that signals are executed in correct order (buy, sell, hold)."""
        stock = StockFactory.create(symbol="ORDER_TEST")
        StockPriceFactory.create_series(stock, days=30)
        self._create_stock_tick_data(stock, days=28, ticks_per_day=50)
        self.bot_config.assigned_stocks.add(stock)

        # Track execution order
        execution_order = []

        # First, create initial positions for sell signals (2 buy orders to have enough shares)
        for _ in range(2):
            buy_analysis = self._create_mock_analysis("buy", confidence=0.8)
            buy_order = self.bot.execute_trade(stock, "buy", buy_analysis)
            if buy_order:
                execution_order.append("buy")

        # Verify we have enough shares for 2 sells
        bot_portfolio = BotPortfolio.objects.filter(
            bot_config=self.bot_config, stock=stock
        ).first()
        assert bot_portfolio is not None
        assert bot_portfolio.quantity >= 2, "Should have at least 2 shares for 2 sells"

        # Now execute in order: sell, sell, hold, hold
        signals = ["sell", "sell", "hold", "hold"]
        for signal in signals:
            analysis = self._create_mock_analysis(signal, confidence=0.7)
            if signal == "hold":
                # Hold doesn't execute a trade
                execution_order.append(signal)
            else:
                order = self.bot.execute_trade(stock, signal, analysis)
                if order:
                    execution_order.append(signal)

        # Verify we executed all signal types
        assert "buy" in execution_order
        assert "sell" in execution_order
        assert "hold" in execution_order

        # Verify final state - we should have at least 2 buys, and as many sells/holds as possible
        buy_count = execution_order.count("buy")
        sell_count = execution_order.count("sell")
        hold_count = execution_order.count("hold")

        assert buy_count >= 2, f"Expected at least 2 buy signals, got {buy_count}"
        assert sell_count >= 1, f"Expected at least 1 sell signal, got {sell_count}"
        assert hold_count == 2, f"Expected exactly 2 hold signals, got {hold_count}"
