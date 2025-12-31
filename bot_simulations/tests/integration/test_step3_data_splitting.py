"""
Integration tests for Step 3: Data splitting and period selection.
"""

import pytest
from datetime import date
from django.test import TestCase

pytestmark = pytest.mark.integration

from bot_simulations.simulation.engine import SimulationEngine
from bot_simulations.tests.fixtures.factories import BotSimulationRunFactory
from bot_simulations.tests.integration.test_base import SimulationFlowTestBase
from stocks.tests.fixtures.factories import StockFactory


class TestStep3DataSplitting(SimulationFlowTestBase):
    """Test Step 3: Data splitting and period selection."""

    def test_split_data_uses_correct_execution_period(self):
        """Test that data splitting uses correct execution period."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1],
        )

        engine = SimulationEngine(simulation)
        split_result = engine._split_data()

        # Verify historical_data contains ticks before execution_start_date
        historical_data = split_result["historical_data"]
        self.assertIn(self.stock1.symbol, historical_data)

        for tick in historical_data[self.stock1.symbol]:
            tick_date = date.fromisoformat(tick["date"])
            self.assertLess(tick_date, self.execution_start, "Historical data should be before execution start")

        # Verify execution_data contains ticks between execution dates
        execution_data = split_result["execution_data"]
        self.assertIn(self.stock1.symbol, execution_data)

        for tick in execution_data[self.stock1.symbol]:
            tick_date = date.fromisoformat(tick["date"])
            self.assertGreaterEqual(tick_date, self.execution_start, "Execution data should start at execution_start")
            self.assertLessEqual(tick_date, self.execution_end, "Execution data should end at execution_end")

        # Verify no overlap
        historical_dates = {date.fromisoformat(t["date"]) for t in historical_data[self.stock1.symbol]}
        execution_dates = {date.fromisoformat(t["date"]) for t in execution_data[self.stock1.symbol]}
        self.assertEqual(len(historical_dates & execution_dates), 0, "No overlap between historical and execution data")

        # Verify data is organized by stock symbol
        self.assertIn(self.stock1.symbol, historical_data)
        self.assertIn(self.stock1.symbol, execution_data)

    def test_split_data_calculates_correct_counts(self):
        """Test that data splitting calculates correct counts."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1],
        )

        engine = SimulationEngine(simulation)
        split_result = engine._split_data()

        # Calculate expected counts
        historical_points = split_result["historical_points"]
        execution_points = split_result["execution_points"]
        total_points = split_result["total_points"]

        # Verify counts match
        self.assertEqual(total_points, historical_points + execution_points)

        # Verify simulation.total_data_points is updated
        simulation.refresh_from_db()
        self.assertEqual(simulation.total_data_points, total_points)

        # Verify counts are positive
        self.assertGreater(historical_points, 0, "Should have historical data points")
        self.assertGreater(execution_points, 0, "Should have execution data points")

    def test_split_data_with_multiple_stocks(self):
        """Test data splitting with multiple stocks."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1, self.stock2],
        )

        engine = SimulationEngine(simulation)
        split_result = engine._split_data()

        # Verify each stock has separate data
        historical_data = split_result["historical_data"]
        execution_data = split_result["execution_data"]

        self.assertIn(self.stock1.symbol, historical_data)
        self.assertIn(self.stock1.symbol, execution_data)
        self.assertIn(self.stock2.symbol, historical_data)
        self.assertIn(self.stock2.symbol, execution_data)

        # Verify data counts per stock
        stock1_historical = len(historical_data[self.stock1.symbol])
        stock1_execution = len(execution_data[self.stock1.symbol])
        stock2_historical = len(historical_data[self.stock2.symbol])
        stock2_execution = len(execution_data[self.stock2.symbol])

        self.assertGreater(stock1_historical, 0)
        self.assertGreater(stock1_execution, 0)
        self.assertGreater(stock2_historical, 0)
        self.assertGreater(stock2_execution, 0)

        # Verify total counts
        total_historical = split_result["historical_points"]
        total_execution = split_result["execution_points"]

        self.assertEqual(
            total_historical,
            stock1_historical + stock2_historical,
            "Total historical should equal sum of per-stock historical",
        )
        self.assertEqual(
            total_execution,
            stock1_execution + stock2_execution,
            "Total execution should equal sum of per-stock execution",
        )

        # Verify date ranges
        self.assertEqual(split_result["execution_start"], self.execution_start)
        self.assertEqual(split_result["execution_end"], self.execution_end)

    def test_split_data_handles_missing_data_gracefully(self):
        """Test data splitting handles missing data gracefully."""
        # Create stock with no tick data
        stock_no_data = StockFactory.create(symbol="NODATA")

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[stock_no_data],
        )

        engine = SimulationEngine(simulation)

        # _split_data() handles missing data gracefully by returning empty lists
        # It doesn't raise an error, but returns empty data structures
        split_result = engine._split_data()

        # Verify it returns empty data structures instead of raising an error
        self.assertIn(stock_no_data.symbol, split_result["historical_data"])
        self.assertIn(stock_no_data.symbol, split_result["execution_data"])
        self.assertEqual(len(split_result["historical_data"][stock_no_data.symbol]), 0)
        self.assertEqual(len(split_result["execution_data"][stock_no_data.symbol]), 0)
        self.assertEqual(split_result["total_points"], 0)
        self.assertEqual(split_result["historical_points"], 0)
        self.assertEqual(split_result["execution_points"], 0)

        # Verify simulation.total_data_points is updated to 0
        simulation.refresh_from_db()
        self.assertEqual(simulation.total_data_points, 0)
