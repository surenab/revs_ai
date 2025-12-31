"""
Validator for comparing simulation results with validation data.
"""

import logging
from typing import Any

from bot_simulations.models import BotSimulationConfig, BotSimulationDay

logger = logging.getLogger(__name__)


class ValidationComparator:
    """Compare simulation predictions with validation data."""

    def __init__(
        self,
        simulation_config: BotSimulationConfig,
        validation_data: dict[str, list[dict]],
    ):
        """
        Initialize validation comparator.

        Args:
            simulation_config: BotSimulationConfig instance
            validation_data: Dictionary mapping stock symbols to validation tick data
        """
        self.simulation_config = simulation_config
        self.validation_data = validation_data

    def compare(self) -> dict[str, Any]:
        """
        Compare simulation results with validation data.

        Returns:
            Dictionary with comparison results
        """
        # Get daily results from simulation
        daily_results = BotSimulationDay.objects.filter(
            simulation_config=self.simulation_config
        ).order_by("date")

        if not daily_results.exists():
            return {"error": "No simulation results found"}

        # Get validation dates
        validation_dates = self._get_validation_dates()

        # Compare predictions with actual outcomes
        comparisons = []
        correct_predictions = 0
        total_predictions = 0

        for day_result in daily_results:
            day_date = day_result.date
            if day_date not in validation_dates:
                continue

            comparison = self._compare_day(day_result, day_date)
            comparisons.append(comparison)

            if comparison.get("prediction_correct"):
                correct_predictions += 1
            total_predictions += 1

        accuracy = (
            (correct_predictions / total_predictions * 100)
            if total_predictions > 0
            else 0.0
        )

        return {
            "total_comparisons": len(comparisons),
            "correct_predictions": correct_predictions,
            "total_predictions": total_predictions,
            "accuracy": accuracy,
            "comparisons": comparisons,
        }

    def _get_validation_dates(self) -> set:
        """Get set of dates in validation data."""
        dates = set()
        for stock_data in self.validation_data.values():
            for tick in stock_data:
                if tick.get("date"):
                    dates.add(tick["date"])
        return dates

    def _compare_day(self, day_result: BotSimulationDay, day_date) -> dict[str, Any]:
        """Compare predictions for a single day with actual outcomes."""
        decisions = day_result.decisions or {}
        actual_prices = day_result.actual_prices or {}

        # Get actual prices from validation data
        validation_prices = self._get_validation_prices(day_date)

        day_comparisons = {}
        correct_count = 0
        total_count = 0

        for stock_symbol, decision in decisions.items():
            if decision.get("action") == "skip":
                continue

            predicted_action = decision.get("action")
            actual_price_today = validation_prices.get(stock_symbol)
            predicted_price = actual_prices.get(stock_symbol)

            if not actual_price_today or not predicted_price:
                continue

            # Get next day price to determine if prediction was correct
            next_day_price = self._get_next_day_price(stock_symbol, day_date)

            if next_day_price:
                price_change = next_day_price - actual_price_today
                price_change_pct = (
                    (price_change / actual_price_today * 100)
                    if actual_price_today > 0
                    else 0
                )

                # Determine if prediction was correct
                prediction_correct = False
                if (
                    (predicted_action == "buy" and price_change_pct > 0)
                    or (predicted_action == "sell" and price_change_pct < 0)
                    or (predicted_action == "hold" and abs(price_change_pct) < 1.0)
                ):
                    prediction_correct = True

                day_comparisons[stock_symbol] = {
                    "predicted_action": predicted_action,
                    "actual_price": float(actual_price_today),
                    "next_day_price": float(next_day_price),
                    "price_change": float(price_change),
                    "price_change_pct": float(price_change_pct),
                    "prediction_correct": prediction_correct,
                    "confidence": decision.get("confidence", 0.0),
                }

                if prediction_correct:
                    correct_count += 1
                total_count += 1

        return {
            "date": day_date.isoformat()
            if hasattr(day_date, "isoformat")
            else str(day_date),
            "stock_comparisons": day_comparisons,
            "correct_predictions": correct_count,
            "total_predictions": total_count,
            "prediction_correct": correct_count > 0 and correct_count == total_count,
        }

    def _get_validation_prices(self, day_date) -> dict[str, float]:
        """Get actual prices from validation data for a given date."""
        prices = {}
        date_str = (
            day_date.isoformat() if hasattr(day_date, "isoformat") else str(day_date)
        )

        for stock_symbol, tick_data in self.validation_data.items():
            day_ticks = [tick for tick in tick_data if tick.get("date") == date_str]
            if day_ticks:
                # Use last tick of the day
                last_tick = sorted(day_ticks, key=lambda t: t.get("timestamp", ""))[-1]
                prices[stock_symbol] = last_tick.get("price", 0.0)

        return prices

    def _get_next_day_price(self, stock_symbol: str, current_date) -> float | None:
        """Get price for the next trading day."""
        date_str = (
            current_date.isoformat()
            if hasattr(current_date, "isoformat")
            else str(current_date)
        )

        tick_data = self.validation_data.get(stock_symbol, [])
        if not tick_data:
            return None

        # Get all dates and find next one
        dates = sorted({tick.get("date") for tick in tick_data if tick.get("date")})
        try:
            current_idx = dates.index(date_str)
            if current_idx + 1 < len(dates):
                next_date = dates[current_idx + 1]
                next_day_ticks = [
                    tick for tick in tick_data if tick.get("date") == next_date
                ]
                if next_day_ticks:
                    last_tick = sorted(
                        next_day_ticks, key=lambda t: t.get("timestamp", "")
                    )[-1]
                    return last_tick.get("price")
        except (ValueError, IndexError):
            pass

        return None
