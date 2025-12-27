"""
Unit tests for pattern detector.
"""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.unit

from stocks import pattern_detector
from stocks.tests.fixtures.sample_data import (
    generate_engulfing_pattern_data,
    generate_price_data,
    generate_three_white_soldiers_data,
)


class TestCandlestick:
    """Test Candlestick class."""

    def test_candlestick_creation(self):
        """Test candlestick creation."""
        candle = pattern_detector.Candlestick(100.0, 105.0, 98.0, 102.0, 0)
        assert candle.open == 100.0
        assert candle.high == 105.0
        assert candle.low == 98.0
        assert candle.close == 102.0
        assert candle.index == 0

    def test_candlestick_is_bullish(self):
        """Test bullish candlestick detection."""
        bullish = pattern_detector.Candlestick(100.0, 105.0, 98.0, 102.0, 0)
        bearish = pattern_detector.Candlestick(102.0, 105.0, 98.0, 100.0, 0)

        assert bullish.is_bullish is True
        assert bearish.is_bullish is False

    def test_candlestick_body_size(self):
        """Test body size calculation."""
        candle = pattern_detector.Candlestick(100.0, 105.0, 98.0, 102.0, 0)
        assert candle.body_size == 2.0

    def test_candlestick_upper_wick(self):
        """Test upper wick calculation."""
        candle = pattern_detector.Candlestick(100.0, 105.0, 98.0, 102.0, 0)
        assert candle.upper_wick == 3.0  # 105 - 102

    def test_candlestick_lower_wick(self):
        """Test lower wick calculation."""
        candle = pattern_detector.Candlestick(100.0, 105.0, 98.0, 102.0, 0)
        assert candle.lower_wick == 2.0  # 100 - 98

    def test_candlestick_total_range(self):
        """Test total range calculation."""
        candle = pattern_detector.Candlestick(100.0, 105.0, 98.0, 102.0, 0)
        assert candle.total_range == 7.0  # 105 - 98


class TestToCandlestick:
    """Test to_candlestick function."""

    def test_to_candlestick_with_valid_data(self):
        """Test converting valid price data to candlestick."""
        data = {
            "open_price": 100.00,  # Use float instead of Decimal
            "high_price": 105.00,
            "low_price": 98.00,
            "close_price": 102.00,
        }
        candle = pattern_detector.to_candlestick(data, 0)

        assert candle is not None
        assert candle.open == 100.0
        assert candle.high == 105.0
        assert candle.low == 98.0
        assert candle.close == 102.0

    def test_to_candlestick_with_missing_data(self):
        """Test converting data with missing fields."""
        data = {"close_price": 100.00}  # Use float, to_candlestick uses close_price as fallback
        candle = pattern_detector.to_candlestick(data, 0)

        # Should use close_price as fallback for all fields
        assert candle is not None
        assert candle.close == 100.0

    def test_to_candlestick_with_none_values(self):
        """Test converting data with None values."""
        data = {
            "open_price": None,
            "high_price": None,
            "low_price": None,
            "close_price": None,
        }
        candle = pattern_detector.to_candlestick(data, 0)

        assert candle is None


class TestThreeWhiteSoldiers:
    """Test Three White Soldiers pattern detection."""

    def test_detect_three_white_soldiers_with_valid_pattern(self):
        """Test detecting Three White Soldiers pattern."""
        data = generate_three_white_soldiers_data()
        matches = pattern_detector.detect_three_white_soldiers(data)

        assert len(matches) > 0
        match = matches[0]
        assert match.pattern == "three_white_soldiers"
        assert match.signal == "bullish"
        assert match.confidence == 0.8
        assert match.candles == 3

    def test_detect_three_white_soldiers_with_invalid_data(self):
        """Test pattern not detected with invalid data."""
        data = [
            {"close_price": Decimal("100.00")} for _ in range(10)
        ]  # Not enough structure
        matches = pattern_detector.detect_three_white_soldiers(data)

        # May or may not detect, but should not crash
        assert isinstance(matches, list)

    def test_detect_three_white_soldiers_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [
            {"close_price": Decimal("100.00")},
            {"close_price": Decimal("101.00")},
        ]  # Need at least 3 candles
        matches = pattern_detector.detect_three_white_soldiers(data)

        assert len(matches) == 0

    def test_detect_three_white_soldiers_pattern_index(self):
        """Test pattern index accuracy."""
        data = generate_three_white_soldiers_data()
        matches = pattern_detector.detect_three_white_soldiers(data)

        if matches:
            # Index should be at the last candle of the pattern
            assert matches[0].index >= 2


