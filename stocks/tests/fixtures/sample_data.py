"""
Sample data generators for tests.
"""

from decimal import Decimal
from typing import Any

from stocks.tests.fixtures.factories import StockFactory, StockPriceFactory


def generate_price_data(
    days: int = 30,
    start_price: Decimal = Decimal("150.00"),
    trend: str = "neutral",
    volatility: float = 0.02,
) -> list[dict[str, Any]]:
    """
    Generate sample price data.

    Args:
        days: Number of days of data
        start_price: Starting price
        trend: "up", "down", or "neutral"
        volatility: Price volatility factor

    Returns:
        List of price data dictionaries
    """
    import random
    from datetime import date, timedelta

    data = []
    current_price = float(start_price)
    start_date = date.today() - timedelta(days=days - 1)

    for i in range(days):
        price_date = start_date + timedelta(days=i)

        # Apply trend
        if trend == "up":
            trend_factor = 0.001  # Slight upward trend
        elif trend == "down":
            trend_factor = -0.001  # Slight downward trend
        else:
            trend_factor = 0.0

        # Random walk with trend
        change = random.uniform(-volatility, volatility) + trend_factor
        current_price = current_price * (1.0 + change)

        # Generate OHLC
        open_price = current_price * random.uniform(0.995, 1.005)
        high_price = max(open_price, current_price) * random.uniform(1.0, 1.02)
        low_price = min(open_price, current_price) * random.uniform(0.98, 1.0)
        close_price = current_price

        data.append(
            {
                "symbol": "AAPL",
                "open_price": Decimal(str(round(open_price, 2))),
                "high_price": Decimal(str(round(high_price, 2))),
                "low_price": Decimal(str(round(low_price, 2))),
                "close_price": Decimal(str(round(close_price, 2))),
                "volume": random.randint(1000000, 10000000),
                "date": price_date.isoformat(),
            }
        )

    return data


def generate_bullish_price_data(days: int = 30) -> list[dict[str, Any]]:
    """Generate bullish price data (uptrend)."""
    return generate_price_data(days=days, trend="up", volatility=0.015)


def generate_bearish_price_data(days: int = 30) -> list[dict[str, Any]]:
    """Generate bearish price data (downtrend)."""
    return generate_price_data(days=days, trend="down", volatility=0.015)


def generate_volatile_price_data(days: int = 30) -> list[dict[str, Any]]:
    """Generate volatile price data."""
    return generate_price_data(days=days, trend="neutral", volatility=0.05)


def generate_stable_price_data(days: int = 30) -> list[dict[str, Any]]:
    """Generate stable price data (low volatility)."""
    return generate_price_data(days=days, trend="neutral", volatility=0.005)


def generate_three_white_soldiers_data() -> list[dict[str, Any]]:
    """Generate price data that forms Three White Soldiers pattern."""
    data = generate_price_data(days=10, start_price=Decimal("100.00"))

    # Modify last 3 candles to form pattern
    base_price = float(data[-3]["close_price"])

    # Three consecutive bullish candles, each closing higher
    for i in range(3):
        idx = len(data) - 3 + i
        open_price = base_price + (i * 0.5)
        close_price = open_price + 2.0
        high_price = close_price + 0.5
        low_price = open_price - 0.3

        data[idx] = {
            "symbol": "AAPL",
            "open_price": Decimal(str(round(open_price, 2))),
            "high_price": Decimal(str(round(high_price, 2))),
            "low_price": Decimal(str(round(low_price, 2))),
            "close_price": Decimal(str(round(close_price, 2))),
            "volume": 1000000,
            "date": data[idx]["date"],
        }
        base_price = close_price

    return data


def generate_engulfing_pattern_data(bullish: bool = True) -> list[dict[str, Any]]:
    """Generate price data that forms Engulfing pattern."""
    data = generate_price_data(days=10, start_price=Decimal("100.00"))

    # Modify last 2 candles
    if bullish:
        # First candle: bearish, small
        data[-2] = {
            "symbol": "AAPL",
            "open_price": Decimal("102.00"),
            "high_price": Decimal("102.50"),
            "low_price": Decimal("101.00"),
            "close_price": Decimal("101.50"),
            "volume": 1000000,
            "date": data[-2]["date"],
        }
        # Second candle: bullish, large, engulfs first
        data[-1] = {
            "symbol": "AAPL",
            "open_price": Decimal("101.00"),
            "high_price": Decimal("104.00"),
            "low_price": Decimal("100.50"),
            "close_price": Decimal("103.50"),
            "volume": 2000000,
            "date": data[-1]["date"],
        }
    else:
        # First candle: bullish, small
        data[-2] = {
            "symbol": "AAPL",
            "open_price": Decimal("101.00"),
            "high_price": Decimal("102.00"),
            "low_price": Decimal("100.50"),
            "close_price": Decimal("101.50"),
            "volume": 1000000,
            "date": data[-2]["date"],
        }
        # Second candle: bearish, large, engulfs first
        data[-1] = {
            "symbol": "AAPL",
            "open_price": Decimal("102.00"),
            "high_price": Decimal("101.50"),
            "low_price": Decimal("98.00"),
            "close_price": Decimal("99.00"),
            "volume": 2000000,
            "date": data[-1]["date"],
        }

    return data


