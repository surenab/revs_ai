"""
Integration tests for Step 5: Result aggregation and final metrics calculation.
"""

import pytest
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase

pytestmark = pytest.mark.integration

from bot_simulations.models import BotSimulationResult
from bot_simulations.simulation.engine import SimulationEngine
from bot_simulations.tests.fixtures.factories import BotSimulationRunFactory
from bot_simulations.tests.integration.test_base import SimulationFlowTestBase


class TestStep5ResultAggregation(SimulationFlowTestBase):
    """Test Step 5: Result aggregation and final metrics calculation."""

    def test_result_aggregation_creates_final_result(self):
        """Test that result aggregation creates final results."""
        from bot_simulations.simulation.day_executor import DayExecutor

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_start + timedelta(days=2),  # 3 days
            stocks=[self.stock1],
        )

        engine = SimulationEngine(simulation)
        split_result = engine._split_data()
        bot_configs = engine._generate_bot_configs()
        bot_sim_config = bot_configs[0]
        bot_config = engine._create_temp_bot_config(bot_sim_config)

        # Prepare combined data
        combined_data = {}
        for stock in bot_sim_config.assigned_stocks.all():
            symbol = stock.symbol
            historical = split_result["historical_data"].get(symbol, [])
            execution = split_result["execution_data"].get(symbol, [])
            combined_data[symbol] = historical + execution
            combined_data[symbol].sort(key=lambda t: t.get("timestamp", ""))

        # Execute days
        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.execution_start,
            daily_execution_mode=True,
            bot_sim_config=bot_sim_config,
        )

        execution_result = day_executor.execute_daily(
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_start + timedelta(days=2),
        )

        # Calculate and store result
        engine._calculate_and_store_result(bot_sim_config, execution_result, None)

        # Verify BotSimulationResult was created
        result = BotSimulationResult.objects.filter(simulation_config=bot_sim_config).first()
        self.assertIsNotNone(result, "BotSimulationResult should be created")

        # Verify result fields
        self.assertIsNotNone(result.total_profit)
        self.assertIsNotNone(result.total_trades)
        self.assertIsNotNone(result.win_rate)
        # signal_productivity is a JSONField that defaults to empty dict
        # It may be empty if no trades were executed
        self.assertIsNotNone(result.signal_productivity)
        self.assertIsInstance(result.signal_productivity, dict)

        # Clean up
        bot_config.delete()

    def test_result_aggregation_metrics_accuracy(self):
        """Test that result aggregation metrics are accurate."""
        from bot_simulations.simulation.day_executor import DayExecutor

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_start + timedelta(days=2),
            stocks=[self.stock1],
            initial_fund=Decimal("10000.00"),
        )

        engine = SimulationEngine(simulation)
        split_result = engine._split_data()
        bot_configs = engine._generate_bot_configs()
        bot_sim_config = bot_configs[0]
        bot_config = engine._create_temp_bot_config(bot_sim_config)

        # Prepare combined data
        combined_data = {}
        for stock in bot_sim_config.assigned_stocks.all():
            symbol = stock.symbol
            historical = split_result["historical_data"].get(symbol, [])
            execution = split_result["execution_data"].get(symbol, [])
            combined_data[symbol] = historical + execution
            combined_data[symbol].sort(key=lambda t: t.get("timestamp", ""))

        # Execute days
        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.execution_start,
            daily_execution_mode=True,
            bot_sim_config=bot_sim_config,
        )

        execution_result = day_executor.execute_daily(
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_start + timedelta(days=2),
        )

        # Calculate and store result
        engine._calculate_and_store_result(bot_sim_config, execution_result, None)

        # Get result
        result = BotSimulationResult.objects.get(simulation_config=bot_sim_config)

        # Verify total profit = sum of daily profits
        daily_results = execution_result.get("daily_results", [])
        expected_total_profit = sum(
            Decimal(str(day.get("performance_metrics", {}).get("daily_profit", 0)))
            for day in daily_results
        )
        self.assertAlmostEqual(
            float(result.total_profit),
            float(expected_total_profit),
            places=2,
            msg="Total profit should equal sum of daily profits",
        )

        # Verify final cash and portfolio value match last day
        if daily_results:
            last_day_metrics = daily_results[-1].get("performance_metrics", {})
            last_day_cash = Decimal(str(last_day_metrics.get("cash", 0)))
            last_day_portfolio_value = Decimal(str(last_day_metrics.get("portfolio_value", 0)))

            self.assertAlmostEqual(
                float(result.final_cash),
                float(last_day_cash),
                places=2,
                msg="Final cash should match last day cash",
            )
            self.assertAlmostEqual(
                float(result.final_portfolio_value),
                float(last_day_portfolio_value),
                places=2,
                msg="Final portfolio value should match last day portfolio value",
            )

        # Clean up
        bot_config.delete()