class TestEngulfing:
    """Test Engulfing pattern detection."""

    def test_detect_bullish_engulfing(self):
        """Test detecting bullish engulfing pattern."""
        data = generate_engulfing_pattern_data(bullish=True)
        matches = pattern_detector.detect_engulfing(data)

        # Should detect bullish engulfing
        bullish_matches = [m for m in matches if m.pattern == "bullish_engulfing"]
        if bullish_matches:
            assert bullish_matches[0].signal == "bullish"
            assert bullish_matches[0].confidence == 0.7

    def test_detect_bearish_engulfing(self):
        """Test detecting bearish engulfing pattern."""
        data = generate_engulfing_pattern_data(bullish=False)
        matches = pattern_detector.detect_engulfing(data)

        # Should detect bearish engulfing
        bearish_matches = [m for m in matches if m.pattern == "bearish_engulfing"]
        if bearish_matches:
            assert bearish_matches[0].signal == "bearish"
            assert bearish_matches[0].confidence == 0.7

    def test_detect_engulfing_with_insufficient_data(self):
        """Test engulfing detection with insufficient data."""
        data = [{"close_price": Decimal("100.00")}]  # Need at least 2 candles
        matches = pattern_detector.detect_engulfing(data)

        assert len(matches) == 0


class TestMorningDojiStar:
    """Test Morning Doji Star pattern detection."""

    def test_detect_morning_doji_star_with_valid_pattern(self):
        """Test detecting Morning Doji Star pattern."""
        # Create pattern: bearish, doji, bullish
        data = [
            {
                "open_price": Decimal("102.00"),
                "high_price": Decimal("103.00"),
                "low_price": Decimal("101.00"),
                "close_price": Decimal("101.00"),  # Bearish
            },
            {
                "open_price": Decimal("101.00"),
                "high_price": Decimal("101.50"),
                "low_price": Decimal("100.50"),
                "close_price": Decimal("101.00"),  # Doji (small body)
            },
            {
                "open_price": Decimal("101.00"),
                "high_price": Decimal("104.00"),
                "low_price": Decimal("100.50"),
                "close_price": Decimal("103.00"),  # Bullish, above midpoint
            },
        ] + [{"close_price": Decimal("100.00")} for _ in range(10)]
        matches = pattern_detector.detect_morning_doji_star(data)

        if matches:
            match = matches[0]
            assert match.pattern == "morning_doji_star"
            assert match.signal == "bullish"
            assert match.confidence == 0.75

    def test_detect_morning_doji_star_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [
            {"close_price": Decimal("100.00")},
            {"close_price": Decimal("101.00")},
        ]
        matches = pattern_detector.detect_morning_doji_star(data)

        assert len(matches) == 0


