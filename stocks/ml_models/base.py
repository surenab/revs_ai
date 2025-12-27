"""
Base ML Model Interface
Abstract base class for all ML models used in trading bot.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseMLModel(ABC):
    """Abstract base class for ML models."""

    def __init__(self, model_id: str, name: str, model_type: str, framework: str):
        """
        Initialize ML model.

        Args:
            model_id: Unique model identifier
            name: Model name
            model_type: Type of model (classification/regression)
            framework: ML framework used
        """
        self.model_id = model_id
        self.name = name
        self.model_type = model_type
        self.framework = framework
        self._model = None

    @abstractmethod
    def predict(
        self, stock, price_data: list[dict], indicators: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Make prediction for a stock.

        Args:
            stock: Stock instance
            price_data: List of price data dictionaries (OHLCV)
            indicators: Dictionary of calculated indicators (optional)

        Returns:
            Dictionary with:
                - action: "buy", "sell", or "hold"
                - confidence: float (0-1)
                - predicted_gain: float (percentage or absolute)
                - predicted_loss: float (percentage or absolute)
                - metadata: dict with additional info
        """

    @abstractmethod
    def load_model(self) -> None:
        """Load model from storage."""

    @abstractmethod
    def get_required_features(self) -> list[str]:
        """
        Get list of required features for this model.

        Returns:
            List of feature names required by the model
        """

    def get_metadata(self) -> dict[str, Any]:
        """
        Get model metadata.

        Returns:
            Dictionary with model metadata
        """
        return {
            "model_id": self.model_id,
            "name": self.name,
            "model_type": self.model_type,
            "framework": self.framework,
            "required_features": self.get_required_features(),
        }
