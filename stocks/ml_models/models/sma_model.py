"""
Simple Moving Average Model
Basic SMA-based prediction model.
"""

import uuid
from typing import Any

from stocks import indicators as indicators_module
from stocks.ml_models.base import BaseMLModel


class SimpleMovingAverageModel(BaseMLModel):
    """SMA-based prediction model."""

    def __init__(self, period: int = 20):
        super().__init__(
            model_id=str(uuid.uuid4()),
            name="SMA Prediction Model",
            model_type="classification",
            framework="custom",
        )
        self.period = period

    def predict(
        self, stock, price_data: list[dict], indicators: dict[str, Any] | None = None
    ) -> dict:
        """
        Make prediction based on SMA crossover.

        Args:
            stock: Stock instance
            price_data: List of price data dictionaries
            indicators: Dictionary of calculated indicators

        Returns:
            Prediction dictionary
        """
        if not price_data or len(price_data) < self.period + 1:
            return {
                "action": "hold",
                "confidence": 0.0,
                "predicted_gain": 0.0,
                "predicted_loss": 0.0,
                "metadata": {"reason": "Insufficient data"},
            }

        # Calculate SMA
        sma_values = indicators_module.calculate_sma(price_data, self.period)

        if not sma_values or sma_values[-1] is None:
            return {
                "action": "hold",
                "confidence": 0.0,
                "predicted_gain": 0.0,
                "predicted_loss": 0.0,
                "metadata": {"reason": "Could not calculate SMA"},
            }

        # Get current price and SMA
        current_price = float(price_data[-1].get("close_price", 0))
        current_sma = sma_values[-1]
        previous_sma = (
            sma_values[-2]
            if len(sma_values) > 1 and sma_values[-2] is not None
            else current_sma
        )

        # Determine action based on price vs SMA and SMA trend
        price_above_sma = current_price > current_sma
        sma_rising = current_sma > previous_sma

        if price_above_sma and sma_rising:
            action = "buy"
            confidence = 0.7
            predicted_gain = 0.05  # 5% potential gain
            predicted_loss = 0.02  # 2% potential loss
        elif not price_above_sma and not sma_rising:
            action = "sell"
            confidence = 0.7
            predicted_gain = 0.0
            predicted_loss = 0.03  # 3% potential loss
        else:
            action = "hold"
            confidence = 0.5
            predicted_gain = 0.0
            predicted_loss = 0.0

        return {
            "action": action,
            "confidence": confidence,
            "predicted_gain": predicted_gain,
            "predicted_loss": predicted_loss,
            "metadata": {
                "model_name": self.name,
                "current_price": current_price,
                "sma": current_sma,
                "price_above_sma": price_above_sma,
                "sma_rising": sma_rising,
            },
        }

    def load_model(self) -> None:
        """SMA model doesn't need to load anything."""

    def get_required_features(self) -> list[str]:
        """SMA model requires price data."""
        return ["close_price"]
