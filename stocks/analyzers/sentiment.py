"""
Sentiment Scoring Utilities
Convert text/volume to numerical signals.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class SentimentScorer:
    """Convert text and volume data to numerical sentiment signals."""

    # Positive sentiment keywords
    POSITIVE_KEYWORDS = [
        "bullish",
        "buy",
        "up",
        "rise",
        "gain",
        "profit",
        "growth",
        "strong",
        "positive",
        "outperform",
        "upgrade",
        "rally",
        "surge",
        "soar",
        "jump",
    ]

    # Negative sentiment keywords
    NEGATIVE_KEYWORDS = [
        "bearish",
        "sell",
        "down",
        "fall",
        "loss",
        "decline",
        "weak",
        "negative",
        "underperform",
        "downgrade",
        "crash",
        "plunge",
        "drop",
        "sink",
    ]

    @staticmethod
    def score_sentiment(text: str) -> float:
        """
        Score sentiment from text.

        Args:
            text: Text to analyze

        Returns:
            Sentiment score (-1 to 1, where 1 is most positive)
        """
        if not text:
            return 0.0

        text_lower = text.lower()
        positive_count = sum(
            1 for keyword in SentimentScorer.POSITIVE_KEYWORDS if keyword in text_lower
        )
        negative_count = sum(
            1 for keyword in SentimentScorer.NEGATIVE_KEYWORDS if keyword in text_lower
        )

        total = positive_count + negative_count
        if total == 0:
            return 0.0

        # Normalize to -1 to 1
        score = (positive_count - negative_count) / total
        return max(-1.0, min(1.0, score))

    @staticmethod
    def normalize_signal(
        raw_score: float, min_val: float = -1.0, max_val: float = 1.0
    ) -> dict[str, Any]:
        """
        Normalize signal score to standard format.

        Args:
            raw_score: Raw sentiment score
            min_val: Minimum possible value
            max_val: Maximum possible value

        Returns:
            Dictionary with normalized signal data
        """
        # Normalize to 0-1 range
        normalized = (raw_score - min_val) / (max_val - min_val)

        # Determine action based on sentiment
        if normalized > 0.6:
            action = "buy"
            confidence = normalized
        elif normalized < 0.4:
            action = "sell"
            confidence = 1.0 - normalized
        else:
            action = "hold"
            confidence = 0.5

        return {
            "sentiment_score": round(raw_score, 4),
            "normalized_score": round(normalized, 4),
            "action": action,
            "confidence": round(confidence, 4),
            "strength": round(abs(raw_score), 4),
        }
