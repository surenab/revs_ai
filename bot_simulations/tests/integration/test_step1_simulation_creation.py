"""
Integration tests for Step 1: Simulation creation and data persistence.
"""

import pytest
from datetime import date
from decimal import Decimal
from django.test import TestCase

pytestmark = pytest.mark.integration

from bot_simulations.models import BotSimulationRun
from bot_simulations.simulation.engine import SimulationEngine
from bot_simulations.tests.fixtures.factories import BotSimulationRunFactory
from bot_simulations.tests.integration.test_base import SimulationFlowTestBase


class TestStep1SimulationCreation(SimulationFlowTestBase):
    """Test Step 1: Simulation creation and data persistence."""

    def test_create_multiple_simulations_with_different_configs(self):
        """Test creating multiple simulation runs with different configurations."""
        # Create simulation with fund-based type
        sim1 = BotSimulationRunFactory.create(
            user=self.user,
            name="Fund Simulation",
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1],
            simulation_type="fund",
            initial_fund=Decimal("50000.00"),
            config_ranges={
                "signal_weights": {"indicator": [0.3], "pattern": [0.15]},
                "risk_params": {"risk_score_threshold": [80]},
                "period_days": [14],
            },
        )

        # Create simulation with portfolio-based type
        sim2 = BotSimulationRunFactory.create(
            user=self.user,
            name="Portfolio Simulation",
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1, self.stock2],
            simulation_type="portfolio",
            initial_portfolio={"AAPL": 100, "GOOGL": 50},
            config_ranges={
                "signal_weights": {"indicator": [0.4], "pattern": [0.2]},
                "risk_params": {"risk_score_threshold": [70, 90]},
                "period_days": [21, 28],
            },
        )

        # Create simulation with multiple stocks
        sim3 = BotSimulationRunFactory.create(
            user=self.user,
            name="Multi-Stock Simulation",
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1, self.stock2, self.stock3],
            config_ranges={
                "signal_weights": {"indicator": [0.2, 0.3], "pattern": [0.1, 0.15]},
                "risk_params": {"risk_score_threshold": [75]},
                "period_days": [14],
            },
        )

        # Verify all simulations were created
        self.assertEqual(BotSimulationRun.objects.count(), 3)

        # Verify sim1
        self.assertEqual(sim1.simulation_type, "fund")
        self.assertEqual(sim1.initial_fund, Decimal("50000.00"))
        self.assertEqual(sim1.stocks.count(), 1)
        self.assertIn(self.stock1, sim1.stocks.all())

        # Verify sim2
        self.assertEqual(sim2.simulation_type, "portfolio")
        self.assertEqual(sim2.initial_portfolio, {"AAPL": 100, "GOOGL": 50})
        self.assertEqual(sim2.stocks.count(), 2)

        # Verify sim3
        self.assertEqual(sim3.stocks.count(), 3)
        self.assertIn(self.stock1, sim3.stocks.all())
        self.assertIn(self.stock2, sim3.stocks.all())
        self.assertIn(self.stock3, sim3.stocks.all())

    def test_simulation_saves_correct_data(self):
        """Test that simulation saves all fields correctly."""
        config_ranges = {
            "signal_weights": {"indicator": [0.3], "pattern": [0.15]},
            "risk_params": {"risk_score_threshold": [80]},
            "period_days": [14],
        }

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            name="Test Simulation",
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1, self.stock2],
            config_ranges=config_ranges,
            simulation_type="fund",
            initial_fund=Decimal("25000.00"),
        )

        # Refresh from database
        simulation.refresh_from_db()

        # Verify all fields
        self.assertEqual(simulation.user, self.user)
        self.assertEqual(simulation.name, "Test Simulation")
        self.assertEqual(simulation.status, "pending")
        self.assertEqual(simulation.execution_start_date, self.execution_start)
        self.assertEqual(simulation.execution_end_date, self.execution_end)
        self.assertEqual(simulation.config_ranges, config_ranges)
        self.assertEqual(simulation.simulation_type, "fund")
        self.assertEqual(simulation.initial_fund, Decimal("25000.00"))
        self.assertEqual(simulation.progress, Decimal("0.00"))

        # Verify stock assignments (ManyToMany)
        self.assertEqual(simulation.stocks.count(), 2)
        self.assertIn(self.stock1, simulation.stocks.all())
        self.assertIn(self.stock2, simulation.stocks.all())

        # Verify timestamps
        self.assertIsNotNone(simulation.created_at)
        self.assertIsNone(simulation.started_at)
        self.assertIsNone(simulation.completed_at)

    def test_simulation_with_invalid_data_handling(self):
        """Test simulation handles invalid data gracefully."""
        # Test with missing execution dates
        # Create simulation directly with None dates (bypassing factory defaults)
        simulation = BotSimulationRun.objects.create(
            user=self.user,
            name="Test Simulation",
            execution_start_date=None,
            execution_end_date=None,
        )

        # Try to run simulation without dates - should raise ValueError
        with self.assertRaises(ValueError):
            engine = SimulationEngine(simulation)
            engine._split_data()

        # Test with empty stock list (should be allowed, but will fail at execution)
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[],
        )
        self.assertEqual(simulation.stocks.count(), 0)

        # Test with invalid date range (end before start)
        # Note: The model/factory allows this, but it will cause issues during execution
        # We can create it, but it's logically invalid
        invalid_simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_end,
            execution_end_date=self.execution_start,  # Invalid: end before start
        )
        # Verify it was created (model doesn't prevent it)
        self.assertIsNotNone(invalid_simulation)
        # Verify dates are set as provided (even though invalid)
        self.assertEqual(invalid_simulation.execution_start_date, self.execution_end)
        self.assertEqual(invalid_simulation.execution_end_date, self.execution_start)
