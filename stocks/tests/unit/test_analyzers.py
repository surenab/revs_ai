"""
Unit tests for analyzers (social media, news, sentiment).
"""

from unittest.mock import patch

import pytest

pytestmark = pytest.mark.unit

from stocks.analyzers.news import DummyNewsAnalyzer
from stocks.analyzers.social_media import DummySocialAnalyzer
from stocks.analyzers.sentiment import SentimentScorer


class TestDummySocialAnalyzer:
    """Test DummySocialAnalyzer."""

    def test_analyze_stock_returns_valid_structure(self):
        """Test analyze_stock returns valid sentiment structure."""
        analyzer = DummySocialAnalyzer()
        result = analyzer.analyze_stock("AAPL")

        assert "stock_symbol" in result
        assert "sentiment_score" in result
        assert "action" in result
        assert "confidence" in result
        assert "strength" in result
        assert result["stock_symbol"] == "AAPL"

    def test_analyze_stock_sentiment_score_range(self):
        """Test sentiment score is in valid range."""
        analyzer = DummySocialAnalyzer()

        for _ in range(10):
            result = analyzer.analyze_stock("AAPL")
            # Sentiment score should be normalized
            assert -1.0 <= result["sentiment_score"] <= 1.0

    def test_analyze_stock_action_values(self):
        """Test action values are valid."""
        analyzer = DummySocialAnalyzer()

        for _ in range(10):
            result = analyzer.analyze_stock("AAPL")
            assert result["action"] in ["buy", "sell", "hold"]

    def test_analyze_stock_handles_invalid_symbol(self):
        """Test analyzer handles invalid symbols gracefully."""
        analyzer = DummySocialAnalyzer()
        result = analyzer.analyze_stock("INVALID")

        # Should still return valid structure
        assert "stock_symbol" in result
        assert result["stock_symbol"] == "INVALID"

    def test_analyze_stock_metadata_inclusion(self):
        """Test metadata is included in result."""
        analyzer = DummySocialAnalyzer()
        result = analyzer.analyze_stock("AAPL")

        assert "metadata" in result
        assert "analyzer" in result["metadata"]
        assert result["metadata"]["analyzer"] == "DummySocialAnalyzer"

    def test_analyze_stock_volume_and_mentions(self):
        """Test volume and mention count are included."""
        analyzer = DummySocialAnalyzer()
        result = analyzer.analyze_stock("AAPL")

        assert "volume" in result
        assert "mention_count" in result
        assert result["volume"] > 0
        assert result["mention_count"] > 0


class TestDummyNewsAnalyzer:
    """Test DummyNewsAnalyzer."""

    def test_analyze_stock_returns_valid_structure(self):
        """Test analyze_stock returns valid sentiment structure."""
        analyzer = DummyNewsAnalyzer()
        result = analyzer.analyze_stock("AAPL")

        assert "stock_symbol" in result
        assert "sentiment_score" in result
        assert "action" in result
        assert "confidence" in result
        assert "article_count" in result
        assert result["stock_symbol"] == "AAPL"

    def test_analyze_stock_handles_invalid_symbol(self):
        """Test analyzer handles invalid symbols gracefully."""
        analyzer = DummyNewsAnalyzer()
        result = analyzer.analyze_stock("INVALID")

        # Should still return valid structure
        assert "stock_symbol" in result

    def test_analyze_stock_news_count_and_relevance(self):
        """Test news count and relevance are included."""
        analyzer = DummyNewsAnalyzer()
        result = analyzer.analyze_stock("AAPL")

        assert "article_count" in result
        assert "relevance" in result
        assert result["article_count"] > 0
        assert 0.0 <= result["relevance"] <= 1.0

    def test_analyze_stock_impact_score(self):
        """Test impact score is included."""
        analyzer = DummyNewsAnalyzer()
        result = analyzer.analyze_stock("AAPL")

        assert "impact_score" in result
        assert "impact_level" in result
        assert 0.0 <= result["impact_score"] <= 1.0
        assert result["impact_level"] in ["high", "medium", "low"]

    def test_analyze_stock_timestamp_handling(self):
        """Test timestamp handling."""
        analyzer = DummyNewsAnalyzer()
        result = analyzer.analyze_stock("AAPL")

        assert "metadata" in result
        assert "timestamp" in result["metadata"]
        # Timestamp will be set by caller, so may be None
        assert result["metadata"]["timestamp"] is None or isinstance(
            result["metadata"]["timestamp"], str
        )


class TestSentimentScorer:
    """Test SentimentScorer."""

    def test_normalize_signal_positive_sentiment(self):
        """Test normalizing positive sentiment."""
        result = SentimentScorer.normalize_signal(0.8)

        assert result["sentiment_score"] > 0
        assert result["action"] in ["buy", "hold"]
        assert 0.0 <= result["confidence"] <= 1.0

    def test_normalize_signal_negative_sentiment(self):
        """Test normalizing negative sentiment."""
        result = SentimentScorer.normalize_signal(-0.8)

        assert result["sentiment_score"] < 0
        assert result["action"] in ["sell", "hold"]
        assert 0.0 <= result["confidence"] <= 1.0

    def test_normalize_signal_neutral_sentiment(self):
        """Test normalizing neutral sentiment."""
        result = SentimentScorer.normalize_signal(0.0)

        assert abs(result["sentiment_score"]) < 0.1
        assert result["action"] == "hold"

    def test_normalize_signal_confidence_calculation(self):
        """Test confidence calculation."""
        # Strong sentiment should have higher confidence
        strong_result = SentimentScorer.normalize_signal(0.9)
        weak_result = SentimentScorer.normalize_signal(0.2)

        assert strong_result["confidence"] >= weak_result["confidence"]

    def test_normalize_signal_strength_calculation(self):
        """Test strength calculation."""
        result = SentimentScorer.normalize_signal(0.8)

        assert "strength" in result
        assert 0.0 <= result["strength"] <= 1.0
