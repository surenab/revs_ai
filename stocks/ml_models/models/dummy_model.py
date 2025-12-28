"""
Dummy ML Model
Placeholder model that returns random predictions for testing.
"""

import random
import uuid

from stocks.ml_models.base import BaseMLModel


class DummyMLModel(BaseMLModel):
    """Dummy ML model for testing."""

    def __init__(self):
        super().__init__(
            model_id=str(uuid.uuid4()),
            name="Dummy ML Model",
            model_type="classification",
            framework="custom",
        )

    def predict(
        self, stock, price_data: list[dict], indicators: dict | None = None
    ) -> dict:
        """
        Make random prediction.

        Args:
            stock: Stock instance
            price_data: List of price data dictionaries
            indicators: Dictionary of calculated indicators

        Returns:
            Random prediction dictionary
        """
        actions = ["buy", "sell", "hold"]
        action = random.choice(actions)
        confidence = round(random.uniform(0.5, 0.95), 2)

        predicted_gain = round(random.uniform(0.0, 0.10), 4) if action == "buy" else 0.0
        predicted_loss = round(random.uniform(0.0, 0.05), 4) if action == "buy" else 0.0

        # Calculate probabilities based on confidence
        gain_probability = round(confidence * 0.7, 4) if action == "buy" else 0.0
        loss_probability = (
            round((1.0 - confidence) * 0.3, 4) if action == "buy" else 0.0
        )

        # Timeframe prediction
        timeframes = ["1d", "3d", "5d", "7d", "10d"]
        timeframe_prediction = {
            "min_timeframe": random.choice(["1d", "2d", "3d"]),
            "max_timeframe": random.choice(["5d", "7d", "10d"]),
            "expected_timeframe": random.choice(timeframes),
            "timeframe_confidence": round(confidence * 0.8, 4),
        }

        # Scenario analysis
        consequences = {}
        if action == "buy":
            consequences = {
                "best_case": {
                    "gain": round(predicted_gain * 1.5, 4),
                    "probability": round(gain_probability * 0.8, 4),
                    "timeframe": timeframe_prediction["min_timeframe"],
                },
                "base_case": {
                    "gain": round(predicted_gain, 4),
                    "probability": round(gain_probability, 4),
                    "timeframe": timeframe_prediction["expected_timeframe"],
                },
                "worst_case": {
                    "loss": round(predicted_loss, 4),
                    "probability": round(loss_probability, 4),
                    "timeframe": timeframe_prediction["max_timeframe"],
                },
            }

        return {
            "action": action,
            "confidence": confidence,
            "predicted_gain": predicted_gain,
            "predicted_loss": predicted_loss,
            "gain_probability": gain_probability,
            "loss_probability": loss_probability,
            "timeframe_prediction": timeframe_prediction,
            "consequences": consequences,
            "metadata": {
                "model_name": self.name,
                "random_seed": random.randint(1, 1000),
            },
        }

    def load_model(self) -> None:
        """Dummy model doesn't need to load anything."""

    def get_required_features(self) -> list[str]:
        """Dummy model doesn't require any features."""
        return []
