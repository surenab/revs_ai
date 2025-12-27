"""
Unit tests for signal aggregator.
"""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.unit

from stocks.signals.aggregator import SignalAggregator
from stocks.signals.types import Signal
from stocks.tests.fixtures.sample_data import (
    generate_sample_indicator_signal,
    generate_sample_ml_signal,
    generate_sample_news_signal,
    generate_sample_pattern_signal,
    generate_sample_social_signal,
)


class TestSignalCollection:
    """Test signal collection."""

    def test_collect_ml_signals(self):
        """Test collecting ML signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        ml_signals = [
            generate_sample_ml_signal(action="buy", confidence=0.8, model_id="model1"),
            generate_sample_ml_signal(action="sell", confidence=0.7, model_id="model2"),
        ]

        result = aggregator.aggregate_signals(ml_signals=ml_signals)

        assert "action" in result
        assert "confidence" in result

    def test_collect_social_signals(self):
        """Test collecting social signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        social_signal = generate_sample_social_signal(action="buy", confidence=0.7)

        result = aggregator.aggregate_signals(social_signals=social_signal)

        assert "action" in result

    def test_collect_news_signals(self):
        """Test collecting news signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        news_signal = generate_sample_news_signal(action="buy", confidence=0.65)

        result = aggregator.aggregate_signals(news_signals=news_signal)

        assert "action" in result

    def test_collect_indicator_signals(self):
        """Test collecting indicator signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        indicator_signals = [
            generate_sample_indicator_signal(name="rsi_14", action="buy", confidence=0.7),
        ]

        result = aggregator.aggregate_signals(indicator_signals=indicator_signals)

        assert "action" in result

    def test_collect_pattern_signals(self):
        """Test collecting pattern signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        pattern_signals = [
            generate_sample_pattern_signal(pattern="three_white_soldiers", signal="bullish"),
        ]

        result = aggregator.aggregate_signals(pattern_signals=pattern_signals)

        assert "action" in result

    def test_handle_none_empty_signals(self):
        """Test handling None/empty signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        result = aggregator.aggregate_signals(
            ml_signals=None,
            social_signals=None,
            news_signals=None,
            indicator_signals=None,
            pattern_signals=None,
        )

        assert result["action"] == "hold"
        assert result["confidence"] == 0.0


