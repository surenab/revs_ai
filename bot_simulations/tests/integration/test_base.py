"""
Base test class for simulation flow tests.
"""

from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase

from bot_simulations.tests.fixtures.factories import StockTickFactory
from stocks.tests.fixtures.factories import StockFactory, UserFactory


class SimulationFlowTestBase(TestCase):
    """Base class with common test fixtures for simulation flow tests."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.stock1 = StockFactory.create(symbol="AAPL", name="Apple Inc.")
        self.stock2 = StockFactory.create(symbol="GOOGL", name="Google Inc.")
        self.stock3 = StockFactory.create(symbol="MSFT", name="Microsoft Corp.")

        # Create execution date range
        self.execution_start = date.today() - timedelta(days=30)
        self.execution_end = date.today() - timedelta(days=1)
        self.historical_start = date.today() - timedelta(days=60)

        # Create tick data for historical period (before execution)
        self.historical_ticks = StockTickFactory.create_series(
            stock=self.stock1,
            start_date=self.historical_start,
            end_date=self.execution_start - timedelta(days=1),
            start_price=Decimal("150.00"),
            ticks_per_day=10,
        )

        # Create tick data for execution period
        self.execution_ticks = StockTickFactory.create_series(
            stock=self.stock1,
            start_date=self.execution_start,
            end_date=self.execution_end,
            start_price=Decimal("155.00"),
            ticks_per_day=10,
        )

        # Create tick data for stock2
        StockTickFactory.create_series(
            stock=self.stock2,
            start_date=self.historical_start,
            end_date=self.execution_end,
            start_price=Decimal("100.00"),
            ticks_per_day=10,
        )