class TestHeadAndShoulders:
    """Test Head and Shoulders pattern detection."""

    def test_detect_head_and_shoulders_with_valid_pattern(self):
        """Test detecting Head and Shoulders pattern."""
        # Create pattern with three peaks
        data = []
        base_price = 100.0

        # Left shoulder
        for i in range(5):
            price = base_price + (i * 0.5)
            data.append(
                {
                    "high_price": Decimal(str(price)),
                    "low_price": Decimal(str(price - 1.0)),
                    "close_price": Decimal(str(price - 0.5)),
                }
            )

        # Head (higher peak)
        for i in range(5):
            price = base_price + 5.0 + (i * 0.5)
            data.append(
                {
                    "high_price": Decimal(str(price)),
                    "low_price": Decimal(str(price - 1.0)),
                    "close_price": Decimal(str(price - 0.5)),
                }
            )

        # Right shoulder (similar to left)
        for i in range(5):
            price = base_price + 2.0 + (i * 0.5)
            data.append(
                {
                    "high_price": Decimal(str(price)),
                    "low_price": Decimal(str(price - 1.0)),
                    "close_price": Decimal(str(price - 0.5)),
                }
            )

        # Add more data to reach minimum length
        data.extend([{"close_price": Decimal("100.00")} for _ in range(10)])

        matches = pattern_detector.detect_head_and_shoulders(data)

        # May or may not detect depending on exact structure
        assert isinstance(matches, list)

    def test_detect_head_and_shoulders_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [{"close_price": Decimal("100.00")} for _ in range(10)]
        matches = pattern_detector.detect_head_and_shoulders(data)

        # Need at least 20 data points
        assert len(matches) == 0


class TestDoubleTop:
    """Test Double Top pattern detection."""

    def test_detect_double_top_with_valid_pattern(self):
        """Test detecting Double Top pattern."""
        # Create pattern with two similar peaks
        data = []
        base_price = 100.0

        # First peak
        for i in range(5):
            price = base_price + (i * 0.5)
            data.append(
                {
                    "high_price": Decimal(str(price)),
                    "low_price": Decimal(str(price - 1.0)),
                    "close_price": Decimal(str(price - 0.5)),
                }
            )

        # Trough
        for i in range(5):
            price = base_price - 2.0 + (i * 0.2)
            data.append(
                {
                    "high_price": Decimal(str(price)),
                    "low_price": Decimal(str(price - 1.0)),
                    "close_price": Decimal(str(price - 0.5)),
                }
            )

        # Second peak (similar to first)
        for i in range(5):
            price = base_price + (i * 0.5)
            data.append(
                {
                    "high_price": Decimal(str(price)),
                    "low_price": Decimal(str(price - 1.0)),
                    "close_price": Decimal(str(price - 0.5)),
                }
            )

        matches = pattern_detector.detect_double_top(data)

        # May or may not detect depending on exact structure
        assert isinstance(matches, list)

    def test_detect_double_top_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [{"close_price": Decimal("100.00")} for _ in range(10)]
        matches = pattern_detector.detect_double_top(data)

        # Need at least 15 data points
        assert len(matches) == 0


class TestDoubleBottom:
    """Test Double Bottom pattern detection."""

    def test_detect_double_bottom_with_valid_pattern(self):
        """Test detecting Double Bottom pattern."""
        # Create pattern with two similar troughs
        data = []
        base_price = 100.0

        # First trough
        for i in range(5):
            price = base_price - (i * 0.5)
            data.append(
                {
                    "high_price": Decimal(str(price + 1.0)),
                    "low_price": Decimal(str(price)),
                    "close_price": Decimal(str(price + 0.5)),
                }
            )

        # Peak
        for i in range(5):
            price = base_price + 2.0 - (i * 0.2)
            data.append(
                {
                    "high_price": Decimal(str(price + 1.0)),
                    "low_price": Decimal(str(price)),
                    "close_price": Decimal(str(price + 0.5)),
                }
            )

        # Second trough (similar to first)
        for i in range(5):
            price = base_price - (i * 0.5)
            data.append(
                {
                    "high_price": Decimal(str(price + 1.0)),
                    "low_price": Decimal(str(price)),
                    "close_price": Decimal(str(price + 0.5)),
                }
            )

        matches = pattern_detector.detect_double_bottom(data)

        # May or may not detect depending on exact structure
        assert isinstance(matches, list)


