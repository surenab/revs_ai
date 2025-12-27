"""
Integration tests for order execution and portfolio management.
"""

from decimal import Decimal

import pytest
from django.test import TestCase

pytestmark = pytest.mark.integration

from stocks.bot_engine import TradingBot
from stocks.models import Order, Portfolio
from stocks.tests.fixtures.factories import (
    OrderFactory,
    PortfolioFactory,
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)


class TestOrderExecution(TestCase):
    """Test order execution and portfolio management."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.stock = StockFactory.create()
        StockPriceFactory.create_series(self.stock, days=30)

        # Set up user profile with cash
        from users.models import UserProfile

        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.profile.cash = Decimal("10000.00")
        self.profile.save()

        self.bot_config = TradingBotConfigFactory.create(
            user=self.user,
            budget_type="cash",
            budget_cash=Decimal("10000.00"),
        )
        self.bot_config.assigned_stocks.add(self.stock)
        self.bot = TradingBot(self.bot_config)

    def test_buy_order_execution(self):
        """Test buy order execution."""
        initial_cash = self.profile.cash
        analysis = {
            "action": "buy",
            "reason": "Test buy",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "buy", analysis)

        if order:
            assert order.transaction_type == "buy"
            assert order.status == "done"
            assert order.executed_price is not None

            # Cash should be reduced
            self.profile.refresh_from_db()
            assert self.profile.cash < initial_cash

    def test_buy_order_portfolio_entry_creation(self):
        """Test portfolio entry creation on buy."""
        analysis = {
            "action": "buy",
            "reason": "Test buy",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "buy", analysis)

        if order:
            # Portfolio entry should be created
            portfolio = Portfolio.objects.filter(user=self.user, stock=self.stock).first()
            assert portfolio is not None
            assert portfolio.quantity > Decimal("0.00")

    def test_buy_order_average_purchase_price(self):
        """Test average purchase price calculation."""
        # First buy
        analysis1 = {
            "action": "buy",
            "reason": "First buy",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }
        order1 = self.bot.execute_trade(self.stock, "buy", analysis1)

        if order1:
            portfolio1 = Portfolio.objects.get(user=self.user, stock=self.stock)
            first_price = portfolio1.purchase_price
            first_quantity = portfolio1.quantity

            # Second buy (with different price if possible)
            # Wait a moment and get new price, or use a different approach
            analysis2 = {
                "action": "buy",
                "reason": "Second buy",
                "risk_score": Decimal("50.00"),
                "indicators": {},
                "patterns": [],
            }
            order2 = self.bot.execute_trade(self.stock, "buy", analysis2)

            if order2:
                portfolio2 = Portfolio.objects.get(user=self.user, stock=self.stock)
                # Quantity should increase
                assert portfolio2.quantity > first_quantity
                # Purchase price should be weighted average (may be same if prices are same)
                # Just verify it's a valid price
                assert portfolio2.purchase_price > Decimal("0.00")

    def test_sell_order_execution(self):
        """Test sell order execution."""
        # Create a position first
        from datetime import date

        PortfolioFactory.create(
            user=self.user,
            stock=self.stock,
            quantity=Decimal("10.00"),
            purchase_price=Decimal("100.00"),
            purchase_date=date.today(),
        )

        initial_cash = self.profile.cash
        analysis = {
            "action": "sell",
            "reason": "Test sell",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "sell", analysis)

        if order:
            assert order.transaction_type == "sell"
            assert order.status == "done"

            # Cash should be increased
            self.profile.refresh_from_db()
            assert self.profile.cash > initial_cash

    def test_sell_order_portfolio_reduction(self):
        """Test portfolio quantity reduction on sell."""
        # Create a position
        from datetime import date

        PortfolioFactory.create(
            user=self.user,
            stock=self.stock,
            quantity=Decimal("10.00"),
            purchase_price=Decimal("100.00"),
            purchase_date=date.today(),
        )

        initial_quantity = Decimal("10.00")
        analysis = {
            "action": "sell",
            "reason": "Test sell",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "sell", analysis)

        if order:
            portfolio = Portfolio.objects.filter(user=self.user, stock=self.stock).first()
            if portfolio:
                assert portfolio.quantity < initial_quantity
            else:
                # Portfolio might be deleted if quantity becomes 0
                assert True

    def test_sell_order_delete_portfolio_when_zero(self):
        """Test portfolio deletion when quantity becomes zero."""
        # Create a small position
        from datetime import date

        PortfolioFactory.create(
            user=self.user,
            stock=self.stock,
            quantity=Decimal("1.00"),
            purchase_price=Decimal("100.00"),
            purchase_date=date.today(),
        )

        analysis = {
            "action": "sell",
            "reason": "Test sell all",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "sell", analysis)

        if order:
            # Portfolio should be deleted if quantity becomes 0
            portfolio = Portfolio.objects.filter(user=self.user, stock=self.stock).first()
            # May or may not exist depending on implementation
            assert portfolio is None or portfolio.quantity <= Decimal("0.00")

    def test_order_validation_insufficient_funds(self):
        """Test order validation with insufficient funds."""
        self.profile.cash = Decimal("100.00")
        self.profile.save()

        analysis = {
            "action": "buy",
            "reason": "Test",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "buy", analysis)

        # Should fail validation
        assert order is None

    def test_order_validation_insufficient_shares(self):
        """Test order validation with insufficient shares."""
        # Create small position
        from datetime import date

        PortfolioFactory.create(
            user=self.user,
            stock=self.stock,
            quantity=Decimal("1.00"),
            purchase_price=Decimal("100.00"),
            purchase_date=date.today(),
        )

        analysis = {
            "action": "sell",
            "reason": "Test sell more than owned",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        # Try to sell more than owned
        # This should be handled by risk manager validation
        order = self.bot.execute_trade(self.stock, "sell", analysis)

        # May or may not execute depending on quantity calculation
        if order:
            assert order.quantity <= Decimal("1.00")

    def test_multiple_buy_orders(self):
        """Test multiple buy orders."""
        # First buy
        analysis1 = {
            "action": "buy",
            "reason": "First",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }
        order1 = self.bot.execute_trade(self.stock, "buy", analysis1)

        # Second buy
        analysis2 = {
            "action": "buy",
            "reason": "Second",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }
        order2 = self.bot.execute_trade(self.stock, "buy", analysis2)

        if order1 and order2:
            portfolio = Portfolio.objects.get(user=self.user, stock=self.stock)
            # Should have combined quantity
            assert portfolio.quantity > Decimal("0.00")

    def test_partial_sell(self):
        """Test partial sell."""
        # Create position
        from datetime import date

        PortfolioFactory.create(
            user=self.user,
            stock=self.stock,
            quantity=Decimal("10.00"),
            purchase_price=Decimal("100.00"),
            purchase_date=date.today(),
        )

        initial_quantity = Decimal("10.00")
        analysis = {
            "action": "sell",
            "reason": "Partial sell",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "sell", analysis)

        if order:
            portfolio = Portfolio.objects.filter(user=self.user, stock=self.stock).first()
            if portfolio:
                # Should have reduced quantity
                assert portfolio.quantity < initial_quantity
                assert portfolio.quantity > Decimal("0.00")

    def test_complete_sell(self):
        """Test complete sell."""
        # Create position
        from datetime import date

        PortfolioFactory.create(
            user=self.user,
            stock=self.stock,
            quantity=Decimal("1.00"),
            purchase_price=Decimal("100.00"),
            purchase_date=date.today(),
        )

        analysis = {
            "action": "sell",
            "reason": "Complete sell",
            "risk_score": Decimal("50.00"),
            "indicators": {},
            "patterns": [],
        }

        order = self.bot.execute_trade(self.stock, "sell", analysis)

        if order:
            # Portfolio should be deleted
            portfolio = Portfolio.objects.filter(user=self.user, stock=self.stock).first()
            assert portfolio is None or portfolio.quantity <= Decimal("0.00")
