"""
Signal Type Definitions
"""

from enum import Enum
from typing import Any


class SignalSource(str, Enum):
    """Signal source types."""

    ML_MODEL = "ml_model"
    SOCIAL_MEDIA = "social_media"
    NEWS = "news"
    INDICATOR = "indicator"
    PATTERN = "pattern"


class Signal:
    """Represents a trading signal."""

    def __init__(
        self,
        source: str,
        action: str,
        confidence: float,
        strength: float = 1.0,
        metadata: dict[str, Any] | None = None,
        possible_gain: float | None = None,
        possible_loss: float | None = None,
        gain_probability: float | None = None,
        loss_probability: float | None = None,
        timeframe_prediction: dict[str, Any] | None = None,
        consequences: dict[str, Any] | None = None,
    ):
        """
        Initialize signal.

        Args:
            source: Signal source identifier
            action: "buy", "sell", or "hold"
            confidence: Confidence level (0-1)
            strength: Signal strength (0-1)
            metadata: Additional metadata
            possible_gain: Possible gain percentage or absolute value
            possible_loss: Possible loss percentage or absolute value
            gain_probability: Probability that gain will occur (0-1)
            loss_probability: Probability that loss will occur (0-1)
            timeframe_prediction: Dict with min_timeframe, max_timeframe, expected_timeframe, timeframe_confidence
            consequences: Dict with best_case, base_case, worst_case scenarios
        """
        self.source = source
        self.action = action
        self.confidence = max(0.0, min(1.0, confidence))
        self.strength = max(0.0, min(1.0, strength))
        self.metadata = metadata or {}
        self.possible_gain = possible_gain
        self.possible_loss = possible_loss
        self.gain_probability = (
            max(0.0, min(1.0, gain_probability))
            if gain_probability is not None
            else None
        )
        self.loss_probability = (
            max(0.0, min(1.0, loss_probability))
            if loss_probability is not None
            else None
        )
        self.timeframe_prediction = timeframe_prediction or {}
        self.consequences = consequences or {}

    def to_dict(self) -> dict[str, Any]:
        """Convert signal to dictionary."""
        result = {
            "source": self.source,
            "action": self.action,
            "confidence": self.confidence,
            "strength": self.strength,
            "metadata": self.metadata,
        }
        # Add prediction fields if they exist
        if self.possible_gain is not None:
            result["possible_gain"] = self.possible_gain
        if self.possible_loss is not None:
            result["possible_loss"] = self.possible_loss
        if self.gain_probability is not None:
            result["gain_probability"] = self.gain_probability
        if self.loss_probability is not None:
            result["loss_probability"] = self.loss_probability
        if self.timeframe_prediction:
            result["timeframe_prediction"] = self.timeframe_prediction
        if self.consequences:
            result["consequences"] = self.consequences
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Signal":
        """Create signal from dictionary."""
        return cls(
            source=data.get("source", ""),
            action=data.get("action", "hold"),
            confidence=data.get("confidence", 0.0),
            strength=data.get("strength", 1.0),
            metadata=data.get("metadata", {}),
            possible_gain=data.get("possible_gain"),
            possible_loss=data.get("possible_loss"),
            gain_probability=data.get("gain_probability"),
            loss_probability=data.get("loss_probability"),
            timeframe_prediction=data.get("timeframe_prediction"),
            consequences=data.get("consequences"),
        )
