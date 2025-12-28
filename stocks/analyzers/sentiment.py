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

        result = {
            "sentiment_score": round(raw_score, 4),
            "normalized_score": round(normalized, 4),
            "action": action,
            "confidence": round(confidence, 4),
            "strength": round(abs(raw_score), 4),
        }

        # Add predictions for buy/sell actions
        if action in ["buy", "sell"]:
            # Sentiment signals typically have shorter timeframes (1-3 days)
            # Gain/loss based on sentiment strength
            sentiment_strength = abs(raw_score)
            if action == "buy":
                possible_gain = 2.0 + (sentiment_strength * 4.0)  # 2-6%
                possible_loss = 1.0 + (sentiment_strength * 2.0)  # 1-3%
            else:
                possible_gain = 1.5 + (sentiment_strength * 3.5)  # 1.5-5%
                possible_loss = 1.0 + (sentiment_strength * 3.0)  # 1-4%

            result["possible_gain"] = round(possible_gain, 2)
            result["possible_loss"] = round(possible_loss, 2)

            # Probabilities based on sentiment strength and confidence
            gain_probability = round(confidence * sentiment_strength * 0.6, 4)
            loss_probability = round(
                (1.0 - confidence) * (1.0 - sentiment_strength) * 0.4, 4
            )

            result["gain_probability"] = gain_probability
            result["loss_probability"] = loss_probability

            # Timeframe prediction (sentiment impact is short-lived)
            result["timeframe_prediction"] = {
                "min_timeframe": "4h",
                "max_timeframe": "3d",
                "expected_timeframe": "1d",
                "timeframe_confidence": round(confidence * 0.7, 4),
            }

            # Scenario analysis
            result["consequences"] = {
                "best_case": {
                    "gain": round(possible_gain * 1.3, 2),
                    "probability": round(gain_probability * 0.7, 4),
                    "timeframe": "4h",
                },
                "base_case": {
                    "gain": round(possible_gain, 2),
                    "probability": round(gain_probability, 4),
                    "timeframe": "1d",
                },
                "worst_case": {
                    "loss": round(possible_loss, 2),
                    "probability": round(loss_probability, 4),
                    "timeframe": "3d",
                },
            }

        return result
