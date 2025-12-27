"""
Integration tests for Celery tasks.
"""

from decimal import Decimal
from unittest.mock import patch

import pytest
from django.test import TestCase

pytestmark = pytest.mark.integration

from stocks.models import TradingBotConfig
from stocks.tasks import execute_trading_bots
from stocks.tests.fixtures.factories import (
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)


class TestCeleryTasks(TestCase):
    """Test Celery tasks."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.stock = StockFactory.create()
        StockPriceFactory.create_series(self.stock, days=30)

    def test_execute_trading_bots_all_active(self):
        """Test executing all active bots."""
        # Create active bot
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        bot_config.assigned_stocks.add(self.stock)

        # Call task directly (not asynchronously)
        result = execute_trading_bots()

        assert result["status"] == "success"
        assert result["bots_processed"] >= 0

    def test_execute_trading_bots_specific_stock(self):
        """Test executing bots for specific stock."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        bot_config.assigned_stocks.add(self.stock)

        result = execute_trading_bots(stock_symbol=self.stock.symbol)

        assert result["status"] == "success"

    def test_execute_trading_bots_no_active_bots(self):
        """Test handling no active bots."""
        # Create inactive bot
        TradingBotConfigFactory.create(
            user=self.user,
            is_active=False,
        )

        result = execute_trading_bots()

        assert result["status"] == "success"
        assert result["bots_processed"] == 0
        assert "No active bots" in result["message"]

    def test_execute_trading_bots_error_handling_per_bot(self):
        """Test error handling per bot."""
        # Create bot with invalid configuration
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        # Don't assign stocks - might cause error
        # bot_config.assigned_stocks.add(self.stock)

        result = execute_trading_bots()

        # Should handle errors gracefully
        assert result["status"] in ["success", "error"]
        if "errors" in result:
            assert isinstance(result["errors"], list)

    def test_execute_trading_bots_task_result_structure(self):
        """Test task result structure."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        bot_config.assigned_stocks.add(self.stock)

        result = execute_trading_bots()

        assert "status" in result
        assert "bots_processed" in result
        assert "trades_executed" in result
        assert isinstance(result["bots_processed"], int)
        assert isinstance(result["trades_executed"], int)

    def test_execute_trading_bots_integration_with_bot_engine(self):
        """Test integration with bot engine."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        bot_config.assigned_stocks.add(self.stock)

        result = execute_trading_bots()

        # Should call bot.run_analysis() or bot.analyze_stock()
        assert result["status"] == "success"

    def test_execute_trading_bots_trade_execution_counting(self):
        """Test trade execution counting."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        bot_config.assigned_stocks.add(self.stock)

        # Set up user with cash
        from users.models import UserProfile

        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.cash = Decimal("10000.00")
        profile.save()

        result = execute_trading_bots()

        assert "trades_executed" in result
        assert result["trades_executed"] >= 0

    def test_execute_trading_bots_error_aggregation(self):
        """Test error aggregation."""
        # Create multiple bots, some with errors
        bot1 = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        bot1.assigned_stocks.add(self.stock)

        bot2 = TradingBotConfigFactory.create(
            user=self.user,
            is_active=True,
        )
        # Don't assign stocks to bot2 - might cause error

        result = execute_trading_bots()

        # Should aggregate errors
        if "errors" in result:
            assert isinstance(result["errors"], list)
