"""
Integration tests for bot portfolio management system.
Tests bot cash management, portfolio tracking, HIFO sell logic, and integer quantities.
"""

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from stocks.models import (
    BotPortfolio,
    BotPortfolioLot,
    Order,
    Stock,
    StockPrice,
    TradingBotConfig,
)
from users.models import User, UserProfile


class BotPortfolioManagementTestCase(TestCase):
    """Test bot portfolio management functionality."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.user_profile, _ = UserProfile.objects.get_or_create(
            user=self.user, defaults={"cash": Decimal("10000.00")}
        )
        if not _:
            self.user_profile.cash = Decimal("10000.00")
            self.user_profile.save()

        # Create stock
        self.stock = Stock.objects.create(
            symbol="AAPL",
            name="Apple Inc.",
            exchange="NASDAQ",
            sector="Technology",
            industry="Consumer Electronics",
        )

        # Create stock price
        self.stock_price = StockPrice.objects.create(
            stock=self.stock,
            date=timezone.now().date(),
            open_price=Decimal("150.00"),
            high_price=Decimal("155.00"),
            low_price=Decimal("149.00"),
            close_price=Decimal("152.00"),
            volume=1000000,
        )

        # Create bot config
        self.bot_config = TradingBotConfig.objects.create(
            user=self.user,
            name="Test Bot",
            is_active=True,
            budget_type="cash",
            budget_cash=Decimal("5000.00"),
            risk_per_trade=Decimal("2.00"),
        )
        self.bot_config.assigned_stocks.add(self.stock)
        # Initialize cash balance
        self.bot_config.cash_balance = Decimal("5000.00")
        self.bot_config.initial_cash = Decimal("5000.00")
        self.bot_config.save()

    def test_bot_cash_initialization(self):
        """Test that bot cash is initialized correctly."""
        self.assertEqual(self.bot_config.cash_balance, Decimal("5000.00"))
        self.assertEqual(self.bot_config.initial_cash, Decimal("5000.00"))

    def test_bot_buy_order_creates_portfolio(self):
        """Test that bot buy order creates BotPortfolio and BotPortfolioLot entries."""
        # Create buy order
        order = Order.objects.create(
            user=self.user,
            stock=self.stock,
            transaction_type="buy",
            order_type="market",
            quantity=Decimal("10.00"),  # Will be converted to int
            bot_config=self.bot_config,
            status="waiting",
        )

        # Execute order
        result = order.execute()

        self.assertTrue(result)
        self.assertEqual(order.status, "done")

        # Check bot cash was deducted
        self.bot_config.refresh_from_db()
        expected_cost = 10 * Decimal("152.00")  # 10 shares * $152
        self.assertEqual(
            self.bot_config.cash_balance, Decimal("5000.00") - expected_cost
        )

        # Check BotPortfolio was created
        bot_portfolio = BotPortfolio.objects.get(
            bot_config=self.bot_config, stock=self.stock
        )
        self.assertEqual(bot_portfolio.quantity, 10)
        self.assertEqual(bot_portfolio.average_purchase_price, Decimal("152.00"))
        self.assertEqual(bot_portfolio.total_cost_basis, expected_cost)

        # Check BotPortfolioLot was created
        lot = BotPortfolioLot.objects.get(bot_portfolio=bot_portfolio, order=order)
        self.assertEqual(lot.quantity, 10)
        self.assertEqual(lot.remaining_quantity, 10)
        self.assertEqual(lot.purchase_price, Decimal("152.00"))

    def test_bot_sell_order_hifo_logic(self):
        """Test HIFO (Highest-In-First-Out) sell logic."""
        # Create multiple buy orders at different prices
        # First buy: 10 shares at $152 (initial price)
        order1 = Order.objects.create(
            user=self.user,
            stock=self.stock,
            transaction_type="buy",
            order_type="market",
            quantity=Decimal("10.00"),
            bot_config=self.bot_config,
            status="waiting",
        )
        # Execute first order at $152
        order1.execute()

        # Update price for second buy
        self.stock_price.close_price = Decimal("160.00")
        self.stock_price.save()

        # Second buy: 10 shares at $160 (higher price)
        order2 = Order.objects.create(
            user=self.user,
            stock=self.stock,
            transaction_type="buy",
            order_type="market",
            quantity=Decimal("10.00"),
            bot_config=self.bot_config,
            status="waiting",
        )
        # Execute second order at $160
        order2.execute()

        # Update price for sell
        self.stock_price.close_price = Decimal("155.00")
        self.stock_price.save()

        # Create sell order for 15 shares (should sell from highest price first)
        sell_order = Order.objects.create(
            user=self.user,
            stock=self.stock,
            transaction_type="sell",
            order_type="market",
            quantity=Decimal("15.00"),
            bot_config=self.bot_config,
            status="waiting",
        )

        # Execute sell order
        sell_order.execute()

        # Check that highest-priced lot was sold first
        lot2 = BotPortfolioLot.objects.get(order=order2)
        lot1 = BotPortfolioLot.objects.get(order=order1)

        # Lot2 (higher price) should be fully sold (remaining_quantity = 0)
        # Lot1 (lower price) should have 5 shares remaining (15 - 10 = 5)
        self.assertEqual(lot2.remaining_quantity, 0)
        self.assertEqual(lot1.remaining_quantity, 5)

        # Check BotPortfolio quantity
        bot_portfolio = BotPortfolio.objects.get(
            bot_config=self.bot_config, stock=self.stock
        )
        self.assertEqual(bot_portfolio.quantity, 5)

    def test_integer_quantities_only(self):
        """Test that all quantities are integers (no fractional shares)."""
        # Create order with fractional quantity
        order = Order.objects.create(
            user=self.user,
            stock=self.stock,
            transaction_type="buy",
            order_type="market",
            quantity=Decimal("10.75"),  # Fractional
            bot_config=self.bot_config,
            status="waiting",
        )

        # Execute order
        order.execute()

        # Check that quantity was rounded down to integer
        bot_portfolio = BotPortfolio.objects.get(
            bot_config=self.bot_config, stock=self.stock
        )
        self.assertEqual(bot_portfolio.quantity, 10)  # Should be 10, not 10.75

        lot = BotPortfolioLot.objects.get(bot_portfolio=bot_portfolio)
        self.assertEqual(lot.quantity, 10)
        self.assertEqual(lot.remaining_quantity, 10)

    def test_cash_alignment(self):
        """Test that buy orders never exceed available cash."""
        # Set bot cash to $1000 (enough for a few shares at $152)
        self.bot_config.cash_balance = Decimal("1000.00")
        self.bot_config.save()

        # Try to buy 10 shares at $152 (would cost $1520, but only have $1000)
        # Max affordable: floor(1000/152) = 6 shares
        order = Order.objects.create(
            user=self.user,
            stock=self.stock,
            transaction_type="buy",
            order_type="market",
            quantity=Decimal("10.00"),
            bot_config=self.bot_config,
            status="waiting",
        )

        # Execute order - should reduce quantity to what's affordable (6 shares)
        result = order.execute()

        # Should succeed but with reduced quantity
        self.assertTrue(result)
        self.bot_config.refresh_from_db()
        order.refresh_from_db()

        # Order should be done
        self.assertEqual(order.status, "done")

        # Should have bought 6 shares (max affordable: floor(1000/152) = 6)
        bot_portfolios = BotPortfolio.objects.filter(
            bot_config=self.bot_config, stock=self.stock
        )
        self.assertTrue(bot_portfolios.exists())
        portfolio = bot_portfolios.first()
        # Quantity should be 6 (max affordable)
        self.assertEqual(portfolio.quantity, 6)

        # Cash should be reduced by 6 * 152 = 912
        expected_remaining_cash = Decimal("1000.00") - (6 * Decimal("152.00"))
        self.assertEqual(self.bot_config.cash_balance, expected_remaining_cash)

    def test_portfolio_value_calculation(self):
        """Test portfolio value calculation."""
        # Buy 10 shares at $152
        order = Order.objects.create(
            user=self.user,
            stock=self.stock,
            transaction_type="buy",
            order_type="market",
            quantity=Decimal("10.00"),
            bot_config=self.bot_config,
            status="waiting",
        )
        order.execute()

        # Get portfolio value
        portfolio_value = self.bot_config.get_portfolio_value()
        expected_value = 10 * Decimal("152.00")  # 10 shares * current price
        self.assertEqual(portfolio_value, expected_value)

        # Get total equity
        total_equity = self.bot_config.get_total_equity()
        expected_equity = self.bot_config.cash_balance + expected_value
        self.assertEqual(total_equity, expected_equity)