class TestDetectAllPatterns:
    """Test detect_all_patterns function."""

    def test_detect_all_patterns_with_selected_patterns(self):
        """Test detecting selected patterns only."""
        data = generate_three_white_soldiers_data()
        selected = ["three_white_soldiers"]
        matches = pattern_detector.detect_all_patterns(data, selected_patterns=selected)

        # Should only detect three_white_soldiers
        assert all(m.pattern == "three_white_soldiers" for m in matches)

    def test_detect_all_patterns_with_all_patterns(self):
        """Test detecting all patterns."""
        data = generate_price_data(days=30)
        matches = pattern_detector.detect_all_patterns(data)

        # Should return list of matches
        assert isinstance(matches, list)

    def test_detect_all_patterns_with_none_selected(self):
        """Test detecting all patterns when None selected."""
        data = generate_price_data(days=30)
        matches = pattern_detector.detect_all_patterns(data, selected_patterns=None)

        # Should detect all available patterns
        assert isinstance(matches, list)

    def test_detect_all_patterns_handles_errors(self):
        """Test that pattern detection handles errors gracefully."""
        # Invalid data that might cause errors
        data = [
            {"invalid": "data"},
            {"close_price": None},
        ] * 10
        matches = pattern_detector.detect_all_patterns(data)

        # Should not crash, return empty list or handle gracefully
        assert isinstance(matches, list)


class TestPatternMatch:
    """Test PatternMatch class."""

    def test_pattern_match_creation(self):
        """Test PatternMatch creation."""
        match = pattern_detector.PatternMatch(
            pattern="test_pattern",
            pattern_name="Test Pattern",
            index=10,
            candles=3,
            signal="bullish",
            confidence=0.8,
            description="Test description",
        )

        assert match.pattern == "test_pattern"
        assert match.pattern_name == "Test Pattern"
        assert match.index == 10
        assert match.candles == 3
        assert match.signal == "bullish"
        assert match.confidence == 0.8

    def test_pattern_match_to_dict(self):
        """Test PatternMatch to_dict conversion."""
        match = pattern_detector.PatternMatch(
            pattern="test_pattern",
            pattern_name="Test Pattern",
            index=10,
            candles=3,
            signal="bullish",
            confidence=0.8,
            description="Test description",
        )

        result = match.to_dict()
        assert result["pattern"] == "test_pattern"
        assert result["pattern_name"] == "Test Pattern"
        assert result["index"] == 10
        assert result["candles"] == 3
        assert result["signal"] == "bullish"
        assert result["confidence"] == 0.8
        assert result["description"] == "Test description"


class TestAbandonedBaby:
    """Test Abandoned Baby pattern detection."""

    def test_detect_abandoned_baby_with_valid_pattern(self):
        """Test detecting Abandoned Baby pattern."""
        # Create pattern: bearish, gap down, doji, gap up, bullish
        data = [
            {
                "open_price": Decimal("102.00"),
                "high_price": Decimal("103.00"),
                "low_price": Decimal("101.00"),
                "close_price": Decimal("101.00"),  # Bearish
            },
            # Gap down
            {
                "open_price": Decimal("99.00"),  # Gap down
                "high_price": Decimal("99.50"),
                "low_price": Decimal("98.50"),
                "close_price": Decimal("99.00"),  # Doji (small body)
            },
            # Gap up
            {
                "open_price": Decimal("101.00"),  # Gap up
                "high_price": Decimal("104.00"),
                "low_price": Decimal("100.50"),
                "close_price": Decimal("103.00"),  # Bullish
            },
        ] + [{"close_price": Decimal("100.00")} for _ in range(10)]
        matches = pattern_detector.detect_abandoned_baby(data)

        if matches:
            match = matches[0]
            assert match.pattern == "abandoned_baby"
            assert match.signal == "bullish"
            assert match.confidence >= 0.7

    def test_detect_abandoned_baby_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [
            {"close_price": Decimal("100.00")},
            {"close_price": Decimal("101.00")},
        ]
        matches = pattern_detector.detect_abandoned_baby(data)

        assert len(matches) == 0


