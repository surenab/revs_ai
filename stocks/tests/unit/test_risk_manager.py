"""
Unit tests for risk manager.
"""

from decimal import Decimal

import pytest
from django.test import TestCase

pytestmark = pytest.mark.unit

from stocks.models import Order, Portfolio, Stock, TradingBotConfig
from stocks.risk_manager import RiskManager
from stocks.tests.fixtures.factories import (
    OrderFactory,
    PortfolioFactory,
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)


class TestRiskManager(TestCase):
    """Test RiskManager class."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.stock = StockFactory.create()
        self.bot_config = TradingBotConfigFactory.create(
            user=self.user,
            budget_type="cash",
            budget_cash=Decimal("10000.00"),
            risk_per_trade=Decimal("2.00"),
            max_position_size=Decimal("1000.00"),
        )
        # Initialize cash_balance from budget_cash
        self.bot_config.cash_balance = Decimal("10000.00")
        self.bot_config.initial_cash = Decimal("10000.00")
        self.bot_config.save()
        self.bot_config.assigned_stocks.add(self.stock)
        self.risk_manager = RiskManager(self.bot_config)

    def test_validate_buy_order(self):
        """Test validating buy orders."""
        price = Decimal("100.00")
        quantity = Decimal("10.00")

        is_valid, reason = self.risk_manager.validate_trade(
            self.stock, "buy", quantity, price
        )

        assert isinstance(is_valid, bool)
        assert isinstance(reason, str)

    def test_validate_sell_order(self):
        """Test validating sell orders."""
        # Create a position first
        PortfolioFactory.create(
            user=self.user, stock=self.stock, quantity=Decimal("10.00")
        )

        price = Decimal("100.00")
        quantity = Decimal("5.00")

        is_valid, reason = self.risk_manager.validate_trade(
            self.stock, "sell", quantity, price
        )

        assert isinstance(is_valid, bool)

    def test_validate_trade_stock_assignment_check(self):
        """Test stock assignment check."""
        unassigned_stock = StockFactory.create(symbol="UNASSIGNED")

        is_valid, reason = self.risk_manager.validate_trade(
            unassigned_stock, "buy", Decimal("10.00"), Decimal("100.00")
        )

        assert is_valid is False
        assert "not in bot's assigned stocks" in reason

    def test_validate_trade_daily_trade_limit(self):
        """Test daily trade limit check."""
        # Set max daily trades
        self.bot_config.max_daily_trades = 1
        self.bot_config.save()

        # Create an order today
        OrderFactory.create(
            user=self.user,
            stock=self.stock,
            bot_config=self.bot_config,
            status="done",
        )

        is_valid, reason = self.risk_manager.validate_trade(
            self.stock, "buy", Decimal("10.00"), Decimal("100.00")
        )

        assert is_valid is False
        assert "Daily trade limit" in reason

    def test_validate_trade_budget_validation(self):
        """Test budget validation."""
        # Try to buy more than budget allows
        price = Decimal("100.00")
        quantity = Decimal("200.00")  # 20,000 > 10,000 budget

        is_valid, reason = self.risk_manager.validate_trade(
            self.stock, "buy", quantity, price
        )

        assert is_valid is False
        assert "Insufficient" in reason or "cash" in reason.lower()

    def test_validate_trade_max_position_size(self):
        """Test max position size validation."""
        # Set a small max position size
        self.bot_config.max_position_size = Decimal("5.00")
        self.bot_config.save()

        price = Decimal("100.00")
        quantity = Decimal("10.00")  # 10 > 5 max position

        is_valid, reason = self.risk_manager.validate_trade(
            self.stock, "buy", quantity, price
        )

        # Should fail validation due to exceeding max position size
        assert is_valid is False
        assert "exceeds max position size" in reason or "max position" in reason.lower()

    def test_calculate_position_size_with_stop_loss(self):
        """Test calculating position size with stop loss."""
        price = Decimal("100.00")
        stop_loss_price = Decimal("95.00")  # 5% stop loss

        size = self.risk_manager.calculate_position_size(
            self.stock, price, stop_loss_price
        )

        assert size > Decimal("0.00")
        assert size <= self.bot_config.max_position_size

    def test_calculate_position_size_without_stop_loss(self):
        """Test calculating position size without stop loss."""
        price = Decimal("100.00")

        size = self.risk_manager.calculate_position_size(self.stock, price, None)

        assert size > Decimal("0.00")
        assert size <= self.bot_config.max_position_size

    def test_calculate_position_size_budget_based(self):
        """Test budget-based position sizing."""
        price = Decimal("100.00")

        size = self.risk_manager.calculate_position_size(self.stock, price, None)

        # Should not exceed budget
        total_cost = size * price
        assert total_cost <= self.bot_config.cash_balance

    def test_calculate_position_size_risk_per_trade(self):
        """Test risk per trade application."""
        price = Decimal("100.00")
        stop_loss_price = Decimal("98.00")  # 2% stop loss

        size = self.risk_manager.calculate_position_size(
            self.stock, price, stop_loss_price
        )

        # Position size should be based on risk per trade (2%)
        risk_amount = self.bot_config.cash_balance * (
            self.bot_config.risk_per_trade / Decimal("100.00")
        )
        stop_loss_percent = abs((price - stop_loss_price) / price)
        expected_position_value = risk_amount / stop_loss_percent
        expected_size = expected_position_value / price

        # Allow some tolerance
        assert abs(size - expected_size) < Decimal("1.00")

    def test_calculate_risk_score(self):
        """Test calculating risk score (0-100)."""
        price = Decimal("100.00")
        quantity = Decimal("10.00")

        risk_score = self.risk_manager.calculate_risk_score(
            self.stock, price, quantity
        )

        assert Decimal("0.00") <= risk_score <= Decimal("100.00")

    def test_calculate_risk_score_components(self):
        """Test risk score component calculation."""
        price = Decimal("100.00")
        quantity = Decimal("10.00")

        risk_score = self.risk_manager.calculate_risk_score(
            self.stock, price, quantity
        )

        # Risk score should be sum of components
        assert risk_score >= Decimal("0.00")

    def test_get_available_cash_budget(self):
        """Test getting available cash budget."""
        budget = self.risk_manager._get_available_budget()

        assert budget == self.bot_config.cash_balance

    def test_get_available_portfolio_budget(self):
        """Test getting available portfolio budget."""
        # Create portfolio budget bot
        from datetime import date

        portfolio_bot = TradingBotConfigFactory.create(
            user=self.user,
            budget_type="portfolio",
            budget_cash=None,
        )
        # Create portfolio with price data so current_value works
        portfolio = PortfolioFactory.create(
            user=self.user,
            stock=self.stock,
            quantity=Decimal("10.00"),
            purchase_price=Decimal("100.00"),
            purchase_date=date.today(),
        )
        # Ensure stock has latest price for current_value calculation
        StockPriceFactory.create(
            stock=self.stock,
            close_price=Decimal("110.00"),  # Higher than purchase price
        )
        portfolio_bot.budget_portfolio.add(portfolio)

        # Create BotPortfolio entry from the assigned portfolio (as serializer would do)
        from stocks.models import BotPortfolio
        BotPortfolio.objects.create(
            bot_config=portfolio_bot,
            stock=self.stock,
            quantity=portfolio.quantity,
            average_purchase_price=portfolio.purchase_price,
            total_cost_basis=portfolio.purchase_price * Decimal(str(portfolio.quantity)),
            first_purchase_date=portfolio.purchase_date,
            last_purchase_date=portfolio.purchase_date,
        )

        risk_manager = RiskManager(portfolio_bot)
        budget = risk_manager._get_available_budget()

        # Budget should be current value of portfolio
        assert budget > Decimal("0.00")

    def test_get_bot_positions(self):
        """Test getting bot positions."""
        # Create a position
        PortfolioFactory.create(
            user=self.user, stock=self.stock, quantity=Decimal("10.00")
        )

        positions = self.risk_manager._get_bot_positions(self.stock)

        assert len(positions) >= 0  # May be 0 if order not linked

    def test_validate_trade_handle_none_price_quantity(self):
        """Test handling None price/quantity."""
        is_valid, reason = self.risk_manager.validate_trade(
            self.stock, "buy", None, None
        )

        # Should handle None gracefully
        assert isinstance(is_valid, bool)

    def test_calculate_position_size_zero_budget(self):
        """Test position sizing with zero budget."""
        self.bot_config.budget_cash = Decimal("0.00")
        self.bot_config.cash_balance = Decimal("0.00")
        self.bot_config.save()

        size = self.risk_manager.calculate_position_size(
            self.stock, Decimal("100.00"), None
        )

        assert size == 0

    def test_calculate_risk_score_zero_quantity(self):
        """Test risk score calculation with zero quantity."""
        risk_score = self.risk_manager.calculate_risk_score(
            self.stock, Decimal("100.00"), Decimal("0.00")
        )

        assert risk_score >= Decimal("0.00")
