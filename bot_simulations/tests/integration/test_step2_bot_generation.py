"""
Integration tests for Step 2: Bot generation from simulation configuration.
"""

import pytest
from decimal import Decimal
from django.test import TestCase

pytestmark = pytest.mark.integration

from bot_simulations.models import BotSimulationConfig
from bot_simulations.simulation.engine import SimulationEngine
from bot_simulations.tests.fixtures.factories import BotSimulationRunFactory
from bot_simulations.tests.integration.test_base import SimulationFlowTestBase


class TestStep2BotGeneration(SimulationFlowTestBase):
    """Test Step 2: Bot generation from simulation configuration."""

    def test_generate_bots_creates_correct_configs(self):
        """Test that bot generation creates correct configurations."""
        # Create simulation with config ranges that will generate multiple bots
        # Disable group combinations for this test to keep it simple
        config_ranges = {
            "signal_weights": {
                "indicator": [0.2, 0.3],
                "pattern": [0.1, 0.15],
            },
            "risk_params": {"risk_score_threshold": [70, 80]},
            "period_days": [14],
            "aggregation_methods": ["weighted_average"],
            # Limit to single indicator and pattern groups to avoid too many combinations
            "indicator_groups": ["moving_averages"],  # 1 group = 1 combination
            "pattern_groups": ["candlestick_patterns"],  # 1 group = 1 combination
        }

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1],
            config_ranges=config_ranges,
        )

        # Create engine and generate bots
        engine = SimulationEngine(simulation)
        bot_configs = engine._generate_bot_configs()

        # Verify bots were created
        self.assertGreater(len(bot_configs), 0)

        # Calculate expected number of bots
        # Signal weights: indicator [0.2, 0.3] (2) * pattern [0.1, 0.15] (2) = 4 combinations
        # Risk score threshold: [70, 80] = 2
        # Period days: [14] = 1
        # Aggregation methods: ["weighted_average"] = 1
        # Indicator groups: ["moving_averages"] = 1 combination
        # Pattern groups: ["candlestick_patterns"] = 1 combination
        # Parameter combinations = 4 * 2 * 1 * 1 * 1 * 1 = 8
        # Stock assignments: 1 stock = 1 assignment
        # use_social_analysis: False = 1
        # use_news_analysis: False = 1
        # Total: 8 * 1 * 1 * 1 = 8 bots
        expected_bots = 8
        self.assertEqual(len(bot_configs), expected_bots)
        self.assertEqual(BotSimulationConfig.objects.filter(simulation_run=simulation).count(), expected_bots)

        # Verify simulation.total_bots is updated
        simulation.refresh_from_db()
        self.assertEqual(simulation.total_bots, expected_bots)

        # Verify each bot has unique bot_index
        bot_indices = [bot.bot_index for bot in bot_configs]
        self.assertEqual(len(bot_indices), len(set(bot_indices)))

        # Verify all bots have correct simulation_run
        for bot_config in bot_configs:
            self.assertEqual(bot_config.simulation_run, simulation)

        # Verify we have all expected combinations
        # Check signal weight combinations
        signal_weight_combos = set()
        risk_thresholds = set()
        for bot_config in bot_configs:
            config_json = bot_config.config_json
            signal_weights = config_json.get("signal_weights", {})
            combo_key = (
                signal_weights.get("indicator"),
                signal_weights.get("pattern"),
            )
            signal_weight_combos.add(combo_key)
            risk_thresholds.add(config_json.get("risk_score_threshold"))

        # Should have 4 signal weight combinations: (0.2, 0.1), (0.2, 0.15), (0.3, 0.1), (0.3, 0.15)
        self.assertEqual(len(signal_weight_combos), 4, "Should have 4 signal weight combinations")
        self.assertIn((0.2, 0.1), signal_weight_combos)
        self.assertIn((0.2, 0.15), signal_weight_combos)
        self.assertIn((0.3, 0.1), signal_weight_combos)
        self.assertIn((0.3, 0.15), signal_weight_combos)

        # Should have 2 risk thresholds
        self.assertEqual(len(risk_thresholds), 2, "Should have 2 risk threshold values")
        self.assertIn(70, risk_thresholds)
        self.assertIn(80, risk_thresholds)

    def test_bot_configs_have_correct_parameters(self):
        """Test that generated bot configs have correct parameters."""
        config_ranges = {
            "signal_weights": {"indicator": [0.3], "pattern": [0.15]},
            "risk_params": {"risk_score_threshold": [80]},
            "period_days": [14],
            "aggregation_methods": ["weighted_average"],
            # Limit to single groups for testing
            "indicator_groups": ["moving_averages"],
            "pattern_groups": ["candlestick_patterns"],
        }

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1],
            config_ranges=config_ranges,
        )

        engine = SimulationEngine(simulation)
        bot_configs = engine._generate_bot_configs()

        # Verify each bot has correct parameters
        for bot_config in bot_configs:
            config_json = bot_config.config_json

            # Verify signal_weights
            self.assertIn("signal_weights", config_json)
            self.assertEqual(config_json["signal_weights"]["indicator"], 0.3)
            self.assertEqual(config_json["signal_weights"]["pattern"], 0.15)

            # Verify risk_score_threshold
            self.assertIn("risk_score_threshold", config_json)
            self.assertEqual(config_json["risk_score_threshold"], 80)

            # Verify period_days
            self.assertIn("period_days", config_json)
            self.assertEqual(config_json["period_days"], 14)

            # Verify aggregation method
            self.assertIn("signal_aggregation_method", config_json)
            self.assertEqual(config_json["signal_aggregation_method"], "weighted_average")

            # Verify enabled_indicators and enabled_patterns are set from groups
            self.assertIn("enabled_indicators", config_json)
            self.assertIsInstance(config_json["enabled_indicators"], dict)
            self.assertGreater(len(config_json["enabled_indicators"]), 0, "Should have indicators from groups")

            self.assertIn("enabled_patterns", config_json)
            self.assertIsInstance(config_json["enabled_patterns"], dict)
            self.assertGreater(len(config_json["enabled_patterns"]), 0, "Should have patterns from groups")

            # Verify indicator_groups and pattern_groups are stored
            self.assertIn("indicator_groups", config_json)
            self.assertIn("pattern_groups", config_json)

            # Verify assigned stocks
            self.assertEqual(bot_config.assigned_stocks.count(), 1)
            self.assertIn(self.stock1, bot_config.assigned_stocks.all())

    def test_bot_generation_with_different_stock_combinations(self):
        """Test bot generation with different stock assignment combinations."""
        config_ranges = {
            "signal_weights": {"indicator": [0.3]},
            "risk_params": {"risk_score_threshold": [80]},
            "period_days": [14],
            # Limit to single groups for testing
            "indicator_groups": ["moving_averages"],
            "pattern_groups": ["candlestick_patterns"],
        }

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1, self.stock2],
            config_ranges=config_ranges,
        )

        engine = SimulationEngine(simulation)
        bot_configs = engine._generate_bot_configs()

        # With 2 stocks, we should get:
        # - Single stock assignments: [stock1], [stock2] = 2
        # - Pairs: [stock1, stock2] = 1
        # Note: "All stocks together" is skipped for 2 stocks since pairs already covers it
        # Total: 3 stock assignments * 1 config = 3 bots
        expected_bots = 3
        self.assertEqual(len(bot_configs), expected_bots)

        # Verify we have single stock assignments
        single_stock_bots = [
            bot for bot in bot_configs if bot.assigned_stocks.count() == 1
        ]
        self.assertEqual(len(single_stock_bots), 2)

        # Verify we have all stocks assignment
        all_stocks_bots = [
            bot for bot in bot_configs if bot.assigned_stocks.count() == 2
        ]
        self.assertEqual(len(all_stocks_bots), 1)

    def test_bot_generation_updates_simulation_total_bots(self):
        """Test that bot generation updates simulation.total_bots correctly."""
        config_ranges = {
            "signal_weights": {"indicator": [0.2, 0.3]},
            "risk_params": {"risk_score_threshold": [70, 80, 90]},
            "period_days": [14],
            # Limit to single groups for testing
            "indicator_groups": ["moving_averages"],
            "pattern_groups": ["candlestick_patterns"],
        }

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1],
            config_ranges=config_ranges,
        )

        # Initially total_bots should be 0
        self.assertEqual(simulation.total_bots, 0)

        # Generate bots
        engine = SimulationEngine(simulation)
        bot_configs = engine._generate_bot_configs()

        # Verify total_bots is updated
        simulation.refresh_from_db()
        expected_count = len(bot_configs)
        self.assertEqual(simulation.total_bots, expected_count)
        self.assertEqual(
            BotSimulationConfig.objects.filter(simulation_run=simulation).count(),
            expected_count,
        )

    def test_bot_generation_with_indicator_pattern_groups(self):
        """Test that bot generation creates configs with indicator and pattern groups."""
        # Test with multiple indicator and pattern groups
        config_ranges = {
            "signal_weights": {"indicator": [0.3]},
            "risk_params": {"risk_score_threshold": [80]},
            "period_days": [14],
            # Use 2 indicator groups and 2 pattern groups
            "indicator_groups": ["moving_averages", "oscillators"],  # 2 groups = 3 combinations (1, 2, both)
            "pattern_groups": ["candlestick_patterns", "chart_patterns"],  # 2 groups = 3 combinations
        }

        simulation = BotSimulationRunFactory.create(
            user=self.user,
            execution_start_date=self.execution_start,
            execution_end_date=self.execution_end,
            stocks=[self.stock1],
            config_ranges=config_ranges,
        )

        engine = SimulationEngine(simulation)
        bot_configs = engine._generate_bot_configs()

        # Should have: 1 signal * 1 risk * 1 period * 3 indicator combos * 3 pattern combos * 1 stock = 9 bots
        expected_bots = 9
        self.assertEqual(len(bot_configs), expected_bots)

        # Verify each bot has enabled_indicators and enabled_patterns
        indicator_group_combos = set()
        pattern_group_combos = set()
        for bot_config in bot_configs:
            config_json = bot_config.config_json

            # Verify enabled_indicators and enabled_patterns exist
            self.assertIn("enabled_indicators", config_json)
            self.assertIn("enabled_patterns", config_json)
            self.assertGreater(len(config_json["enabled_indicators"]), 0)
            self.assertGreater(len(config_json["enabled_patterns"]), 0)

            # Track group combinations
            indicator_groups = tuple(sorted(config_json.get("indicator_groups", [])))
            pattern_groups = tuple(sorted(config_json.get("pattern_groups", [])))
            indicator_group_combos.add(indicator_groups)
            pattern_group_combos.add(pattern_groups)

        # Should have 3 indicator group combinations: (moving_averages,), (oscillators,), (moving_averages, oscillators)
        self.assertEqual(len(indicator_group_combos), 3)
        # Should have 3 pattern group combinations
        self.assertEqual(len(pattern_group_combos), 3)
