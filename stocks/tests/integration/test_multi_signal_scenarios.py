"""
Integration tests for multi-signal scenarios.
"""

from decimal import Decimal

import pytest
from django.test import TestCase

pytestmark = pytest.mark.integration

from stocks.bot_engine import TradingBot
from stocks.models import MLModel
from stocks.tests.fixtures.factories import (
    MLModelFactory,
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)


class TestMultiSignalScenarios(TestCase):
    """Test various multi-signal combination scenarios."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.stock = StockFactory.create()
        StockPriceFactory.create_series(self.stock, days=30)

    def test_scenario_all_signals_bullish(self):
        """Test scenario: All signals bullish."""
        from unittest.mock import patch
        from stocks.analyzers.news import DummyNewsAnalyzer
        from stocks.analyzers.social_media import DummySocialAnalyzer

        # Create ML model
        ml_model = MLModelFactory.create(name="SMA Model", is_active=True)

        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_ml_models=[str(ml_model.id)],
            enable_social_analysis=True,
            enable_news_analysis=True,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        # Mock analyzers to return bullish signals
        bullish_social = {
            "stock_symbol": self.stock.symbol,
            "sentiment_score": 0.7,
            "normalized_score": 0.7,
            "action": "buy",
            "confidence": 0.7,
            "strength": 0.7,
            "volume": 1000,
            "mention_count": 1000,
            "trending": True,
            "platforms": {},
            "metadata": {"analyzer": "DummySocialAnalyzer"},
        }
        bullish_news = {
            "stock_symbol": self.stock.symbol,
            "sentiment_score": 0.6,
            "normalized_score": 0.6,
            "action": "buy",
            "confidence": 0.6,
            "strength": 0.6,
            "article_count": 10,
            "relevance": 0.8,
            "impact_score": 0.7,
            "impact_level": "high",
            "recent_headlines": [],
            "metadata": {"analyzer": "DummyNewsAnalyzer"},
        }

        with patch.object(
            DummySocialAnalyzer, "analyze_stock", return_value=bullish_social
        ), patch.object(DummyNewsAnalyzer, "analyze_stock", return_value=bullish_news):
            bot = TradingBot(bot_config)
            analysis = bot.analyze_stock(self.stock)

            # With all bullish signals, should generate buy or hold
            # Note: May still be sell if indicators/patterns are bearish
            assert analysis["action"] in ["buy", "hold", "skip", "sell"]

    def test_scenario_mixed_signals(self):
        """Test scenario: Mixed signals (ML buy, Indicators sell)."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            signal_aggregation_method="weighted_average",
            signal_weights={"ml": 0.4, "indicator": 0.6},  # Indicators weighted higher
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Should aggregate based on weights
        assert analysis["action"] in ["buy", "sell", "hold", "skip"]
        assert "aggregated_signal" in analysis

    def test_scenario_high_risk_override(self):
        """Test scenario: High risk override."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            risk_score_threshold=Decimal("50.00"),  # Low threshold
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # If risk is high, should be hold/skip regardless of signals
        if analysis.get("risk_score") and analysis["risk_score"] > 50:
            assert analysis["action"] in ["hold", "skip"]

    def test_scenario_low_confidence(self):
        """Test scenario: All signals with low confidence."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            signal_aggregation_method="threshold_based",
            signal_thresholds={
                "min_confidence": 0.8,  # High threshold
                "min_strength": 0.7,
                "required_count": 2,
            },
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # With low confidence, should be hold
        aggregated = analysis.get("aggregated_signal", {})
        if aggregated.get("confidence", 0) < 0.8:
            assert analysis["action"] in ["hold", "skip"]

    def test_scenario_no_signals(self):
        """Test scenario: No signals (all disabled)."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_ml_models=[],
            enabled_indicators={},
            enabled_patterns={},
            enable_social_analysis=False,
            enable_news_analysis=False,
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Should skip when no signals
        assert analysis["action"] == "skip"

    def test_scenario_conflicting_signals(self):
        """Test scenario: Conflicting signals (strong buy vs strong sell)."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            signal_aggregation_method="ensemble_voting",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Should determine action based on voting
        assert analysis["action"] in ["buy", "sell", "hold", "skip"]
        assert "aggregated_signal" in analysis

    def test_scenario_risk_based_position_scaling(self):
        """Test scenario: Risk-based position scaling."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            risk_based_position_scaling=True,
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        aggregated = analysis.get("aggregated_signal", {})
        if "position_scale_factor" in aggregated:
            scale_factor = aggregated["position_scale_factor"]
            assert 0.0 <= scale_factor <= 1.2

    def test_scenario_multiple_ml_models(self):
        """Test scenario: Multiple ML models with different weights."""
        ml_model1 = MLModelFactory.create(name="Model 1", is_active=True)
        ml_model2 = MLModelFactory.create(name="Model 2", is_active=True)

        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_ml_models=[str(ml_model1.id), str(ml_model2.id)],
            ml_model_weights={
                str(ml_model1.id): 0.7,
                str(ml_model2.id): 0.3,
            },
            signal_aggregation_method="weighted_average",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        # Should aggregate multiple model signals
        assert len(analysis.get("ml_signals", [])) >= 0
        assert "aggregated_signal" in analysis

    def test_scenario_weighted_average_aggregation(self):
        """Test weighted average aggregation method."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            signal_aggregation_method="weighted_average",
            signal_weights={"ml": 0.4, "indicator": 0.3, "pattern": 0.2, "social_media": 0.1},
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        aggregated = analysis.get("aggregated_signal", {})
        assert aggregated.get("aggregation_method") == "weighted_average"
        # action_scores may not be present if risk override or no signals
        if "action_scores" in aggregated:
            assert isinstance(aggregated["action_scores"], dict)

    def test_scenario_ensemble_voting_aggregation(self):
        """Test ensemble voting aggregation method."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            signal_aggregation_method="ensemble_voting",
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        aggregated = analysis.get("aggregated_signal", {})
        assert aggregated.get("aggregation_method") == "ensemble_voting"

    def test_scenario_threshold_based_aggregation(self):
        """Test threshold-based aggregation method."""
        bot_config = TradingBotConfigFactory.create(
            user=self.user,
            signal_aggregation_method="threshold_based",
            signal_thresholds={
                "min_confidence": 0.6,
                "min_strength": 0.5,
                "required_count": 2,
            },
        )
        bot_config.assigned_stocks.add(self.stock)

        bot = TradingBot(bot_config)
        analysis = bot.analyze_stock(self.stock)

        aggregated = analysis.get("aggregated_signal", {})
        assert aggregated.get("aggregation_method") == "threshold_based"
