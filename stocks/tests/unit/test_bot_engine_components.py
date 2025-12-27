"""
Unit tests for bot engine helper methods.
"""

from decimal import Decimal

import pytest
from django.test import TestCase

pytestmark = pytest.mark.unit

from stocks.bot_engine import TradingBot
from stocks.models import StockPrice
from stocks.tests.fixtures.factories import (
    StockFactory,
    StockPriceFactory,
    TradingBotConfigFactory,
    UserFactory,
)


class TestBotEngineComponents(TestCase):
    """Test bot engine helper methods."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory.create()
        self.stock = StockFactory.create()
        self.bot_config = TradingBotConfigFactory.create(
            user=self.user,
            enabled_indicators={"sma": {"period": 20}, "rsi": {"period": 14}},
            enabled_patterns={"three_white_soldiers": {}},
        )
        self.bot_config.assigned_stocks.add(self.stock)
        self.bot = TradingBot(self.bot_config)

    def test_get_price_data(self):
        """Test getting price data for stock."""
        # Create price data
        StockPriceFactory.create_series(self.stock, days=30)

        price_data = self.bot._get_price_data(self.stock)

        assert len(price_data) > 0
        assert "symbol" in price_data[0]
        assert "close_price" in price_data[0]

    def test_get_price_data_no_data(self):
        """Test getting price data when none exists."""
        new_stock = StockFactory.create(symbol="NEWSTOCK")
        self.bot_config.assigned_stocks.add(new_stock)

        price_data = self.bot._get_price_data(new_stock)

        assert price_data == []

    def test_get_price_data_limit(self):
        """Test price data limit application."""
        StockPriceFactory.create_series(self.stock, days=100)

        price_data = self.bot._get_price_data(self.stock, limit=50)

        assert len(price_data) <= 50

    def test_get_price_data_ordering(self):
        """Test price data is in chronological order."""
        StockPriceFactory.create_series(self.stock, days=30)

        price_data = self.bot._get_price_data(self.stock)

        # Should be in chronological order (oldest first)
        if len(price_data) > 1:
            first_date = price_data[0].get("date")
            last_date = price_data[-1].get("date")
            if first_date and last_date:
                assert first_date <= last_date

    def test_calculate_indicators_enabled_indicators(self):
        """Test calculating enabled indicators."""
        price_data = [
            {
                "open_price": Decimal("100.00"),
                "high_price": Decimal("105.00"),
                "low_price": Decimal("98.00"),
                "close_price": Decimal("102.00"),
                "volume": 1000000,
            }
            for _ in range(30)
        ]

        indicators_data = self.bot._calculate_indicators(price_data)

        assert "sma_20" in indicators_data
        assert "rsi_14" in indicators_data

    def test_calculate_indicators_disabled_indicators(self):
        """Test handling disabled indicators."""
        self.bot_config.enabled_indicators = {}
        self.bot_config.save()

        price_data = [
            {
                "open_price": Decimal("100.00"),
                "high_price": Decimal("105.00"),
                "low_price": Decimal("98.00"),
                "close_price": Decimal("102.00"),
                "volume": 1000000,
            }
            for _ in range(30)
        ]

        indicators_data = self.bot._calculate_indicators(price_data)

        # Should still calculate default indicators when enabled_indicators is empty
        assert isinstance(indicators_data, dict)

    def test_calculate_indicators_custom_periods(self):
        """Test custom indicator periods."""
        self.bot_config.enabled_indicators = {"sma": {"period": 10}}
        self.bot_config.save()

        price_data = [
            {
                "open_price": Decimal("100.00"),
                "high_price": Decimal("105.00"),
                "low_price": Decimal("98.00"),
                "close_price": Decimal("102.00"),
                "volume": 1000000,
            }
            for _ in range(30)
        ]

        indicators_data = self.bot._calculate_indicators(price_data)

        assert "sma_10" in indicators_data

    def test_calculate_indicators_empty_price_data(self):
        """Test calculating indicators with empty price data."""
        indicators_data = self.bot._calculate_indicators([])

        assert indicators_data == {}

    def test_detect_patterns_enabled_patterns(self):
        """Test detecting enabled patterns."""
        price_data = [
            {
                "open_price": Decimal("100.00"),
                "high_price": Decimal("105.00"),
                "low_price": Decimal("98.00"),
                "close_price": Decimal("102.00"),
                "volume": 1000000,
            }
            for _ in range(30)
        ]

        patterns = self.bot._detect_patterns(price_data)

        assert isinstance(patterns, list)

    def test_detect_patterns_disabled_patterns(self):
        """Test handling disabled patterns."""
        self.bot_config.enabled_patterns = {}
        self.bot_config.save()

        price_data = [
            {
                "open_price": Decimal("100.00"),
                "high_price": Decimal("105.00"),
                "low_price": Decimal("98.00"),
                "close_price": Decimal("102.00"),
                "volume": 1000000,
            }
            for _ in range(30)
        ]

        patterns = self.bot._detect_patterns(price_data)

        # Should return empty list or all patterns when enabled_patterns is empty
        assert isinstance(patterns, list)

    def test_get_ml_predictions_enabled_models(self):
        """Test getting predictions from enabled models."""
        from stocks.models import MLModel

        ml_model = MLModel.objects.create(
            name="Test Model",
            model_type="classification",
            framework="custom",
            is_active=True,
        )
        self.bot_config.enabled_ml_models = [str(ml_model.id)]
        self.bot_config.save()

        price_data = [
            {
                "open_price": Decimal("100.00"),
                "high_price": Decimal("105.00"),
                "low_price": Decimal("98.00"),
                "close_price": Decimal("102.00"),
                "volume": 1000000,
            }
            for _ in range(30)
        ]
        indicators_data = {}

        ml_signals = self.bot._get_ml_predictions(self.stock, price_data, indicators_data)

        assert isinstance(ml_signals, list)

    def test_get_ml_predictions_disabled_models(self):
        """Test handling disabled models."""
        self.bot_config.enabled_ml_models = []
        self.bot_config.save()

        price_data = []
        indicators_data = {}

        ml_signals = self.bot._get_ml_predictions(self.stock, price_data, indicators_data)

        assert ml_signals == []

    def test_get_ml_predictions_inactive_models(self):
        """Test handling inactive models."""
        from stocks.models import MLModel

        ml_model = MLModel.objects.create(
            name="Test Model",
            model_type="classification",
            framework="custom",
            is_active=False,  # Inactive
        )
        self.bot_config.enabled_ml_models = [str(ml_model.id)]
        self.bot_config.save()

        price_data = []
        indicators_data = {}

        ml_signals = self.bot._get_ml_predictions(self.stock, price_data, indicators_data)

        # Should skip inactive models
        assert len(ml_signals) == 0

    def test_analyze_social_media_when_enabled(self):
        """Test social media analysis when enabled."""
        self.bot_config.enable_social_analysis = True
        self.bot_config.save()

        social_signals = self.bot._analyze_social_media(self.stock)

        assert social_signals is not None
        assert "sentiment_score" in social_signals

    def test_analyze_social_media_when_disabled(self):
        """Test social media analysis when disabled."""
        self.bot_config.enable_social_analysis = False
        self.bot_config.save()

        social_signals = self.bot._analyze_social_media(self.stock)

        assert social_signals is None

    def test_analyze_news_when_enabled(self):
        """Test news analysis when enabled."""
        self.bot_config.enable_news_analysis = True
        self.bot_config.save()

        news_signals = self.bot._analyze_news(self.stock)

        assert news_signals is not None
        assert "sentiment_score" in news_signals

    def test_analyze_news_when_disabled(self):
        """Test news analysis when disabled."""
        self.bot_config.enable_news_analysis = False
        self.bot_config.save()

        news_signals = self.bot._analyze_news(self.stock)

        assert news_signals is None

    def test_convert_indicators_to_signals(self):
        """Test converting indicators to signals."""
        price_data = [
            {
                "open_price": Decimal("100.00"),
                "high_price": Decimal("105.00"),
                "low_price": Decimal("98.00"),
                "close_price": Decimal("102.00"),
                "volume": 1000000,
            }
            for _ in range(30)
        ]
        indicators_data = {
            "rsi_14": [50.0] * 30,
            "sma_20": [100.0] * 30,
        }

        signals = self.bot._convert_indicators_to_signals(indicators_data, price_data)

        assert isinstance(signals, list)

    def test_convert_indicators_to_signals_empty_indicators(self):
        """Test converting empty indicators."""
        price_data = []
        indicators_data = {}

        signals = self.bot._convert_indicators_to_signals(indicators_data, price_data)

        assert signals == []

    def test_serialize_indicators(self):
        """Test serializing indicators data."""
        indicators_data = {
            "sma_20": [100.0, 101.0, 102.0],
            "rsi_14": 50.0,
        }

        serialized = self.bot._serialize_indicators(indicators_data)

        assert "sma_20" in serialized
        assert "rsi_14" in serialized
        assert isinstance(serialized["sma_20"], dict)
        assert "current" in serialized["sma_20"]

    def test_to_decimal(self):
        """Test to_decimal conversion."""
        assert self.bot._to_decimal(100) == Decimal("100")
        assert self.bot._to_decimal(100.5) == Decimal("100.5")
        assert self.bot._to_decimal("100.5") == Decimal("100.5")
        assert self.bot._to_decimal(Decimal("100.5")) == Decimal("100.5")
        assert self.bot._to_decimal(None) is None
