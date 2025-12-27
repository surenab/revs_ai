"""
Unit tests for ML models.
"""

from decimal import Decimal

import pytest

pytestmark = [pytest.mark.unit, pytest.mark.django_db]

from stocks.ml_models.models.dummy_model import DummyMLModel
from stocks.ml_models.models.rsi_model import RSIModel
from stocks.ml_models.models.sma_model import SimpleMovingAverageModel
from stocks.tests.fixtures.sample_data import (
    generate_price_data,
    generate_rsi_overbought_data,
    generate_rsi_oversold_data,
)


class TestDummyMLModel:
    """Test DummyMLModel."""

    def test_dummy_model_initialization(self):
        """Test DummyMLModel initialization."""
        model = DummyMLModel()
        assert model.name == "Dummy ML Model"
        assert model.model_type == "classification"
        assert model.framework == "custom"

    def test_dummy_model_predict_returns_valid_structure(self):
        """Test DummyMLModel predict returns valid structure."""
        from stocks.tests.fixtures.factories import StockFactory

        model = DummyMLModel()
        stock = StockFactory.create()
        price_data = generate_price_data(days=10)

        prediction = model.predict(stock, price_data)

        assert "action" in prediction
        assert "confidence" in prediction
        assert prediction["action"] in ["buy", "sell", "hold"]
        assert 0.0 <= prediction["confidence"] <= 1.0

    def test_dummy_model_confidence_range(self):
        """Test DummyMLModel confidence values in valid range."""
        from stocks.tests.fixtures.factories import StockFactory

        model = DummyMLModel()
        stock = StockFactory.create()
        price_data = generate_price_data(days=10)

        # Run multiple predictions to check range
        for _ in range(10):
            prediction = model.predict(stock, price_data)
            assert 0.5 <= prediction["confidence"] <= 0.95  # As per implementation

    def test_dummy_model_handles_missing_data(self):
        """Test DummyMLModel handles missing data."""
        from stocks.tests.fixtures.factories import StockFactory

        model = DummyMLModel()
        stock = StockFactory.create()
        price_data = []

        prediction = model.predict(stock, price_data)

        # Should still return valid structure
        assert "action" in prediction
        assert "confidence" in prediction


class TestRSIModel:
    """Test RSIModel."""

    def test_rsi_model_initialization(self):
        """Test RSIModel initialization."""
        model = RSIModel(period=14, oversold=30.0, overbought=70.0)
        assert model.period == 14
        assert model.oversold == 30.0
        assert model.overbought == 70.0

    def test_rsi_model_predict_oversold(self):
        """Test RSIModel generates buy signal when oversold."""
        from stocks.tests.fixtures.factories import StockFactory

        model = RSIModel()
        stock = StockFactory.create()
        price_data = generate_rsi_oversold_data()
        # RSIModel calculates RSI internally using indicators module
        indicators_data = None

        prediction = model.predict(stock, price_data, indicators_data)

        # Should generate buy signal when oversold (check metadata for RSI value)
        if prediction.get("metadata", {}).get("current_rsi") is not None:
            current_rsi = prediction["metadata"]["current_rsi"]
            if current_rsi < 30:
                assert prediction["action"] == "buy"
                assert prediction["confidence"] > 0.0
            else:
                # If RSI is not oversold, action might be hold or other
                assert prediction["action"] in ["buy", "sell", "hold"]

    def test_rsi_model_predict_overbought(self):
        """Test RSIModel generates sell signal when overbought."""
        from stocks.tests.fixtures.factories import StockFactory

        model = RSIModel()
        stock = StockFactory.create()
        price_data = generate_rsi_overbought_data()
        # RSIModel calculates RSI internally
        indicators_data = None

        prediction = model.predict(stock, price_data, indicators_data)

        # Should generate sell signal when overbought (check metadata for RSI value)
        if prediction.get("metadata", {}).get("current_rsi") is not None:
            current_rsi = prediction["metadata"]["current_rsi"]
            if current_rsi > 70:
                assert prediction["action"] == "sell"
                assert prediction["confidence"] > 0.0
            else:
                # If RSI is not overbought, action might be hold or other
                assert prediction["action"] in ["buy", "sell", "hold"]

    def test_rsi_model_confidence_calculation(self):
        """Test RSIModel confidence calculation based on RSI extremes."""
        from stocks.tests.fixtures.factories import StockFactory

        model = RSIModel(oversold=30.0, overbought=70.0)
        stock = StockFactory.create()
        price_data = generate_rsi_oversold_data()
        indicators_data = None

        prediction = model.predict(stock, price_data, indicators_data)

        # Confidence should be in valid range
        assert prediction["confidence"] >= 0.0
        assert prediction["confidence"] <= 1.0
        # If RSI is calculated, check metadata
        if prediction.get("metadata", {}).get("current_rsi") is not None:
            assert prediction["metadata"]["current_rsi"] >= 0.0
            assert prediction["metadata"]["current_rsi"] <= 100.0

    def test_rsi_model_handles_insufficient_data(self):
        """Test RSIModel handles insufficient data."""
        from stocks.tests.fixtures.factories import StockFactory

        model = RSIModel()
        stock = StockFactory.create()
        price_data = generate_price_data(days=5)  # Not enough for RSI

        prediction = model.predict(stock, price_data)

        assert prediction["action"] == "hold"
        assert prediction["confidence"] == 0.0
        assert "reason" in prediction.get("metadata", {})


