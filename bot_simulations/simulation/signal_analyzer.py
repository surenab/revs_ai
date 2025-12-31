"""
Signal productivity analyzer for simulation results.
"""

import logging
from collections import defaultdict
from typing import Any

from bot_simulations.models import BotSimulationConfig, BotSimulationDay

logger = logging.getLogger(__name__)


class SignalProductivityAnalyzer:
    """Analyze signal productivity and decision accuracy."""

    def __init__(self, simulation_config: BotSimulationConfig):
        """
        Initialize signal analyzer.

        Args:
            simulation_config: BotSimulationConfig instance
        """
        self.simulation_config = simulation_config

    def analyze(self) -> dict[str, Any]:
        """
        Analyze signal productivity for the simulation.
        Focuses on execution phase results (where actual trades are executed).

        Returns:
            Dictionary with signal productivity metrics
        """
        # Filter to only execution phase results (where trades are executed)
        daily_results = BotSimulationDay.objects.filter(
            simulation_config=self.simulation_config
        ).order_by("date")

        if not daily_results.exists():
            return {"error": "No simulation results found"}

        # Filter to execution phase only (where actual performance is measured)
        execution_results = [
            day
            for day in daily_results
            if day.performance_metrics.get("phase") == "execution"
        ]

        # If no phase info, assume all are execution results (backward compatibility)
        # Also check for "testing" for backward compatibility
        if not execution_results:
            testing_results = [
                day
                for day in daily_results
                if day.performance_metrics.get("phase") == "testing"
            ]
            execution_results = (
                testing_results if testing_results else list(daily_results)
            )

        # Aggregate signal statistics
        signal_stats = defaultdict(
            lambda: {
                "total_contributions": 0,
                "correct_decisions": 0,
                "incorrect_decisions": 0,
                "total_confidence": 0.0,
                "correct_confidence_sum": 0.0,
                "decisions": [],
            }
        )

        total_decisions = 0
        correct_decisions = 0

        for day_result in execution_results:
            decisions = day_result.decisions or {}
            signal_contributions = day_result.signal_contributions or {}

            for stock_symbol, decision in decisions.items():
                if decision.get("action") == "skip":
                    continue

                total_decisions += 1

                # Determine if decision was correct (profitable)
                is_correct = self._is_decision_correct(
                    day_result, stock_symbol, decision
                )

                if is_correct:
                    correct_decisions += 1

                # Analyze signal contributions for this decision
                stock_signals = signal_contributions.get(stock_symbol, {})
                self._analyze_signals_for_decision(
                    stock_signals, decision, is_correct, signal_stats
                )

        # Calculate metrics for each signal type
        signal_productivity = {}
        for signal_type, stats in signal_stats.items():
            accuracy = (
                (stats["correct_decisions"] / stats["total_contributions"] * 100)
                if stats["total_contributions"] > 0
                else 0.0
            )
            avg_confidence = (
                stats["total_confidence"] / stats["total_contributions"]
                if stats["total_contributions"] > 0
                else 0.0
            )
            correct_avg_confidence = (
                stats["correct_confidence_sum"] / stats["correct_decisions"]
                if stats["correct_decisions"] > 0
                else 0.0
            )

            signal_productivity[signal_type] = {
                "total_contributions": stats["total_contributions"],
                "correct_decisions": stats["correct_decisions"],
                "incorrect_decisions": stats["incorrect_decisions"],
                "accuracy": accuracy,
                "average_confidence": avg_confidence,
                "correct_decisions_avg_confidence": correct_avg_confidence,
                "contribution_rate": (
                    stats["total_contributions"] / total_decisions * 100
                    if total_decisions > 0
                    else 0.0
                ),
            }

        overall_accuracy = (
            (correct_decisions / total_decisions * 100) if total_decisions > 0 else 0.0
        )

        return {
            "total_decisions": total_decisions,
            "correct_decisions": correct_decisions,
            "overall_accuracy": overall_accuracy,
            "signal_productivity": signal_productivity,
        }

    def _is_decision_correct(
        self, day_result: BotSimulationDay, stock_symbol: str, decision: dict[str, Any]
    ) -> bool:
        """Determine if a decision was correct (profitable)."""
        action = decision.get("action")
        if action not in ["buy", "sell"]:
            return False

        # Get actual prices for this day and next day
        actual_prices = day_result.actual_prices or {}
        current_price = actual_prices.get(stock_symbol)

        if not current_price:
            return False

        # Get next day's price to determine if decision was profitable
        next_day_result = (
            BotSimulationDay.objects.filter(
                simulation_config=self.simulation_config,
                date__gt=day_result.date,
            )
            .order_by("date")
            .first()
        )

        if not next_day_result:
            # Can't determine without next day price
            return False

        next_day_prices = next_day_result.actual_prices or {}
        next_day_price = next_day_prices.get(stock_symbol)

        if not next_day_price:
            return False

        # Calculate price change
        price_change = next_day_price - current_price
        price_change_pct = (
            (price_change / current_price * 100) if current_price > 0 else 0
        )

        # Decision is correct if:
        # - Buy decision and price went up
        # - Sell decision and price went down (or we avoided a loss)
        if action == "buy":
            return price_change_pct > 0
        if action == "sell":
            return price_change_pct < 0

        return False

    def _analyze_signals_for_decision(
        self,
        stock_signals: dict[str, Any],
        decision: dict[str, Any],
        is_correct: bool,
        signal_stats: dict,
    ):
        """Analyze signal contributions for a decision."""
        decision_confidence = decision.get("confidence", 0.0)

        # ML signals
        ml_signals = stock_signals.get("ml_signals", [])
        for ml_signal in ml_signals:
            signal_type = f"ml_{ml_signal.get('model_id', 'unknown')}"
            stats = signal_stats[signal_type]
            stats["total_contributions"] += 1
            stats["total_confidence"] += ml_signal.get("confidence", 0.0)
            if is_correct:
                stats["correct_decisions"] += 1
                stats["correct_confidence_sum"] += ml_signal.get("confidence", 0.0)
            else:
                stats["incorrect_decisions"] += 1

        # Indicator signals
        indicator_count = stock_signals.get("indicator_signals", 0)
        if indicator_count > 0:
            stats = signal_stats["indicator"]
            stats["total_contributions"] += indicator_count
            stats["total_confidence"] += decision_confidence * indicator_count
            if is_correct:
                stats["correct_decisions"] += indicator_count
                stats["correct_confidence_sum"] += decision_confidence * indicator_count
            else:
                stats["incorrect_decisions"] += indicator_count

        # Pattern signals
        pattern_count = stock_signals.get("pattern_signals", 0)
        if pattern_count > 0:
            stats = signal_stats["pattern"]
            stats["total_contributions"] += pattern_count
            stats["total_confidence"] += decision_confidence * pattern_count
            if is_correct:
                stats["correct_decisions"] += pattern_count
                stats["correct_confidence_sum"] += decision_confidence * pattern_count
            else:
                stats["incorrect_decisions"] += pattern_count

        # Social signals
        if stock_signals.get("social_signals"):
            stats = signal_stats["social_media"]
            stats["total_contributions"] += 1
            social_confidence = stock_signals.get("social_signals", {}).get(
                "confidence", 0.0
            )
            stats["total_confidence"] += social_confidence
            if is_correct:
                stats["correct_decisions"] += 1
                stats["correct_confidence_sum"] += social_confidence
            else:
                stats["incorrect_decisions"] += 1

        # News signals
        if stock_signals.get("news_signals"):
            stats = signal_stats["news"]
            stats["total_contributions"] += 1
            news_confidence = stock_signals.get("news_signals", {}).get(
                "confidence", 0.0
            )
            stats["total_confidence"] += news_confidence
            if is_correct:
                stats["correct_decisions"] += 1
                stats["correct_confidence_sum"] += news_confidence
            else:
                stats["incorrect_decisions"] += 1