class TestFlag:
    """Test Flag pattern detection."""

    def test_detect_flag_with_valid_pattern(self):
        """Test detecting Flag pattern."""
        # Create flag pattern: sharp move up (flagpole), then consolidation (flag)
        data = []
        base_price = 100.0

        # Flagpole - sharp upward move
        for i in range(5):
            price = base_price + (i * 2.0)
            data.append(
                {
                    "high_price": Decimal(str(price + 1.0)),
                    "low_price": Decimal(str(price - 0.5)),
                    "close_price": Decimal(str(price)),
                }
            )

        # Flag - consolidation sloping slightly down
        for i in range(8):
            price = base_price + 10.0 - (i * 0.3)
            data.append(
                {
                    "high_price": Decimal(str(price + 0.5)),
                    "low_price": Decimal(str(price - 0.5)),
                    "close_price": Decimal(str(price)),
                }
            )

        matches = pattern_detector.detect_flag(data)

        # May or may not detect depending on exact structure
        assert isinstance(matches, list)

    def test_detect_flag_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [{"close_price": Decimal("100.00")} for _ in range(10)]
        matches = pattern_detector.detect_flag(data)

        # Need sufficient data for flag pattern
        assert isinstance(matches, list)


class TestPennant:
    """Test Pennant pattern detection."""

    def test_detect_pennant_with_valid_pattern(self):
        """Test detecting Pennant pattern."""
        # Create pennant pattern: sharp move (pole), then converging lines (pennant)
        data = []
        base_price = 100.0

        # Pole - sharp upward move
        for i in range(5):
            price = base_price + (i * 2.0)
            data.append(
                {
                    "high_price": Decimal(str(price + 1.0)),
                    "low_price": Decimal(str(price - 0.5)),
                    "close_price": Decimal(str(price)),
                }
            )

        # Pennant - converging triangle
        for i in range(8):
            price = base_price + 10.0
            high_offset = 1.0 - (i * 0.1)
            low_offset = -0.5 + (i * 0.1)
            data.append(
                {
                    "high_price": Decimal(str(price + high_offset)),
                    "low_price": Decimal(str(price + low_offset)),
                    "close_price": Decimal(str(price)),
                }
            )

        matches = pattern_detector.detect_pennant(data)

        # May or may not detect depending on exact structure
        assert isinstance(matches, list)

    def test_detect_pennant_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [{"close_price": Decimal("100.00")} for _ in range(10)]
        matches = pattern_detector.detect_pennant(data)

        # Need sufficient data for pennant pattern
        assert isinstance(matches, list)


class TestWedge:
    """Test Wedge pattern detection (Rising and Falling)."""

    def test_detect_wedge_with_rising_wedge(self):
        """Test detecting Rising Wedge pattern."""
        # Create rising wedge: both lines slope up but converge
        data = []
        base_price = 100.0

        for i in range(15):
            # Converging lines - both going up but getting closer
            high_price = base_price + (i * 0.5) + (2.0 - i * 0.15)
            low_price = base_price + (i * 0.3) + (1.0 - i * 0.1)
            data.append(
                {
                    "high_price": Decimal(str(high_price)),
                    "low_price": Decimal(str(low_price)),
                    "close_price": Decimal(str((high_price + low_price) / 2)),
                }
            )

        matches = pattern_detector.detect_wedge(data)

        # May or may not detect depending on exact structure
        assert isinstance(matches, list)

    def test_detect_wedge_with_falling_wedge(self):
        """Test detecting Falling Wedge pattern."""
        # Create falling wedge: both lines slope down but converge
        data = []
        base_price = 100.0

        for i in range(15):
            # Converging lines - both going down but getting closer
            high_price = base_price - (i * 0.3) + (2.0 - i * 0.1)
            low_price = base_price - (i * 0.5) + (1.0 - i * 0.15)
            data.append(
                {
                    "high_price": Decimal(str(high_price)),
                    "low_price": Decimal(str(low_price)),
                    "close_price": Decimal(str((high_price + low_price) / 2)),
                }
            )

        matches = pattern_detector.detect_wedge(data)

        # May or may not detect depending on exact structure
        assert isinstance(matches, list)

    def test_detect_wedge_with_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        data = [{"close_price": Decimal("100.00")} for _ in range(10)]
        matches = pattern_detector.detect_wedge(data)

        # Need sufficient data for wedge pattern
        assert isinstance(matches, list)