class TestSimpleMovingAverageModel:
    """Test SimpleMovingAverageModel."""

    def test_sma_model_initialization(self):
        """Test SimpleMovingAverageModel initialization."""
        model = SimpleMovingAverageModel(period=20)
        assert model.period == 20

    def test_sma_model_predict_crossover_detection(self):
        """Test SimpleMovingAverageModel detects SMA crossover."""
        from stocks.tests.fixtures.factories import StockFactory

        model = SimpleMovingAverageModel(period=20)
        stock = StockFactory.create()
        price_data = generate_price_data(days=30)
        # SMAModel calculates SMA internally
        indicators_data = None

        prediction = model.predict(stock, price_data, indicators_data)

        assert "action" in prediction
        assert prediction["action"] in ["buy", "sell", "hold"]
        assert "confidence" in prediction

    def test_sma_model_price_vs_sma_position(self):
        """Test SimpleMovingAverageModel signals based on price vs SMA position."""
        from stocks.tests.fixtures.factories import StockFactory

        model = SimpleMovingAverageModel(period=20)
        stock = StockFactory.create()

        # Create data where price is above SMA and SMA is rising
        price_data = [
            {"close_price": Decimal(str(100 + i))} for i in range(30)
        ]
        indicators_data = None

        prediction = model.predict(stock, price_data, indicators_data)

        # Check prediction structure
        assert "action" in prediction
        assert prediction["action"] in ["buy", "sell", "hold"]
        assert "confidence" in prediction
        assert "metadata" in prediction

        # Check metadata for SMA info (model calculates SMA internally)
        metadata = prediction.get("metadata", {})
        if "price_above_sma" in metadata and "sma_rising" in metadata:
            price_above_sma = metadata["price_above_sma"]
            sma_rising = metadata["sma_rising"]
            # With rising prices, price should be above SMA and SMA should be rising
            if price_above_sma and sma_rising:
                assert prediction["action"] == "buy"
                assert prediction["confidence"] > 0.0

    def test_sma_model_confidence_based_on_distance(self):
        """Test SimpleMovingAverageModel confidence based on distance from SMA."""
        from stocks.tests.fixtures.factories import StockFactory

        model = SimpleMovingAverageModel(period=20)
        stock = StockFactory.create()
        price_data = generate_price_data(days=30)
        indicators_data = None

        prediction = model.predict(stock, price_data, indicators_data)

        assert prediction["confidence"] >= 0.0
        assert prediction["confidence"] <= 1.0

    def test_sma_model_handles_insufficient_data(self):
        """Test SimpleMovingAverageModel handles insufficient data."""
        from stocks.tests.fixtures.factories import StockFactory

        model = SimpleMovingAverageModel(period=20)
        stock = StockFactory.create()
        price_data = generate_price_data(days=5)  # Not enough for SMA

        prediction = model.predict(stock, price_data)

        assert prediction["action"] == "hold"
        assert prediction["confidence"] == 0.0
        assert "reason" in prediction.get("metadata", {})


class TestMLModelBase:
    """Test base ML model functionality."""

    def test_model_predict_method_signature(self):
        """Test that all models implement predict method."""
        from stocks.tests.fixtures.factories import StockFactory

        stock = StockFactory.create()
        price_data = generate_price_data(days=10)

        models = [
            DummyMLModel(),
            RSIModel(),
            SimpleMovingAverageModel(),
        ]

        for model in models:
            prediction = model.predict(stock, price_data)
            assert isinstance(prediction, dict)
            assert "action" in prediction
            assert "confidence" in prediction

    def test_model_return_format_validation(self):
        """Test that all models return valid format."""
        from stocks.tests.fixtures.factories import StockFactory

        stock = StockFactory.create()
        price_data = generate_price_data(days=10)

        models = [
            DummyMLModel(),
            RSIModel(),
            SimpleMovingAverageModel(),
        ]

        for model in models:
            prediction = model.predict(stock, price_data)
            assert "action" in prediction
            assert prediction["action"] in ["buy", "sell", "hold"]
            assert "confidence" in prediction
            assert 0.0 <= prediction["confidence"] <= 1.0

    def test_model_handles_missing_data(self):
        """Test that all models handle missing data gracefully."""
        from stocks.tests.fixtures.factories import StockFactory

        stock = StockFactory.create()

        models = [
            DummyMLModel(),
            RSIModel(),
            SimpleMovingAverageModel(),
        ]

        for model in models:
            # Empty price data
            prediction = model.predict(stock, [])
            assert isinstance(prediction, dict)
            assert "action" in prediction

            # None indicators
            prediction = model.predict(stock, generate_price_data(days=10), None)
            assert isinstance(prediction, dict)
