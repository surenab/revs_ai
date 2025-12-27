"""
Signal Aggregator
Combine multiple signals into final decision with risk management integration.
"""

import logging
from decimal import Decimal
from typing import Any

from .types import Signal

logger = logging.getLogger(__name__)


class SignalAggregator:
    """Aggregates multiple signals into a final trading decision."""

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize signal aggregator.

        Args:
            config: Configuration dictionary with aggregation settings
        """
        self.config = config or {}
        self.aggregation_method = self.config.get("method", "weighted_average")
        self.signal_weights = self.config.get("weights", {})
        self.ml_model_weights = self.config.get("ml_model_weights", {})
        self.thresholds = self.config.get("thresholds", {})
        self.risk_score_threshold = self.config.get("risk_score_threshold", 80.0)
        self.risk_adjustment_factor = float(
            self.config.get("risk_adjustment_factor", 0.40)
        )
        self.risk_based_scaling = self.config.get("risk_based_position_scaling", True)

    def aggregate_signals(
        self,
        ml_signals: list[dict[str, Any]] | None = None,
        social_signals: dict[str, Any] | None = None,
        news_signals: dict[str, Any] | None = None,
        indicator_signals: list[dict[str, Any]] | None = None,
        pattern_signals: list[dict[str, Any]] | None = None,
        risk_score: float | Decimal | None = None,
    ) -> dict[str, Any]:
        """
        Aggregate all signals into final decision.

        Args:
            ml_signals: List of ML model predictions
            social_signals: Social media sentiment signals
            news_signals: News sentiment signals
            indicator_signals: Technical indicator signals
            pattern_signals: Chart pattern signals
            risk_score: Calculated risk score (0-100)

        Returns:
            Dictionary with final decision and metadata
        """
        # Convert risk score to float
        risk_score_float = float(risk_score) if risk_score is not None else 0.0

        # Apply risk override if risk is too high
        if risk_score_float > self.risk_score_threshold:
            logger.warning(
                f"Risk score {risk_score_float} exceeds threshold {self.risk_score_threshold}, forcing HOLD"
            )
            return {
                "action": "hold",
                "confidence": 0.0,
                "reason": f"Risk score {risk_score_float:.2f} exceeds threshold {self.risk_score_threshold}",
                "risk_score": risk_score_float,
                "risk_override": True,
                "signals": {},
            }

        # Convert all signals to Signal objects
        signals = self._collect_signals(
            ml_signals, social_signals, news_signals, indicator_signals, pattern_signals
        )

        # Apply risk adjustment to signal confidence
        risk_adjusted_signals = self._apply_risk_adjustment(signals, risk_score_float)

        # Aggregate based on method
        if self.aggregation_method == "weighted_average":
            result = self._weighted_average(risk_adjusted_signals)
        elif self.aggregation_method == "ensemble_voting":
            result = self._ensemble_voting(risk_adjusted_signals)
        elif self.aggregation_method == "threshold_based":
            result = self._threshold_based(risk_adjusted_signals, risk_score_float)
        elif self.aggregation_method == "custom_rule":
            result = self._custom_rule(risk_adjusted_signals, risk_score_float)
        else:
            logger.warning(
                f"Unknown aggregation method: {self.aggregation_method}, using weighted_average"
            )
            result = self._weighted_average(risk_adjusted_signals)

        # Add risk-based position scaling
        if self.risk_based_scaling:
            result["position_scale_factor"] = self._calculate_position_scale_factor(
                risk_score_float
            )
        else:
            result["position_scale_factor"] = 1.0

        result["risk_score"] = risk_score_float
        result["signals_used"] = len(signals)
        result["aggregation_method"] = self.aggregation_method

        return result

    def _collect_signals(
        self,
        ml_signals: list[dict] | None,
        social_signals: dict | None,
        news_signals: dict | None,
        indicator_signals: list[dict] | None,
        pattern_signals: list[dict] | None,
    ) -> list[Signal]:
        """Collect and convert all signals to Signal objects."""
        signals = []

        # ML signals (with individual model weights)
        if ml_signals:
            for ml_signal in ml_signals:
                if isinstance(ml_signal, dict):
                    model_id = ml_signal.get("model_id", "unknown")
                    # Apply ML model weight if configured
                    base_confidence = float(ml_signal.get("confidence", 0.0))
                    model_weight = self.ml_model_weights.get(str(model_id), 1.0)
                    weighted_confidence = base_confidence * float(model_weight)

                    signals.append(
                        Signal(
                            source=f"ml_{model_id}",
                            action=ml_signal.get("action", "hold"),
                            confidence=weighted_confidence,
                            strength=weighted_confidence,
                            metadata={
                                **ml_signal,
                                "model_weight": model_weight,
                                "original_confidence": base_confidence,
                            },
                        )
                    )

        # Social signals
        if social_signals:
            signals.append(
                Signal(
                    source="social_media",
                    action=social_signals.get("action", "hold"),
                    confidence=float(social_signals.get("confidence", 0.0)),
                    strength=float(social_signals.get("strength", 0.0)),
                    metadata=social_signals,
                )
            )

        # News signals
        if news_signals:
            signals.append(
                Signal(
                    source="news",
                    action=news_signals.get("action", "hold"),
                    confidence=float(news_signals.get("confidence", 0.0)),
                    strength=float(news_signals.get("strength", 0.0)),
                    metadata=news_signals,
                )
            )

        # Indicator signals
        if indicator_signals:
            signals.extend(
                Signal(
                    source=f"indicator_{indicator_signal.get('name', 'unknown')}",
                    action=indicator_signal.get("action", "hold"),
                    confidence=float(indicator_signal.get("confidence", 0.0)),
                    strength=float(indicator_signal.get("strength", 0.0)),
                    metadata=indicator_signal,
                )
                for indicator_signal in indicator_signals
                if isinstance(indicator_signal, dict)
            )

        # Pattern signals
        if pattern_signals:
            signals.extend(
                Signal(
                    source=f"pattern_{pattern_signal.get('pattern', 'unknown')}",
                    action=pattern_signal.get("signal", "hold"),
                    confidence=float(pattern_signal.get("confidence", 0.0)),
                    strength=float(pattern_signal.get("confidence", 0.0)),
                    metadata=pattern_signal,
                )
                for pattern_signal in pattern_signals
                if isinstance(pattern_signal, dict)
            )

        return signals

    def _apply_risk_adjustment(
        self, signals: list[Signal], risk_score: float
    ) -> list[Signal]:
        """
        Apply risk adjustment to signal confidence.

        Formula: adjusted_confidence = original_confidence * (1 - risk_factor * (risk_score / 100))
        """
        adjusted_signals = []
        for signal in signals:
            # Calculate risk adjustment
            risk_adjustment = 1.0 - (self.risk_adjustment_factor * (risk_score / 100.0))
            adjusted_confidence = signal.confidence * max(0.0, risk_adjustment)

            # Create new signal with adjusted confidence
            adjusted_signal = Signal(
                source=signal.source,
                action=signal.action,
                confidence=adjusted_confidence,
                strength=signal.strength,
                metadata={
                    **signal.metadata,
                    "original_confidence": signal.confidence,
                    "risk_adjustment": risk_adjustment,
                },
            )
            adjusted_signals.append(adjusted_signal)

        return adjusted_signals

    def _weighted_average(self, signals: list[Signal]) -> dict[str, Any]:
        """Aggregate signals using weighted average."""
        if not signals:
            return {
                "action": "hold",
                "confidence": 0.0,
                "reason": "No signals available",
            }

        # Get default weights
        default_weights = {
            "ml": 0.40,
            "social_media": 0.10,
            "news": 0.05,
            "indicator": 0.30,
            "pattern": 0.15,
        }
        weights = {**default_weights, **self.signal_weights}

        # Calculate weighted scores for each action
        action_scores = {"buy": 0.0, "sell": 0.0, "hold": 0.0}
        total_contribution = 0.0
        weighted_confidence_sum = 0.0
        total_weight = 0.0

        for signal in signals:
            # Determine weight based on source
            source_type = (
                signal.source.split("_")[0] if "_" in signal.source else signal.source
            )
            weight = weights.get(source_type, 0.1)

            # For ML signals, apply additional model-specific weight if available
            if source_type == "ml" and "model_id" in signal.metadata:
                model_id = signal.metadata.get("model_id")
                model_weight = self.ml_model_weights.get(str(model_id), 1.0)
                weight = weight * float(model_weight)

            # Add to action score
            action = signal.action if signal.action in action_scores else "hold"
            contribution = signal.confidence * signal.strength * weight
            action_scores[action] += contribution
            total_contribution += contribution

            # Calculate weighted confidence for final confidence value
            weighted_confidence_sum += signal.confidence * weight
            total_weight += weight

        # Normalize by total contribution to ensure scores sum to 1.0
        # This properly respects all signals regardless of their count
        if total_contribution > 0:
            for action in action_scores:
                action_scores[action] /= total_contribution

        # Determine final action
        final_action = max(action_scores, key=action_scores.get)

        # Final confidence is weighted average of signal confidences (already risk-adjusted)
        # This preserves the risk adjustment effect
        final_confidence = (
            weighted_confidence_sum / total_weight if total_weight > 0 else 0.0
        )

        return {
            "action": final_action,
            "confidence": round(final_confidence, 4),
            "reason": f"Weighted average: {final_action} with {final_confidence:.2%} confidence",
            "action_scores": {k: round(v, 4) for k, v in action_scores.items()},
        }

    def _ensemble_voting(self, signals: list[Signal]) -> dict[str, Any]:
        """Aggregate signals using ensemble voting (majority rule)."""
        if not signals:
            return {
                "action": "hold",
                "confidence": 0.0,
                "reason": "No signals available",
            }

        # Count votes for each action
        votes = {"buy": 0, "sell": 0, "hold": 0}
        total_confidence = {"buy": 0.0, "sell": 0.0, "hold": 0.0}

        for signal in signals:
            action = signal.action if signal.action in votes else "hold"
            votes[action] += 1
            total_confidence[action] += signal.confidence

        # Determine winner (majority vote)
        max_votes = max(votes.values())
        winners = [action for action, count in votes.items() if count == max_votes]

        if len(winners) == 1:
            final_action = winners[0]
            avg_confidence = (
                total_confidence[final_action] / votes[final_action]
                if votes[final_action] > 0
                else 0.0
            )
        else:
            # Tie - use risk as tiebreaker or default to hold
            final_action = "hold"
            avg_confidence = 0.5

        return {
            "action": final_action,
            "confidence": round(avg_confidence, 4),
            "reason": f"Ensemble voting: {final_action} ({votes[final_action]} votes)",
            "votes": votes,
        }

    def _threshold_based(
        self, signals: list[Signal], risk_score: float
    ) -> dict[str, Any]:
        """Aggregate signals using threshold-based approach."""
        if not signals:
            return {
                "action": "hold",
                "confidence": 0.0,
                "reason": "No signals available",
            }

        min_confidence = self.thresholds.get("min_confidence", 0.6)
        min_strength = self.thresholds.get("min_strength", 0.5)
        required_count = self.thresholds.get("required_count", 2)
        risk_threshold = self.thresholds.get("risk_threshold", 70.0)

        # Check risk threshold
        if risk_score > risk_threshold:
            return {
                "action": "hold",
                "confidence": 0.0,
                "reason": f"Risk score {risk_score:.2f} exceeds threshold {risk_threshold}",
            }

        # Filter signals that meet thresholds
        valid_signals = [
            s
            for s in signals
            if s.confidence >= min_confidence
            and s.strength >= min_strength
            and s.action != "hold"
        ]

        if len(valid_signals) < required_count:
            return {
                "action": "hold",
                "confidence": 0.0,
                "reason": f"Only {len(valid_signals)} signals meet thresholds (required: {required_count})",
            }

        # All valid signals must agree
        actions = [s.action for s in valid_signals]
        if len(set(actions)) == 1:
            final_action = actions[0]
            avg_confidence = sum(s.confidence for s in valid_signals) / len(
                valid_signals
            )
            return {
                "action": final_action,
                "confidence": round(avg_confidence, 4),
                "reason": f"All {len(valid_signals)} signals agree: {final_action}",
            }

        return {
            "action": "hold",
            "confidence": 0.0,
            "reason": "Signals do not agree",
        }

    def _custom_rule(self, signals: list[Signal], risk_score: float) -> dict[str, Any]:
        """Aggregate signals using custom rules (placeholder)."""
        # For now, fall back to weighted average
        # Custom rules would be defined in config as JSON
        logger.warning(
            "Custom rule aggregation not fully implemented, using weighted average"
        )
        return self._weighted_average(signals)

    def _calculate_position_scale_factor(self, risk_score: float) -> float:
        """
        Calculate position scale factor based on risk score.

        Returns:
            Scale factor (0-1) to apply to position size
        """
        if risk_score > 80:
            return 0.0  # Block trade
        if risk_score > 60:
            return 0.5  # Reduce by 50%
        if risk_score < 30:
            return 1.2  # Increase by 20% (capped by max_position_size)
        return 1.0  # Normal size