def generate_rsi_oversold_data() -> list[dict[str, Any]]:
    """Generate price data that results in oversold RSI (< 30)."""
    # Create declining price data
    data = []
    start_price = 150.0

    for i in range(20):
        # Steady decline
        close_price = start_price - (i * 2.0)
        data.append(
            {
                "symbol": "AAPL",
                "open_price": Decimal(str(round(close_price + 1.0, 2))),
                "high_price": Decimal(str(round(close_price + 1.5, 2))),
                "low_price": Decimal(str(round(close_price - 0.5, 2))),
                "close_price": Decimal(str(round(close_price, 2))),
                "volume": 1000000,
                "date": f"2024-01-{i+1:02d}",
            }
        )

    return data


def generate_rsi_overbought_data() -> list[dict[str, Any]]:
    """Generate price data that results in overbought RSI (> 70)."""
    # Create rising price data
    data = []
    start_price = 100.0

    for i in range(20):
        # Steady rise
        close_price = start_price + (i * 2.0)
        data.append(
            {
                "symbol": "AAPL",
                "open_price": Decimal(str(round(close_price - 1.0, 2))),
                "high_price": Decimal(str(round(close_price + 0.5, 2))),
                "low_price": Decimal(str(round(close_price - 1.5, 2))),
                "close_price": Decimal(str(round(close_price, 2))),
                "volume": 1000000,
                "date": f"2024-01-{i+1:02d}",
            }
        )

    return data


def generate_sample_ml_signal(
    action: str = "buy",
    confidence: float = 0.75,
    model_id: str = "test-model-1",
    model_name: str = "Test Model",
) -> dict[str, Any]:
    """Generate a sample ML signal."""
    return {
        "action": action,
        "confidence": confidence,
        "predicted_gain": 0.05 if action == "buy" else 0.0,
        "predicted_loss": 0.02 if action == "buy" else 0.03,
        "model_id": model_id,
        "model_name": model_name,
        "metadata": {"model_name": model_name},
    }


def generate_sample_social_signal(
    action: str = "buy",
    confidence: float = 0.70,
    strength: float = 0.65,
) -> dict[str, Any]:
    """Generate a sample social media signal."""
    return {
        "stock_symbol": "AAPL",
        "sentiment_score": 0.6 if action == "buy" else -0.6,
        "normalized_score": 0.6 if action == "buy" else -0.6,
        "action": action,
        "confidence": confidence,
        "strength": strength,
        "volume": 5000,
        "mention_count": 5000,
        "trending": True,
        "metadata": {"analyzer": "DummySocialAnalyzer"},
    }


def generate_sample_news_signal(
    action: str = "buy",
    confidence: float = 0.65,
    strength: float = 0.60,
) -> dict[str, Any]:
    """Generate a sample news signal."""
    return {
        "stock_symbol": "AAPL",
        "sentiment_score": 0.5 if action == "buy" else -0.5,
        "normalized_score": 0.5 if action == "buy" else -0.5,
        "action": action,
        "confidence": confidence,
        "strength": strength,
        "article_count": 20,
        "relevance": 0.8,
        "impact_score": 0.7,
        "impact_level": "high",
        "metadata": {"analyzer": "DummyNewsAnalyzer"},
    }


def generate_sample_indicator_signal(
    name: str = "rsi_14",
    action: str = "buy",
    confidence: float = 0.70,
    strength: float = 0.65,
    value: float = 25.0,
) -> dict[str, Any]:
    """Generate a sample indicator signal."""
    return {
        "name": name,
        "action": action,
        "confidence": confidence,
        "strength": strength,
        "value": value,
    }


def generate_sample_pattern_signal(
    pattern: str = "three_white_soldiers",
    signal: str = "bullish",
    confidence: float = 0.80,
) -> dict[str, Any]:
    """Generate a sample pattern signal."""
    return {
        "pattern": pattern,
        "pattern_name": pattern.replace("_", " ").title(),
        "index": 27,
        "candles": 3,
        "signal": signal,
        "confidence": confidence,
        "description": f"{signal} {pattern} pattern",
    }


def create_test_stock_with_prices(
    symbol: str = "AAPL",
    days: int = 30,
    **price_kwargs,
) -> tuple:
    """Create a stock with price history."""
    stock = StockFactory.create(symbol=symbol)
    prices = StockPriceFactory.create_series(stock, days=days, **price_kwargs)
    return stock, prices
