"""
Parameter generator for creating bot configurations using grid search.
"""

import itertools
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Indicator groups mapping
INDICATOR_GROUPS = {
    "moving_averages": {
        "sma": {"period": 20},
        "ema": {"period": 20},
        "wma": {"period": 20},
        "dema": {"period": 20},
        "tema": {"period": 20},
        "tma": {"period": 20},
        "hma": {"period": 20},
        "mcginley": {"period": 14},
        "vwap_ma": {"period": 20},
    },
    "bands_channels": {
        "bollinger": {"period": 20},
        "keltner": {"period": 20, "multiplier": 2.0},
        "donchian": {"period": 20},
        "fractal": {"period": 5},
    },
    "oscillators": {
        "rsi": {"period": 14},
        "adx": {"period": 14},
        "cci": {"period": 20},
        "mfi": {"period": 14},
        "macd": {"fast_period": 12, "slow_period": 26, "signal_period": 9},
        "williams_r": {"period": 14},
        "momentum": {"period": 10},
        "proc": {"period": 12},
        "stochastic": {"k_period": 14, "d_period": 3},
    },
    "trend_indicators": {
        "psar": {"acceleration": 0.02, "maximum": 0.20},
        "supertrend": {"period": 10, "multiplier": 3.0},
        "alligator": {"jaw_period": 13, "teeth_period": 8, "lips_period": 5},
        "ichimoku": {"tenkan_period": 9, "kijun_period": 26, "senkou_b_period": 52},
    },
    "volatility": {
        "atr": {"period": 14},
        "atr_trailing": {"period": 14, "multiplier": 2.0},
    },
    "volume": {
        "vwap": {},
        "obv": {},
    },
    "others": {
        "linear_regression": {"period": 14},
        "pivot_points": {},
    },
}

# Pattern groups mapping
PATTERN_GROUPS = {
    "candlestick_patterns": {
        "three_white_soldiers": {"min_confidence": 0.5},
        "morning_doji_star": {"min_confidence": 0.5},
        "morning_star": {"min_confidence": 0.5},
        "abandoned_baby": {"min_confidence": 0.5},
        "conceal_baby_swallow": {"min_confidence": 0.5},
        "stick_sandwich": {"min_confidence": 0.5},
        "kicking": {"min_confidence": 0.5},
        "engulfing": {"min_confidence": 0.5},
        "bullish_engulfing": {"min_confidence": 0.5},
        "bearish_engulfing": {"min_confidence": 0.5},
        "homing_pigeon": {"min_confidence": 0.5},
        "advance_block": {"min_confidence": 0.5},
        "tri_star": {"min_confidence": 0.5},
        "spinning_top": {"min_confidence": 0.5},
    },
    "chart_patterns": {
        "head_and_shoulders": {"min_confidence": 0.5},
        "double_top": {"min_confidence": 0.5},
        "double_bottom": {"min_confidence": 0.5},
        "flag": {"min_confidence": 0.5},
        "pennant": {"min_confidence": 0.5},
        "wedge": {"min_confidence": 0.5},
        "rising_wedge": {"min_confidence": 0.5},
        "falling_wedge": {"min_confidence": 0.5},
    },
    "regime_detection_patterns": {
        "trending_regime": {"min_confidence": 0.5},
        "ranging_regime": {"min_confidence": 0.5},
        "volatile_regime": {"min_confidence": 0.5},
        "regime_transition": {"min_confidence": 0.5},
    },
}


