"""
ML Model Registry
Singleton to manage registered ML models.
"""

import logging
from typing import Any

from stocks.ml_models.base import BaseMLModel
from stocks.models import MLModel

logger = logging.getLogger(__name__)


class MLModelRegistry:
    """Singleton registry for managing ML models."""

    _instance = None
    _models: dict[str, BaseMLModel] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register_model(self, model: BaseMLModel) -> None:
        """
        Register an ML model.

        Args:
            model: BaseMLModel instance
        """
        self._models[model.model_id] = model
        logger.info(f"Registered ML model: {model.name} ({model.model_id})")

    def get_model(self, model_id: str) -> BaseMLModel | None:
        """
        Get a registered model by ID.

        Args:
            model_id: Model identifier

        Returns:
            BaseMLModel instance or None if not found
        """
        return self._models.get(model_id)

    def list_models(self) -> list[BaseMLModel]:
        """
        List all registered models.

        Returns:
            List of BaseMLModel instances
        """
        return list(self._models.values())

    def predict_with_model(
        self,
        model_id: str,
        stock,
        price_data: list[dict],
        indicators: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """
        Make prediction using a registered model.

        Args:
            model_id: Model identifier
            stock: Stock instance
            price_data: List of price data dictionaries
            indicators: Dictionary of calculated indicators

        Returns:
            Prediction dictionary or None if model not found
        """
        model = self.get_model(model_id)
        if not model:
            logger.warning(f"Model not found: {model_id}")
            return None

        try:
            return model.predict(stock, price_data, indicators)
        except Exception:
            logger.exception(f"Error making prediction with model {model_id}")
            return None

    def load_models_from_db(self) -> None:
        """Load all active models from database."""
        try:
            active_models = MLModel.objects.filter(is_active=True)
            for db_model in active_models:
                # This will be implemented by specific model adapters
                # For now, we'll load them when needed
                logger.debug(f"Found active model in DB: {db_model.name}")
        except Exception:
            logger.exception("Error loading models from database")
