"""
RSI Model
RSI-based classification model.
"""

import uuid
from typing import Any

from stocks import indicators as indicators_module
from stocks.ml_models.base import BaseMLModel


class RSIModel(BaseMLModel):
    """RSI-based prediction model."""

    def __init__(
        self, period: int = 14, oversold: float = 30.0, overbought: float = 70.0
    ):
        super().__init__(
            model_id=str(uuid.uuid4()),
            name="RSI Prediction Model",
            model_type="classification",
            framework="custom",
        )
        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def predict(
        self, stock, price_data: list[dict], indicators: dict[str, Any] | None = None
    ) -> dict:
        """
        Make prediction based on RSI.

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

        # Calculate RSI
        rsi_values = indicators_module.calculate_rsi(price_data, self.period)

        if not rsi_values or rsi_values[-1] is None:
            return {
                "action": "hold",
                "confidence": 0.0,
                "predicted_gain": 0.0,
                "predicted_loss": 0.0,
                "metadata": {"reason": "Could not calculate RSI"},
            }

        current_rsi = rsi_values[-1]
        previous_rsi = (
            rsi_values[-2]
            if len(rsi_values) > 1 and rsi_values[-2] is not None
            else current_rsi
        )

        # Determine action based on RSI levels
        if current_rsi < self.oversold:
            # Oversold - potential buy signal
            action = "buy"
            confidence = min(
                0.9, 0.6 + (self.oversold - current_rsi) / self.oversold * 0.3
            )
            predicted_gain = 0.06  # 6% potential gain
            predicted_loss = 0.02  # 2% potential loss
        elif current_rsi > self.overbought:
            # Overbought - potential sell signal
            action = "sell"
            confidence = min(
                0.9,
                0.6 + (current_rsi - self.overbought) / (100 - self.overbought) * 0.3,
            )
            predicted_gain = 0.0
            predicted_loss = 0.04  # 4% potential loss
        elif current_rsi > previous_rsi and current_rsi < 50:
            # RSI rising from oversold - buy signal
            action = "buy"
            confidence = 0.65
            predicted_gain = 0.04
            predicted_loss = 0.02
        elif current_rsi < previous_rsi and current_rsi > 50:
            # RSI falling from overbought - sell signal
            action = "sell"
            confidence = 0.65
            predicted_gain = 0.0
            predicted_loss = 0.03
        else:
            action = "hold"
            confidence = 0.5
            predicted_gain = 0.0
            predicted_loss = 0.0

        return {
            "action": action,
            "confidence": round(confidence, 2),
            "predicted_gain": predicted_gain,
            "predicted_loss": predicted_loss,
            "metadata": {
                "model_name": self.name,
                "current_rsi": current_rsi,
                "previous_rsi": previous_rsi,
                "oversold": self.oversold,
                "overbought": self.overbought,
            },
        }

    def load_model(self) -> None:
        """RSI model doesn't need to load anything."""

    def get_required_features(self) -> list[str]:
        """RSI model requires price data."""
        return ["close_price"]
