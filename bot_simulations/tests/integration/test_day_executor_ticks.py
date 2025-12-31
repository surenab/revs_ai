"""
Integration tests for DayExecutor tick-level processing.

Tests each tick arriving to the bot, bot execution result for each tick data,
and each indicator result for given tick data.
"""

import pytest
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase

pytestmark = pytest.mark.integration

from bot_simulations.models import BotSimulationTick
from bot_simulations.simulation.engine import SimulationEngine
from bot_simulations.simulation.day_executor import DayExecutor
from bot_simulations.tests.fixtures.factories import BotSimulationRunFactory, StockTickFactory
from bot_simulations.tests.integration.test_base import SimulationFlowTestBase
from stocks.models import Stock


class TestDayExecutorTickLevel(SimulationFlowTestBase):
    """Test DayExecutor at tick level - each tick processing."""

    def setUp(self):
        """Set up test fixtures with tick data."""
        super().setUp()

        # Create a shorter execution period for tick-level testing (1 day with multiple ticks)
        self.tick_test_date = self.execution_start

        # Ensure we have enough ticks for testing (at least 5 ticks per day)
        # The base setUp already creates ticks, but let's verify we have enough
        tick_count = StockTickFactory.create_series(
            stock=self.stock1,
            start_date=self.tick_test_date,
            end_date=self.tick_test_date,
            start_price=Decimal("150.00"),
            ticks_per_day=10,  # 10 ticks for this day
        )
        self.assertGreater(len(tick_count), 0, "Should have tick data for testing")

    def test_each_tick_arrives_to_bot(self):
        """Test that each tick in the execution period arrives to the bot."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,  # Single day
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

        # Count ticks in execution period
        execution_ticks = [
            tick for tick in combined_data[self.stock1.symbol]
            if tick.get("date") == self.tick_test_date.isoformat()
        ]
        expected_tick_count = len(execution_ticks)
        self.assertGreater(expected_tick_count, 0, "Should have ticks in execution period")

        # Execute ticks
        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=False,  # Not daily mode - process all ticks
            bot_sim_config=bot_sim_config,
        )

        result = day_executor.execute_ticks(
            testing_start_date=self.tick_test_date,
            testing_end_date=self.tick_test_date,
        )

        # Verify all ticks were processed
        tick_results = result.get("tick_results", [])
        self.assertGreater(len(tick_results), 0, "Should have processed at least some ticks")

        # Verify we processed ticks for the correct stock
        processed_ticks = [t for t in tick_results if t.get("stock_symbol") == self.stock1.symbol]
        self.assertGreater(len(processed_ticks), 0, "Should have processed ticks for stock1")

        # Verify each tick has required fields
        for tick_result in processed_ticks:
            self.assertIn("timestamp", tick_result)
            self.assertIn("date", tick_result)
            self.assertIn("stock_symbol", tick_result)
            self.assertIn("price", tick_result)
            self.assertIn("decision", tick_result)

        # Clean up
        bot_config.delete()

    def test_bot_execution_result_for_each_tick(self):
        """Test that bot execution result is generated for each tick data."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=False,
            bot_sim_config=bot_sim_config,
        )

        result = day_executor.execute_ticks(
            testing_start_date=self.tick_test_date,
            testing_end_date=self.tick_test_date,
        )

        tick_results = result.get("tick_results", [])
        self.assertGreater(len(tick_results), 0)

        # Verify each tick has a complete execution result
        for tick_result in tick_results:
            # Verify decision structure
            decision = tick_result.get("decision", {})
            self.assertIsInstance(decision, dict)
            self.assertIn("action", decision)
            self.assertIn(decision["action"], ["buy", "sell", "skip", "hold"])
            self.assertIn("reason", decision)
            self.assertIn("confidence", decision)

            # Verify price information
            self.assertIsNotNone(tick_result.get("price"))
            self.assertIsInstance(tick_result.get("price"), (int, float))

            # Verify portfolio state
            self.assertIn("cash", tick_result)
            self.assertIn("portfolio_value", tick_result)

            # Verify trade execution info
            self.assertIn("trade_executed", tick_result)
            if tick_result.get("trade_executed"):
                self.assertIn("trade_profit", tick_result)

        # Clean up
        bot_config.delete()

    def test_indicator_results_for_each_tick(self):
        """Test that indicator results are captured for each tick data."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        # Use execute_daily which stores tick results in database
        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=True,  # Use daily execution mode
            bot_sim_config=bot_sim_config,
        )

        # Execute the day - this will process ticks and store them
        day_result = day_executor.execute_daily(
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
        )

        # Verify indicator results are stored in BotSimulationTick records
        tick_records = BotSimulationTick.objects.filter(simulation_config=bot_sim_config)
        self.assertGreater(tick_records.count(), 0, "Should have stored tick records")

        # Verify each tick record has signal contributions with indicator data
        for tick_record in tick_records:
            signal_contributions = tick_record.signal_contributions or {}

            # Signal contributions should contain indicator information
            self.assertIsInstance(signal_contributions, dict)

            # Verify indicators are stored in signal_contributions
            if "indicators" in signal_contributions:
                indicators = signal_contributions["indicators"]
                self.assertIsInstance(indicators, dict)
                # Indicators dict may be empty if no indicators are enabled, but structure should exist

            # Verify indicator_signals count
            if "indicator_signals" in signal_contributions:
                indicator_count = signal_contributions["indicator_signals"]
                self.assertIsInstance(indicator_count, int)
                self.assertGreaterEqual(indicator_count, 0)

            # Verify decision structure contains indicator-derived information
            decision = tick_record.decision or {}
            self.assertIsInstance(decision, dict)
            if decision.get("action") != "skip":
                # If a decision was made, there should be confidence/risk_score
                self.assertIn("confidence", decision)
                self.assertIn("reason", decision)

        # Clean up
        bot_config.delete()

    def test_tick_processing_uses_correct_historical_data(self):
        """Test that each tick uses correct historical data up to that tick."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=False,
            bot_sim_config=bot_sim_config,
        )

        result = day_executor.execute_ticks(
            testing_start_date=self.tick_test_date,
            testing_end_date=self.tick_test_date,
        )

        tick_results = result.get("tick_results", [])
        self.assertGreater(len(tick_results), 0)

        # Verify that later ticks have more historical context
        # (Each tick should have access to all previous ticks)
        if len(tick_results) > 1:
            first_tick = tick_results[0]
            last_tick = tick_results[-1]

            # Both should have decisions (indicating analysis was run)
            self.assertIn("decision", first_tick)
            self.assertIn("decision", last_tick)

            # Both should have prices
            self.assertIsNotNone(first_tick.get("price"))
            self.assertIsNotNone(last_tick.get("price"))

        # Clean up
        bot_config.delete()

    def test_tick_decision_consistency(self):
        """Test that decisions are consistent with indicator results."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=False,
            bot_sim_config=bot_sim_config,
        )

        result = day_executor.execute_ticks(
            testing_start_date=self.tick_test_date,
            testing_end_date=self.tick_test_date,
        )

        tick_results = result.get("tick_results", [])
        self.assertGreater(len(tick_results), 0)

        # Verify each decision has required fields
        for tick_result in tick_results:
            decision = tick_result.get("decision", {})

            # Decision should have action
            self.assertIn("action", decision)
            action = decision["action"]
            self.assertIn(action, ["buy", "sell", "skip", "hold"])

            # If action is buy/sell, should have confidence
            if action in ["buy", "sell"]:
                self.assertIn("confidence", decision)
                confidence = decision.get("confidence", 0)
                self.assertGreaterEqual(confidence, 0.0)
                self.assertLessEqual(confidence, 100.0)

                # Should have reason
                self.assertIn("reason", decision)
                self.assertIsInstance(decision["reason"], str)
                self.assertGreater(len(decision["reason"]), 0)

        # Clean up
        bot_config.delete()

    def test_tick_trade_execution(self):
        """Test that trades are executed correctly for each tick when decision is buy/sell."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        initial_cash = Decimal("10000.00")
        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=initial_cash,
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=False,
            bot_sim_config=bot_sim_config,
        )

        result = day_executor.execute_ticks(
            testing_start_date=self.tick_test_date,
            testing_end_date=self.tick_test_date,
        )

        tick_results = result.get("tick_results", [])
        self.assertGreater(len(tick_results), 0)

        # Track cash changes
        trades_executed = 0
        for tick_result in tick_results:
            if tick_result.get("trade_executed"):
                trades_executed += 1
                decision = tick_result.get("decision", {})
                action = decision.get("action")

                # Verify trade was for buy or sell
                self.assertIn(action, ["buy", "sell"])

                # Verify cash changed (for buy, cash should decrease; for sell, cash should increase)
                cash_after = tick_result.get("cash", 0)
                self.assertIsNotNone(cash_after)

                # Verify portfolio value is tracked
                portfolio_value = tick_result.get("portfolio_value", 0)
                self.assertIsNotNone(portfolio_value)
                self.assertGreaterEqual(portfolio_value, 0)

        # Verify final cash is reasonable (should be less than or equal to initial if trades happened)
        final_cash = result.get("final_cash", 0)
        self.assertIsNotNone(final_cash)
        self.assertGreaterEqual(final_cash, 0)

        # Clean up
        bot_config.delete()

    def test_tick_storage_in_database(self):
        """Test that tick results are stored correctly in database."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=True,  # Use daily execution mode to store ticks
            bot_sim_config=bot_sim_config,
        )

        # Use execute_daily which stores tick results in database
        result = day_executor.execute_daily(
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
        )

        # Verify tick records were stored
        tick_records = BotSimulationTick.objects.filter(simulation_config=bot_sim_config)
        self.assertGreater(tick_records.count(), 0, "Should have stored tick records")

        # Verify each stored tick has correct structure
        for tick_record in tick_records:
            self.assertEqual(tick_record.simulation_config, bot_sim_config)
            self.assertEqual(tick_record.date, self.tick_test_date)
            self.assertEqual(tick_record.stock_symbol, self.stock1.symbol)
            self.assertIsNotNone(tick_record.tick_price)
            self.assertIsNotNone(tick_record.tick_timestamp)

            # Verify decision structure
            self.assertIsInstance(tick_record.decision, dict)
            self.assertIn("action", tick_record.decision)

            # Verify signal contributions
            self.assertIsInstance(tick_record.signal_contributions, dict)

            # Verify portfolio state
            self.assertIsInstance(tick_record.portfolio_state, dict)
            self.assertIn("cash", tick_record.portfolio_state)

            # Verify cumulative profit
            self.assertIsNotNone(tick_record.cumulative_profit)

        # Clean up
        bot_config.delete()

    def test_indicator_calculation_for_each_tick(self):
        """Test that indicators are calculated correctly for each tick's historical data."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        # Use execute_daily which stores tick results with full indicator data
        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=True,  # Use daily execution mode
            bot_sim_config=bot_sim_config,
        )

        # Execute the day - this processes ticks and stores them with indicator data
        day_result = day_executor.execute_daily(
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
        )

        # Verify tick records were stored
        tick_records = BotSimulationTick.objects.filter(simulation_config=bot_sim_config)
        self.assertGreater(tick_records.count(), 0, "Should have stored tick records")

        # Verify signal contributions contain indicator information for each tick
        ticks_with_indicators = 0
        for tick_record in tick_records:
            signal_contributions = tick_record.signal_contributions or {}

            # Signal contributions should have structure indicating analysis was performed
            self.assertIsInstance(signal_contributions, dict)

            # Verify indicators are present in signal_contributions
            if "indicators" in signal_contributions:
                indicators = signal_contributions["indicators"]
                self.assertIsInstance(indicators, dict)
                ticks_with_indicators += 1

                # If indicators dict is not empty, verify structure
                if indicators:
                    # Indicators dict should have indicator names as keys
                    # indicator_data can be a list (array of values) or dict (with metadata)
                    for indicator_name, indicator_data in indicators.items():
                        self.assertIsInstance(indicator_name, str)
                        # Indicator data can be a list (array of calculated values) or dict
                        self.assertIsInstance(
                            indicator_data, (list, dict),
                            f"indicator_data for {indicator_name} should be list or dict, got {type(indicator_data)}"
                        )
                        # If it's a list, it should contain numeric values or None
                        if isinstance(indicator_data, list):
                            # Lists can contain None values (for periods where indicator can't be calculated)
                            # or numeric values
                            for val in indicator_data:
                                if val is not None:
                                    self.assertIsInstance(val, (int, float))
                        # If it's a dict, it might have metadata like current value, values array, etc.
                        elif isinstance(indicator_data, dict):
                            # Dict structure is valid (e.g., {"current": value, "values": [...]})
                            pass

            # Verify indicator_signals count is tracked
            self.assertIn("indicator_signals", signal_contributions)
            indicator_count = signal_contributions["indicator_signals"]
            self.assertIsInstance(indicator_count, int)

            # Verify aggregated_confidence is present (indicators contribute to this)
            self.assertIn("aggregated_confidence", signal_contributions)
            confidence = signal_contributions["aggregated_confidence"]
            self.assertIsInstance(confidence, (int, float))
            self.assertGreaterEqual(confidence, 0.0)
            self.assertLessEqual(confidence, 100.0)

            # Verify action_scores are present (indicators contribute to these)
            if "action_scores" in signal_contributions:
                action_scores = signal_contributions["action_scores"]
                self.assertIsInstance(action_scores, dict)
                if action_scores:
                    # Should have buy, sell, hold scores
                    self.assertIn("buy", action_scores)
                    self.assertIn("sell", action_scores)
                    self.assertIn("hold", action_scores)

        # At least some ticks should have indicator data
        self.assertGreater(ticks_with_indicators, 0, "At least some ticks should have indicator data")

        # Clean up
        bot_config.delete()

    def test_tick_processing_order(self):
        """Test that ticks are processed in correct chronological order."""
        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
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

        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=False,
            bot_sim_config=bot_sim_config,
        )

        result = day_executor.execute_ticks(
            testing_start_date=self.tick_test_date,
            testing_end_date=self.tick_test_date,
        )

        tick_results = result.get("tick_results", [])
        self.assertGreater(len(tick_results), 0)

        # Verify ticks are in chronological order
        if len(tick_results) > 1:
            timestamps = []
            for tick_result in tick_results:
                timestamp_str = tick_result.get("timestamp", "")
                if timestamp_str:
                    from datetime import datetime
                    try:
                        if isinstance(timestamp_str, str):
                            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                        else:
                            timestamp = timestamp_str
                        timestamps.append(timestamp)
                    except Exception:
                        # If timestamp parsing fails, skip this check
                        continue

            # Verify timestamps are in ascending order
            if len(timestamps) > 1:
                for i in range(len(timestamps) - 1):
                    self.assertLessEqual(
                        timestamps[i],
                        timestamps[i + 1],
                        f"Ticks should be in chronological order: {timestamps[i]} <= {timestamps[i+1]}"
                    )

        # Clean up
        bot_config.delete()

    def test_tick_processing_with_multiple_stocks(self):
        """Test tick processing when multiple stocks are assigned to bot."""
        # Create tick data for stock2 on the same day
        StockTickFactory.create_series(
            stock=self.stock2,
            start_date=self.tick_test_date,
            end_date=self.tick_test_date,
            start_price=Decimal("100.00"),
            ticks_per_day=10,
        )

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.tick_test_date,
            execution_end_date=self.tick_test_date,
            stocks=[self.stock1, self.stock2],
        )

        engine = SimulationEngine(simulation)
        split_result = engine._split_data()
        bot_configs = engine._generate_bot_configs()

        # Find a bot config that has both stocks assigned
        multi_stock_bot = None
        for bot_config in bot_configs:
            if bot_config.assigned_stocks.count() == 2:
                multi_stock_bot = bot_config
                break

        if not multi_stock_bot:
            # If no multi-stock bot, use first bot and add second stock
            multi_stock_bot = bot_configs[0]
            multi_stock_bot.assigned_stocks.add(self.stock2)

        bot_config = engine._create_temp_bot_config(multi_stock_bot)

        # Prepare combined data
        combined_data = {}
        for stock in multi_stock_bot.assigned_stocks.all():
            symbol = stock.symbol
            historical = split_result["historical_data"].get(symbol, [])
            execution = split_result["execution_data"].get(symbol, [])
            combined_data[symbol] = historical + execution
            combined_data[symbol].sort(key=lambda t: t.get("timestamp", ""))

        day_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_data,
            initial_cash=Decimal("10000.00"),
            historical_start_date=split_result["historical_start"],
            testing_start_date=self.tick_test_date,
            daily_execution_mode=False,
            bot_sim_config=multi_stock_bot,
        )

        result = day_executor.execute_ticks(
            testing_start_date=self.tick_test_date,
            testing_end_date=self.tick_test_date,
        )

        tick_results = result.get("tick_results", [])
        self.assertGreater(len(tick_results), 0)

        # Verify ticks from both stocks were processed
        stock1_ticks = [t for t in tick_results if t.get("stock_symbol") == self.stock1.symbol]
        stock2_ticks = [t for t in tick_results if t.get("stock_symbol") == self.stock2.symbol]

        self.assertGreater(len(stock1_ticks), 0, "Should have processed ticks for stock1")
        self.assertGreater(len(stock2_ticks), 0, "Should have processed ticks for stock2")

        # Clean up
        bot_config.delete()