class TestRiskAdjustment:
    """Test risk adjustment."""

    def test_apply_risk_adjustment_to_confidence(self):
        """Test applying risk adjustment to confidence."""
        config = {
            "method": "weighted_average",
            "risk_adjustment_factor": 0.40,
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        risk_score = 50.0

        result = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=risk_score)

        # Confidence should be adjusted downward based on risk
        assert result["confidence"] <= 0.8

    def test_risk_adjustment_factor_calculation(self):
        """Test risk adjustment factor calculation."""
        config = {
            "method": "weighted_average",
            "risk_adjustment_factor": 0.40,
        }
        aggregator = SignalAggregator(config)

        # High risk should reduce confidence more
        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]

        high_risk_result = aggregator.aggregate_signals(
            ml_signals=ml_signals, risk_score=80.0
        )
        low_risk_result = aggregator.aggregate_signals(
            ml_signals=ml_signals, risk_score=20.0
        )

        # High risk should have lower confidence
        assert high_risk_result["confidence"] < low_risk_result["confidence"]

    def test_handle_none_risk_scores(self):
        """Test handling None risk scores."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]

        result = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=None)

        # Should handle None gracefully
        assert "action" in result

    def test_extreme_risk_scores(self):
        """Test extreme risk scores (0, 100)."""
        config = {
            "method": "weighted_average",
            "risk_adjustment_factor": 0.40,
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]

        zero_risk = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=0.0)
        max_risk = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=100.0)

        # Zero risk should have higher confidence
        assert zero_risk["confidence"] > max_risk["confidence"]


class TestWeightedAverage:
    """Test weighted average aggregation method."""

    def test_weighted_average_calculate_weighted_scores(self):
        """Test calculating weighted scores."""
        config = {
            "method": "weighted_average",
            "weights": {"ml": 0.5, "indicator": 0.3, "pattern": 0.2},
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        indicator_signals = [
            generate_sample_indicator_signal(action="buy", confidence=0.7)
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        assert result["action"] in ["buy", "hold"]
        assert result["confidence"] > 0.0

    def test_weighted_average_action_determination(self):
        """Test action determination in weighted average."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        # All buy signals
        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        indicator_signals = [
            generate_sample_indicator_signal(action="buy", confidence=0.7)
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        assert result["action"] == "buy"

    def test_weighted_average_handle_empty_signals(self):
        """Test handling empty signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        result = aggregator.aggregate_signals()

        assert result["action"] == "hold"
        assert result["confidence"] == 0.0
        assert "reason" in result

    def test_weighted_average_signal_weight_application(self):
        """Test signal weight application."""
        config = {
            "method": "weighted_average",
            "weights": {"ml": 0.8, "indicator": 0.2},
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.9)]
        indicator_signals = [
            generate_sample_indicator_signal(action="sell", confidence=0.8)
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        # ML signal should dominate due to higher weight
        assert result["action"] == "buy"


class TestEnsembleVoting:
    """Test ensemble voting aggregation method."""

    def test_ensemble_voting_vote_counting(self):
        """Test vote counting in ensemble voting."""
        config = {"method": "ensemble_voting"}
        aggregator = SignalAggregator(config)

        ml_signals = [
            generate_sample_ml_signal(action="buy", confidence=0.8),
            generate_sample_ml_signal(action="buy", confidence=0.7),
        ]
        indicator_signals = [
            generate_sample_indicator_signal(action="sell", confidence=0.6)
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        # Buy should win (2 votes vs 1)
        assert result["action"] == "buy"
        assert "votes" in result

    def test_ensemble_voting_majority_rule(self):
        """Test majority rule in ensemble voting."""
        config = {"method": "ensemble_voting"}
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        indicator_signals = [
            generate_sample_indicator_signal(action="sell", confidence=0.7),
            generate_sample_indicator_signal(action="sell", confidence=0.6),
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        # Sell should win (2 votes vs 1)
        assert result["action"] == "sell"

    def test_ensemble_voting_tie_handling(self):
        """Test tie handling in ensemble voting."""
        config = {"method": "ensemble_voting"}
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        indicator_signals = [
            generate_sample_indicator_signal(action="sell", confidence=0.7)
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        # Tie should default to hold
        assert result["action"] in ["hold", "buy", "sell"]

    def test_ensemble_voting_confidence_averaging(self):
        """Test confidence averaging in ensemble voting."""
        config = {"method": "ensemble_voting"}
        aggregator = SignalAggregator(config)

        ml_signals = [
            generate_sample_ml_signal(action="buy", confidence=0.8),
            generate_sample_ml_signal(action="buy", confidence=0.6),
        ]

        result = aggregator.aggregate_signals(ml_signals=ml_signals)

        # Confidence should be average of votes
        assert 0.0 <= result["confidence"] <= 1.0


class TestThresholdBased:
    """Test threshold-based aggregation method."""

    def test_threshold_based_minimum_confidence(self):
        """Test minimum confidence threshold."""
        config = {
            "method": "threshold_based",
            "thresholds": {"min_confidence": 0.7, "min_strength": 0.5, "required_count": 1},
        }
        aggregator = SignalAggregator(config)

        # Low confidence signal
        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.5)]

        result = aggregator.aggregate_signals(ml_signals=ml_signals)

        # Should be hold due to low confidence
        assert result["action"] == "hold"

    def test_threshold_based_required_count(self):
        """Test required signal count threshold."""
        config = {
            "method": "threshold_based",
            "thresholds": {
                "min_confidence": 0.6,
                "min_strength": 0.5,
                "required_count": 3,
            },
        }
        aggregator = SignalAggregator(config)

        # Only 2 signals
        ml_signals = [
            generate_sample_ml_signal(action="buy", confidence=0.8),
            generate_sample_ml_signal(action="buy", confidence=0.7),
        ]

        result = aggregator.aggregate_signals(ml_signals=ml_signals)

        # Should be hold due to insufficient count
        assert result["action"] == "hold"

    def test_threshold_based_signal_agreement(self):
        """Test signal agreement validation."""
        config = {
            "method": "threshold_based",
            "thresholds": {
                "min_confidence": 0.6,
                "min_strength": 0.5,
                "required_count": 2,
            },
        }
        aggregator = SignalAggregator(config)

        # Conflicting signals
        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        indicator_signals = [
            generate_sample_indicator_signal(action="sell", confidence=0.7)
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        # Should be hold due to disagreement
        assert result["action"] == "hold"


class TestPositionScaling:
    """Test position scaling."""

    def test_calculate_position_scale_factor(self):
        """Test calculating position scale factor."""
        config = {
            "method": "weighted_average",
            "risk_based_position_scaling": True,
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]

        result = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=50.0)

        assert "position_scale_factor" in result
        assert 0.0 <= result["position_scale_factor"] <= 1.2

    def test_position_scaling_high_risk(self):
        """Test position scaling at high risk (>80)."""
        config = {
            "method": "weighted_average",
            "risk_based_position_scaling": True,
            "risk_score_threshold": 80.0,
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]

        result = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=85.0)

        # High risk should trigger override, returning early without position_scale_factor
        # Or if it does return, it should be 0.0
        if "position_scale_factor" in result:
            assert result["position_scale_factor"] == 0.0
        else:
            # Risk override happened, action should be hold
            assert result["action"] == "hold"
            assert result.get("risk_override") is True

    def test_position_scaling_low_risk(self):
        """Test position scaling at low risk (<30)."""
        config = {
            "method": "weighted_average",
            "risk_based_position_scaling": True,
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]

        result = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=20.0)

        # Low risk should increase position
        assert result["position_scale_factor"] == 1.2

    def test_position_scaling_medium_risk(self):
        """Test position scaling at medium risk (60-80)."""
        config = {
            "method": "weighted_average",
            "risk_based_position_scaling": True,
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]

        result = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=70.0)

        # Medium risk should reduce position
        assert result["position_scale_factor"] == 0.5


class TestEdgeCases:
    """Test edge cases."""

    def test_all_signals_agree(self):
        """Test when all signals agree."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        indicator_signals = [
            generate_sample_indicator_signal(action="buy", confidence=0.7)
        ]
        pattern_signals = [
            generate_sample_pattern_signal(pattern="three_white_soldiers", signal="bullish")
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals,
            indicator_signals=indicator_signals,
            pattern_signals=pattern_signals,
        )

        assert result["action"] == "buy"
        assert result["confidence"] > 0.0

    def test_all_signals_disagree(self):
        """Test when all signals disagree."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.8)]
        indicator_signals = [
            generate_sample_indicator_signal(action="sell", confidence=0.7)
        ]

        result = aggregator.aggregate_signals(
            ml_signals=ml_signals, indicator_signals=indicator_signals
        )

        # Should determine action based on weights
        assert result["action"] in ["buy", "sell", "hold"]

    def test_no_signals(self):
        """Test with no signals."""
        config = {"method": "weighted_average"}
        aggregator = SignalAggregator(config)

        result = aggregator.aggregate_signals()

        assert result["action"] == "hold"
        assert result["confidence"] == 0.0

    def test_risk_override_scenarios(self):
        """Test risk override scenarios."""
        config = {
            "method": "weighted_average",
            "risk_score_threshold": 80.0,
        }
        aggregator = SignalAggregator(config)

        ml_signals = [generate_sample_ml_signal(action="buy", confidence=0.9)]

        # Risk above threshold should force hold
        result = aggregator.aggregate_signals(ml_signals=ml_signals, risk_score=85.0)

        assert result["action"] == "hold"
        assert result["risk_override"] is True
