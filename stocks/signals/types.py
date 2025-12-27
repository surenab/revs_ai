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
    ):
        """
        Initialize signal.

        Args:
            source: Signal source identifier
            action: "buy", "sell", or "hold"
            confidence: Confidence level (0-1)
            strength: Signal strength (0-1)
            metadata: Additional metadata
        """
        self.source = source
        self.action = action
        self.confidence = max(0.0, min(1.0, confidence))
        self.strength = max(0.0, min(1.0, strength))
        self.metadata = metadata or {}

    def to_dict(self) -> dict[str, Any]:
        """Convert signal to dictionary."""
        return {
            "source": self.source,
            "action": self.action,
            "confidence": self.confidence,
            "strength": self.strength,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Signal":
        """Create signal from dictionary."""
        return cls(
            source=data.get("source", ""),
            action=data.get("action", "hold"),
            confidence=data.get("confidence", 0.0),
            strength=data.get("strength", 1.0),
            metadata=data.get("metadata", {}),
        )
