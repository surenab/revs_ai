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

        return {
            "action": action,
            "confidence": round(random.uniform(0.5, 0.95), 2),
            "predicted_gain": round(random.uniform(0.0, 0.10), 4)
            if action == "buy"
            else 0.0,
            "predicted_loss": round(random.uniform(0.0, 0.05), 4)
            if action == "buy"
            else 0.0,
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