class ParameterGenerator:
    """Generate bot configurations using grid search over parameter ranges."""

    def __init__(self, config_ranges: dict[str, Any]):
        """
        Initialize parameter generator.

        Args:
            config_ranges: Dictionary with parameter ranges for grid search
                Example:
                {
                    "signal_weights": {
                        "ml": [0.3, 0.4, 0.5],
                        "indicators": [0.2, 0.3, 0.4],
                        "patterns": [0.1, 0.15, 0.2],
                    },
                    "risk_score_threshold": [70, 80, 90],
                    "period_days": [14, 21, 28],
                }
        """
        self.config_ranges = config_ranges

    def generate_configs(
        self,
        stocks: list[dict],
        use_social_analysis: bool | list[bool] = False,
        use_news_analysis: bool | list[bool] = False,
        max_configs: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Generate all bot configurations using grid search.

        Args:
            stocks: List of stock dictionaries with 'id' and 'symbol'
            use_social_analysis: Boolean or list of booleans for social analysis
            use_news_analysis: Boolean or list of booleans for news analysis
            max_configs: Maximum number of configs to generate (None = all)

        Returns:
            List of bot configuration dictionaries
        """
        # Normalize boolean parameters to lists if they're single values
        if isinstance(use_social_analysis, bool):
            social_analysis_values = [use_social_analysis]
        else:
            social_analysis_values = use_social_analysis

        if isinstance(use_news_analysis, bool):
            news_analysis_values = [use_news_analysis]
        else:
            news_analysis_values = use_news_analysis

        # Generate parameter combinations
        param_combinations = self._generate_combinations()

        # Generate stock assignments
        stock_assignments = self._generate_stock_assignments(stocks)

        # Combine parameter combinations with stock assignments and boolean flags
        configs = []
        config_index = 0

        for param_combo in param_combinations:
            for stock_assignment in stock_assignments:
                for use_social in social_analysis_values:
                    for use_news in news_analysis_values:
                        config = {
                            "bot_index": config_index,
                            "config_json": {
                                **param_combo,
                                "assigned_stocks": stock_assignment,
                                "use_social_analysis": use_social,
                                "use_news_analysis": use_news,
                            },
                            "assigned_stocks": stock_assignment,
                            "use_social_analysis": use_social,
                            "use_news_analysis": use_news,
                        }
                        configs.append(config)
                        config_index += 1

        # Limit if specified
        if max_configs and len(configs) > max_configs:
            logger.warning(
                f"Limiting configurations from {len(configs)} to {max_configs}"
            )
            configs = configs[:max_configs]

        logger.info(f"Generated {len(configs)} bot configurations")
        return configs

    def _generate_combinations(self) -> list[dict[str, Any]]:
        """Generate all parameter combinations using grid search."""
        # Extract parameter ranges
        signal_weights_ranges = self.config_ranges.get("signal_weights", {})
        ml_model_weights_ranges = self.config_ranges.get("ml_model_weights", {})
        risk_params = self.config_ranges.get("risk_params", {})
        aggregation_methods = self.config_ranges.get(
            "aggregation_methods", ["weighted_average"]
        )
        period_days_range = self.config_ranges.get("period_days", [14])
        stop_loss_range = self.config_ranges.get("stop_loss_percent", [None])
        take_profit_range = self.config_ranges.get("take_profit_percent", [None])
        risk_adjustment_factor_range = self.config_ranges.get(
            "risk_adjustment_factor", [0.4]
        )
        # Signal persistence parameters
        persistence_type_range = self.config_ranges.get(
            "signal_persistence_type", [None]
        )
        persistence_value_range = self.config_ranges.get(
            "signal_persistence_value", [None]
        )

        # Generate indicator and pattern group combinations
        indicator_group_combos = self._generate_indicator_group_combinations()
        pattern_group_combos = self._generate_pattern_group_combinations()

        # Generate signal weight combinations
        signal_weight_keys = list(signal_weights_ranges.keys())
        signal_weight_values = [
            signal_weights_ranges[key] for key in signal_weight_keys
        ]

        combinations = []

        # Iterate over all combinations
        for signal_weights_combo in itertools.product(*signal_weight_values):
            signal_weights = dict(
                zip(signal_weight_keys, signal_weights_combo, strict=False)
            )

            for ml_weights in self._generate_ml_weights_combinations(
                ml_model_weights_ranges
            ):
                for risk_score_threshold in risk_params.get(
                    "risk_score_threshold", [80]
                ):
                    for aggregation_method in aggregation_methods:
                        for period_days in period_days_range:
                            for stop_loss in stop_loss_range:
                                for take_profit in take_profit_range:
                                    for (
                                        risk_adjustment_factor
                                    ) in risk_adjustment_factor_range:
                                        for persistence_type in persistence_type_range:
                                            for (
                                                persistence_value
                                            ) in persistence_value_range:
                                                # Only include persistence_value if persistence_type is set
                                                if (
                                                    persistence_type
                                                    and not persistence_value
                                                ):
                                                    continue
                                                if (
                                                    not persistence_type
                                                    and persistence_value
                                                ):
                                                    continue
                                                # Combine with indicator and pattern group combinations
                                                for (
                                                    indicator_groups
                                                ) in indicator_group_combos:
                                                    for (
                                                        pattern_groups
                                                    ) in pattern_group_combos:
                                                        combo = {
                                                            "signal_weights": signal_weights,
                                                            "ml_model_weights": ml_weights,
                                                            "risk_score_threshold": risk_score_threshold,
                                                            "signal_aggregation_method": aggregation_method,
                                                            "period_days": period_days,
                                                            "stop_loss_percent": stop_loss,
                                                            "take_profit_percent": take_profit,
                                                            "risk_adjustment_factor": risk_adjustment_factor,
                                                            "risk_based_position_scaling": risk_params.get(
                                                                "risk_based_position_scaling",
                                                                True,
                                                            ),
                                                            "enabled_indicators": self._get_indicators_from_groups(
                                                                indicator_groups
                                                            ),
                                                            "enabled_patterns": self._get_patterns_from_groups(
                                                                pattern_groups
                                                            ),
                                                            "indicator_groups": indicator_groups,  # Store for reference
                                                            "pattern_groups": pattern_groups,  # Store for reference
                                                            "signal_persistence_type": persistence_type,
                                                            "signal_persistence_value": persistence_value,
                                                        }
                                                        combinations.append(combo)

        return combinations

    def _generate_indicator_group_combinations(self) -> list[list[str]]:
        """
        Generate indicator group combinations.
        Only generates: single groups (one at a time) and all groups together.
        """
        group_names = list(INDICATOR_GROUPS.keys())
        combinations = []

        # If no groups specified in config, use all available groups
        indicator_groups_config = self.config_ranges.get("indicator_groups")
        if indicator_groups_config is not None:
            if isinstance(indicator_groups_config, list):
                # If it's a list of group names, use those
                specified_groups = [
                    g for g in indicator_groups_config if g in INDICATOR_GROUPS
                ]
                if specified_groups:
                    group_names = specified_groups
            elif indicator_groups_config == "all":
                # Use all groups (already set above)
                pass
            else:
                # Single group or invalid, use default
                pass

        if not group_names:
            return [[]]  # Return at least empty list

        # Generate only: single groups and all groups together
        # 1. Single groups (one indicator group at a time)
        combinations.extend([[group] for group in group_names])

        # 2. All groups together (if more than one group exists)
        if len(group_names) > 1:
            combinations.append(group_names)

        return combinations if combinations else [[]]  # Return at least empty list

    def _generate_pattern_group_combinations(self) -> list[list[str]]:
        """
        Generate all combinations of pattern groups.
        Returns combinations from single group to all groups.
        """
        group_names = list(PATTERN_GROUPS.keys())
        combinations = []

        # Generate combinations from 1 group to all groups
        combinations.extend(
            [
                list(combo)
                for r in range(1, len(group_names) + 1)
                for combo in itertools.combinations(group_names, r)
            ]
        )

        # If no groups specified in config, return all combinations
        # Otherwise, use specified groups from config
        pattern_groups_config = self.config_ranges.get("pattern_groups")
        if pattern_groups_config is not None:
            # Use specified groups only
            if isinstance(pattern_groups_config, list):
                # If it's a list of group names, use those
                specified_groups = [
                    g for g in pattern_groups_config if g in PATTERN_GROUPS
                ]
                if specified_groups:
                    combinations = []
                    for r in range(1, len(specified_groups) + 1):
                        for combo in itertools.combinations(specified_groups, r):
                            combinations.append(list(combo))
            elif pattern_groups_config == "all":
                # Use all groups (already done above)
                pass
            else:
                # Single group or invalid, use default (all combinations)
                pass
        else:
            # Default: generate all combinations
            pass

        return combinations if combinations else [[]]  # Return at least empty list

    @staticmethod
    def _get_indicators_from_groups(group_names: list[str]) -> dict[str, dict]:
        """
        Get enabled indicators from selected groups.

        Args:
            group_names: List of indicator group names

        Returns:
            Dictionary of enabled indicators with their configurations
        """
        enabled_indicators = {}
        for group_name in group_names:
            if group_name in INDICATOR_GROUPS:
                enabled_indicators.update(INDICATOR_GROUPS[group_name])
        return enabled_indicators

    @staticmethod
    def _get_patterns_from_groups(group_names: list[str]) -> dict[str, dict]:
        """
        Get enabled patterns from selected groups.

        Args:
            group_names: List of pattern group names

        Returns:
            Dictionary of enabled patterns with their configurations
        """
        enabled_patterns = {}
        for group_name in group_names:
            if group_name in PATTERN_GROUPS:
                enabled_patterns.update(PATTERN_GROUPS[group_name])
        return enabled_patterns

    def _generate_ml_weights_combinations(
        self, ml_model_weights_ranges: dict[str, list]
    ) -> list[dict[str, float]]:
        """Generate ML model weight combinations."""
        if not ml_model_weights_ranges:
            return [{}]

        model_ids = list(ml_model_weights_ranges.keys())
        weight_values = [ml_model_weights_ranges[model_id] for model_id in model_ids]

        combinations = []
        for weights_combo in itertools.product(*weight_values):
            ml_weights = dict(zip(model_ids, weights_combo, strict=False))
            combinations.append(ml_weights)

        return combinations if combinations else [{}]

    def _generate_stock_assignments(self, stocks: list[dict]) -> list[list[dict]]:
        """
        Generate stock assignment combinations.

        Returns:
            List of stock assignment lists:
            - Single stock assignments: [[stock1], [stock2], ...]
            - Multiple stock assignments: [[stock1, stock2], [stock1, stock3], ...]
        """
        if not stocks:
            return [[]]

        assignments = []

        # Single stock assignments
        assignments.extend([[stock] for stock in stocks])

        # Multiple stock assignments (all combinations of 2+ stocks, up to all stocks)
        if len(stocks) > 1:
            # Pairs of stocks
            if len(stocks) >= 2:
                assignments.extend(
                    [
                        [stocks[i], stocks[j]]
                        for i in range(len(stocks))
                        for j in range(i + 1, len(stocks))
                    ]
                )

            # All stocks together (only if more than 2 stocks, since pairs already covers 2-stock case)
            if len(stocks) > 2:
                assignments.append(stocks)

        return assignments

    @staticmethod
    def get_default_ranges() -> dict[str, Any]:
        """
        Get default parameter ranges for grid search.

        By default, generates all combinations of indicator and pattern groups.
        To limit groups, specify 'indicator_groups' and 'pattern_groups' in config_ranges.
        """
        return {
            "signal_weights": {
                "indicator": [0.2, 0.3, 0.4],
                "pattern": [0.1, 0.15, 0.2],
            },
            "ml_model_weights": {},  # Empty means use default weights
            "risk_params": {
                "risk_score_threshold": [70, 80, 90],
                "risk_based_position_scaling": [True, False],
            },
            "aggregation_methods": ["weighted_average", "ensemble_voting"],
            "period_days": [14, 21, 28],
            "stop_loss_percent": [None, 5, 10],
            "take_profit_percent": [None, 10, 20],
            "risk_adjustment_factor": [0.3, 0.4, 0.5],
            # Signal persistence parameters
            "signal_persistence_type": [None, "tick_count", "time_duration"],
            "signal_persistence_value": [None, 3, 5, 10],  # N ticks or M minutes
            # Indicator and pattern groups: None means generate all combinations
            # Can specify specific groups: ["moving_averages", "oscillators"]
            # Or "all" to explicitly use all groups
            "indicator_groups": None,  # None = all combinations
            "pattern_groups": None,  # None = all combinations
        }

    @staticmethod
    def get_indicator_groups() -> dict[str, dict]:
        """Get all available indicator groups."""
        return INDICATOR_GROUPS.copy()

    @staticmethod
    def get_pattern_groups() -> dict[str, dict]:
        """Get all available pattern groups."""
        return PATTERN_GROUPS.copy()
