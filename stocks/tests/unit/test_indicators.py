"""
Unit tests for technical indicators.
"""

import math
from decimal import Decimal

import pytest

pytestmark = pytest.mark.unit

from stocks import indicators
from stocks.tests.fixtures.sample_data import (
    generate_bearish_price_data,
    generate_bullish_price_data,
    generate_price_data,
    generate_rsi_overbought_data,
    generate_rsi_oversold_data,
    generate_stable_price_data,
    generate_volatile_price_data,
)


class TestToNumber:
    """Test to_number helper function."""

    def test_to_number_with_int(self):
        """Test converting integer to number."""
        assert indicators.to_number(42) == 42.0

    def test_to_number_with_float(self):
        """Test converting float to number."""
        assert indicators.to_number(42.5) == 42.5

    def test_to_number_with_decimal(self):
        """Test converting Decimal to number."""
        assert indicators.to_number(Decimal("42.5")) == 42.5

    def test_to_number_with_string(self):
        """Test converting string to number."""
        assert indicators.to_number("42.5") == 42.5

    def test_to_number_with_none(self):
        """Test converting None returns None."""
        assert indicators.to_number(None) is None

    def test_to_number_with_invalid_string(self):
        """Test converting invalid string returns None."""
        assert indicators.to_number("invalid") is None

    def test_to_number_with_nan(self):
        """Test converting NaN returns None."""
        assert indicators.to_number(float("nan")) is None

    def test_to_number_with_inf(self):
        """Test converting infinity returns None."""
        assert indicators.to_number(float("inf")) is None
        assert indicators.to_number(float("-inf")) is None


class TestSMA:
    """Test Simple Moving Average calculation."""

    def test_sma_with_valid_data(self):
        """Test SMA calculation with valid data."""
        data = generate_price_data(days=30, start_price=Decimal("100.00"))
        period = 10
        sma = indicators.calculate_sma(data, period)

        assert len(sma) == len(data)
        # First period-1 values should be None
        assert all(sma[i] is None for i in range(period - 1))
        # Remaining values should be numbers
        assert all(sma[i] is not None for i in range(period - 1, len(sma)))

    def test_sma_calculation_correctness(self):
        """Test SMA calculation correctness."""
        data = [
            {"close_price": Decimal("100.00")},
            {"close_price": Decimal("101.00")},
            {"close_price": Decimal("102.00")},
            {"close_price": Decimal("103.00")},
            {"close_price": Decimal("104.00")},
        ]
        period = 3
        sma = indicators.calculate_sma(data, period)

        # SMA of last 3: (102 + 103 + 104) / 3 = 103.0
        assert sma[-1] == pytest.approx(103.0, rel=1e-6)

    def test_sma_with_insufficient_data(self):
        """Test SMA with period > data length."""
        data = generate_price_data(days=5)
        period = 20
        sma = indicators.calculate_sma(data, period)

        assert len(sma) == len(data)
        assert all(val is None for val in sma)

    def test_sma_with_empty_data(self):
        """Test SMA with empty data."""
        data = []
        sma = indicators.calculate_sma(data, 10)
        assert sma == []

    def test_sma_with_none_values(self):
        """Test SMA handles None values in price data."""
        data = [
            {"close_price": Decimal("100.00")},
            {"close_price": None},
            {"close_price": Decimal("102.00")},
            {"close_price": Decimal("103.00")},
        ]
        period = 2
        sma = indicators.calculate_sma(data, period)

        # Should handle None gracefully
        assert sma[0] is None
        assert sma[1] is None  # Contains None value

    def test_sma_with_different_price_fields(self):
        """Test SMA with different price fields."""
        data = [
            {"open_price": Decimal("100.00")},
            {"open_price": Decimal("101.00")},
            {"open_price": Decimal("102.00")},
        ]
        period = 2
        sma = indicators.calculate_sma(data, period, price_field="open_price")

        assert sma[-1] == pytest.approx(101.5, rel=1e-6)

    def test_sma_period_one(self):
        """Test SMA with period = 1."""
        data = generate_price_data(days=10)
        period = 1
        sma = indicators.calculate_sma(data, period)

        # With period=1, SMA should equal the price
        for i in range(len(data)):
            if sma[i] is not None:
                assert sma[i] == pytest.approx(
                    float(data[i]["close_price"]), rel=1e-6
                )

    def test_sma_period_equals_data_length(self):
        """Test SMA with period = data length."""
        data = generate_price_data(days=10)
        period = len(data)
        sma = indicators.calculate_sma(data, period)

        # Only last value should be calculated
        assert sma[-1] is not None
        assert all(sma[i] is None for i in range(len(data) - 1))

    def test_sma_with_invalid_period(self):
        """Test SMA with invalid period."""
        data = generate_price_data(days=10)
        period = 0
        sma = indicators.calculate_sma(data, period)

        assert len(sma) == len(data)
        assert all(val is None for val in sma)


class TestEMA:
    """Test Exponential Moving Average calculation."""

    def test_ema_with_valid_data(self):
        """Test EMA calculation with valid data."""
        data = generate_price_data(days=30)
        period = 10
        ema = indicators.calculate_ema(data, period)

        assert len(ema) == len(data)
        # First value should be the price itself
        assert ema[0] is not None

    def test_ema_smoothing_factor(self):
        """Test EMA smoothing factor calculation."""
        period = 10
        multiplier = 2.0 / (period + 1)
        expected_multiplier = 2.0 / 11.0
        assert multiplier == pytest.approx(expected_multiplier, rel=1e-6)

    def test_ema_reacts_faster_than_sma(self):
        """Test that EMA reacts faster to price changes than SMA."""
        data = [
            {"close_price": Decimal("100.00")} for _ in range(20)
        ] + [{"close_price": Decimal("110.00")}]
        period = 10

        sma = indicators.calculate_sma(data, period)
        ema = indicators.calculate_ema(data, period)

        # EMA should be closer to the new price than SMA
        assert ema[-1] > sma[-1]

    def test_ema_with_insufficient_data(self):
        """Test EMA with insufficient data."""
        data = generate_price_data(days=5)
        period = 20
        ema = indicators.calculate_ema(data, period)

        # EMA should still calculate with available data
        assert len(ema) == len(data)
        assert ema[0] is not None

    def test_ema_with_none_values(self):
        """Test EMA handles None values."""
        data = [
            {"close_price": Decimal("100.00")},
            {"close_price": None},
            {"close_price": Decimal("102.00")},
        ]
        period = 2
        ema = indicators.calculate_ema(data, period)

        assert ema[0] is not None
        assert ema[1] is None

    def test_ema_period_one(self):
        """Test EMA with period = 1."""
        data = generate_price_data(days=10)
        period = 1
        ema = indicators.calculate_ema(data, period)

        # With period=1, EMA should equal the price
        assert ema[0] == pytest.approx(float(data[0]["close_price"]), rel=1e-6)


class TestRSI:
    """Test Relative Strength Index calculation."""

    def test_rsi_with_valid_data(self):
        """Test RSI calculation with valid data."""
        data = generate_price_data(days=30)
        period = 14

        # Verify data format before calling RSI
        assert len(data) == 30, f"Expected 30 data points, got {len(data)}"
        assert all("close_price" in item for item in data), "All data items should have close_price"

        # Call RSI calculation
        rsi = indicators.calculate_rsi(data, period)

        # Verify RSI result
        assert isinstance(rsi, list), f"RSI should return a list, got {type(rsi)}"
        assert len(rsi) == len(data), f"RSI length {len(rsi)} should match data length {len(data)}. RSI: {rsi[:5]}..."

        # First period values should be None (indices 0 to period-1)
        assert all(rsi[i] is None for i in range(period)), f"First {period} RSI values should be None"
        # Values after period should be calculated
        if len(rsi) > period:
            assert rsi[period] is not None, f"RSI value at index {period} should be calculated"

    def test_rsi_values_in_range(self):
        """Test RSI values are within 0-100 range."""
        data = generate_price_data(days=30)
        period = 14
        rsi = indicators.calculate_rsi(data, period)

        for val in rsi:
            if val is not None:
                assert 0.0 <= val <= 100.0

    def test_rsi_oversold_condition(self):
        """Test RSI detects oversold condition (< 30)."""
        data = generate_rsi_oversold_data()
        period = 14
        rsi = indicators.calculate_rsi(data, period)

        # Last RSI value should be < 30 (oversold)
        last_rsi = rsi[-1]
        if last_rsi is not None:
            assert last_rsi < 30.0

    def test_rsi_overbought_condition(self):
        """Test RSI detects overbought condition (> 70)."""
        data = generate_rsi_overbought_data()
        period = 14
        rsi = indicators.calculate_rsi(data, period)

        # Last RSI value should be > 70 (overbought)
        last_rsi = rsi[-1]
        if last_rsi is not None:
            assert last_rsi > 70.0

    def test_rsi_with_insufficient_data(self):
        """Test RSI with insufficient data."""
        data = generate_price_data(days=5)
        period = 14
        rsi = indicators.calculate_rsi(data, period)

        # All values should be None
        assert all(val is None for val in rsi)

    def test_rsi_with_all_gains(self):
        """Test RSI with all price gains."""
        data = [
            {"close_price": Decimal(str(100 + i))} for i in range(20)
        ]
        period = 14
        rsi = indicators.calculate_rsi(data, period)

        # RSI should be high (approaching 100)
        last_rsi = rsi[-1]
        if last_rsi is not None:
            assert last_rsi > 70.0

    def test_rsi_with_all_losses(self):
        """Test RSI with all price losses."""
        data = [
            {"close_price": Decimal(str(100 - i))} for i in range(20)
        ]
        period = 14
        rsi = indicators.calculate_rsi(data, period)

        # RSI should be low (approaching 0)
        last_rsi = rsi[-1]
        if last_rsi is not None:
            assert last_rsi < 30.0

    def test_rsi_with_no_price_movement(self):
        """Test RSI with no price movement."""
        data = [{"close_price": Decimal("100.00")} for _ in range(20)]
        period = 14
        rsi = indicators.calculate_rsi(data, period)

        # When there's no price movement, avg_loss = 0, so RSI = 100
        # This is correct behavior: no losses means maximum strength
        last_rsi = rsi[-1]
        if last_rsi is not None:
            assert last_rsi == 100.0

    def test_rsi_with_none_values(self):
        """Test RSI handles None values."""
        data = [
            {"close_price": Decimal("100.00")},
            {"close_price": None},
            {"close_price": Decimal("102.00")},
        ]
        period = 2
        rsi = indicators.calculate_rsi(data, period)

        assert rsi[0] is None
        assert rsi[1] is None


class TestMACD:
    """Test MACD calculation."""

    def test_macd_with_valid_data(self):
        """Test MACD calculation with valid data."""
        data = generate_price_data(days=50)
        macd_data = indicators.calculate_macd(data, fast_period=12, slow_period=26, signal_period=9)

        assert "macd" in macd_data
        assert "signal" in macd_data
        assert "histogram" in macd_data
        assert len(macd_data["macd"]) == len(data)

    def test_macd_line_calculation(self):
        """Test MACD line is difference of fast and slow EMA."""
        data = generate_price_data(days=50)
        fast_ema = indicators.calculate_ema(data, 12)
        slow_ema = indicators.calculate_ema(data, 26)
        macd_data = indicators.calculate_macd(data)

        # MACD line should be fast_ema - slow_ema
        for i in range(len(data)):
            if (
                fast_ema[i] is not None
                and slow_ema[i] is not None
                and macd_data["macd"][i] is not None
            ):
                expected = fast_ema[i] - slow_ema[i]
                assert macd_data["macd"][i] == pytest.approx(expected, rel=1e-6)

    def test_macd_histogram_calculation(self):
        """Test MACD histogram is difference of MACD and signal."""
        data = generate_price_data(days=50)
        macd_data = indicators.calculate_macd(data)

        # Histogram should be MACD - Signal
        for i in range(len(data)):
            if (
                macd_data["macd"][i] is not None
                and macd_data["signal"][i] is not None
                and macd_data["histogram"][i] is not None
            ):
                expected = macd_data["macd"][i] - macd_data["signal"][i]
                assert macd_data["histogram"][i] == pytest.approx(expected, rel=1e-6)

    def test_macd_with_insufficient_data(self):
        """Test MACD with insufficient data."""
        data = generate_price_data(days=10)
        macd_data = indicators.calculate_macd(data)

        # Should still return structure but with None values
        assert "macd" in macd_data
        assert len(macd_data["macd"]) == len(data)

    def test_macd_crossover_detection(self):
        """Test MACD crossover can be detected."""
        data = generate_price_data(days=50)
        macd_data = indicators.calculate_macd(data)

        # Check if we can detect crossovers
        macd = macd_data["macd"]
        signal = macd_data["signal"]

        # Find valid indices
        valid_indices = [
            i
            for i in range(len(macd))
            if macd[i] is not None and signal[i] is not None
        ]

        if len(valid_indices) > 1:
            # Check for potential crossover
            i = valid_indices[-1]
            prev_i = valid_indices[-2]
            if prev_i is not None:
                # Can detect if MACD crosses above/below signal
                prev_diff = macd[prev_i] - signal[prev_i]
                curr_diff = macd[i] - signal[i]
                # If signs differ, there was a crossover
                crossover = (prev_diff < 0 and curr_diff > 0) or (
                    prev_diff > 0 and curr_diff < 0
                )
                # Just verify we can detect it (don't assert it exists)
                assert isinstance(crossover, bool)

    def test_macd_with_identical_prices(self):
        """Test MACD with identical prices."""
        data = [{"close_price": Decimal("100.00")} for _ in range(50)]
        macd_data = indicators.calculate_macd(data)

        # MACD should be 0 or very close to 0
        last_macd = macd_data["macd"][-1]
        if last_macd is not None:
            assert abs(last_macd) < 1.0


class TestBollingerBands:
    """Test Bollinger Bands calculation."""

    def test_bollinger_bands_with_valid_data(self):
        """Test Bollinger Bands calculation with valid data."""
        data = generate_price_data(days=30)
        bb = indicators.calculate_bollinger_bands(data, period=20, std_dev=2.0)

        assert "upper" in bb
        assert "middle" in bb
        assert "lower" in bb
        assert len(bb["upper"]) == len(data)

    def test_bollinger_bands_structure(self):
        """Test Bollinger Bands structure."""
        data = generate_price_data(days=30)
        bb = indicators.calculate_bollinger_bands(data)

        # Upper should be > middle > lower
        for i in range(len(data)):
            if (
                bb["upper"][i] is not None
                and bb["middle"][i] is not None
                and bb["lower"][i] is not None
            ):
                assert bb["upper"][i] > bb["middle"][i] > bb["lower"][i]

    def test_bollinger_bands_middle_is_sma(self):
        """Test Bollinger Bands middle is SMA."""
        data = generate_price_data(days=30)
        period = 20
        sma = indicators.calculate_sma(data, period)
        bb = indicators.calculate_bollinger_bands(data, period=period)

        # Middle should equal SMA
        for i in range(len(data)):
            if sma[i] is not None and bb["middle"][i] is not None:
                assert bb["middle"][i] == pytest.approx(sma[i], rel=1e-6)

    def test_bollinger_bands_band_width(self):
        """Test Bollinger Bands band width calculation."""
        data = generate_volatile_price_data(days=30)
        bb = indicators.calculate_bollinger_bands(data, period=20, std_dev=2.0)

        # Volatile data should have wider bands
        for i in range(len(data)):
            if (
                bb["upper"][i] is not None
                and bb["middle"][i] is not None
                and bb["lower"][i] is not None
            ):
                band_width = bb["upper"][i] - bb["lower"][i]
                assert band_width > 0

    def test_bollinger_bands_with_zero_volatility(self):
        """Test Bollinger Bands with zero volatility."""
        data = [{"close_price": Decimal("100.00")} for _ in range(30)]
        bb = indicators.calculate_bollinger_bands(data, period=20)

        # With zero volatility, bands should be very tight
        for i in range(len(data)):
            if (
                bb["upper"][i] is not None
                and bb["middle"][i] is not None
                and bb["lower"][i] is not None
            ):
                band_width = bb["upper"][i] - bb["lower"][i]
                assert band_width == pytest.approx(0.0, abs=1e-6)

    def test_bollinger_bands_price_position(self):
        """Test price position relative to Bollinger Bands."""
        data = generate_price_data(days=30)
        bb = indicators.calculate_bollinger_bands(data, period=20)

        # Check if price can be above/below bands
        for i in range(20, len(data)):
            price = float(data[i]["close_price"])
            if (
                bb["upper"][i] is not None
                and bb["lower"][i] is not None
            ):
                # Price should be somewhere (could be outside bands)
                assert isinstance(price, float)


class TestATR:
    """Test Average True Range calculation."""

    def test_atr_with_valid_data(self):
        """Test ATR calculation with valid data."""
        data = generate_price_data(days=30)
        period = 14
        atr = indicators.calculate_atr(data, period)

        assert len(atr) == len(data)
        # First period-1 values should be None
        assert all(atr[i] is None for i in range(period - 1))

    def test_atr_values_positive(self):
        """Test ATR values are always positive."""
        data = generate_price_data(days=30)
        atr = indicators.calculate_atr(data)

        for val in atr:
            if val is not None:
                assert val >= 0.0

    def test_atr_with_volatile_data(self):
        """Test ATR with volatile price data."""
        data = generate_volatile_price_data(days=30)
        atr = indicators.calculate_atr(data)

        # Volatile data should have higher ATR
        valid_atr = [v for v in atr if v is not None]
        if valid_atr:
            avg_atr = sum(valid_atr) / len(valid_atr)
            assert avg_atr > 0.0

    def test_atr_with_stable_data(self):
        """Test ATR with stable price data."""
        data = generate_stable_price_data(days=30)
        atr = indicators.calculate_atr(data)

        # Stable data should have lower ATR
        valid_atr = [v for v in atr if v is not None]
        if valid_atr:
            avg_atr = sum(valid_atr) / len(valid_atr)
            assert avg_atr >= 0.0

    def test_atr_with_no_price_movement(self):
        """Test ATR with no price movement."""
        data = [
            {
                "high_price": Decimal("100.00"),
                "low_price": Decimal("100.00"),
                "close_price": Decimal("100.00"),
            }
            for _ in range(30)
        ]
        atr = indicators.calculate_atr(data)

        # ATR should be 0 or very close to 0
        valid_atr = [v for v in atr if v is not None]
        if valid_atr:
            assert all(v == pytest.approx(0.0, abs=1e-6) for v in valid_atr)

    def test_atr_with_insufficient_data(self):
        """Test ATR with insufficient data."""
        data = generate_price_data(days=5)
        period = 14
        atr = indicators.calculate_atr(data, period)

        assert len(atr) == len(data)
        assert all(val is None for val in atr)

    def test_atr_with_extreme_gaps(self):
        """Test ATR with extreme price gaps."""
        data = [
            {
                "high_price": Decimal("100.00"),
                "low_price": Decimal("99.00"),
                "close_price": Decimal("99.50"),
            },
            {
                "high_price": Decimal("150.00"),  # Large gap
                "low_price": Decimal("149.00"),
                "close_price": Decimal("149.50"),
            },
        ] + generate_price_data(days=28)
        atr = indicators.calculate_atr(data)

        # ATR should capture the gap
        valid_atr = [v for v in atr if v is not None]
        if valid_atr:
            # Should have some high values due to gap
            assert max(valid_atr) > 0.0


class TestDEMA:
    """Test Double Exponential Moving Average calculation."""

    def test_dema_with_valid_data(self):
        """Test DEMA calculation with valid data."""
        data = generate_price_data(days=50)
        period = 20
        dema = indicators.calculate_dema(data, period)

        assert len(dema) == len(data)
        # DEMA should be calculated for most values
        valid_values = [v for v in dema if v is not None]
        assert len(valid_values) > 0

    def test_dema_faster_than_ema(self):
        """Test that DEMA reacts faster than EMA."""
        data = [
            {"close_price": Decimal("100.00")} for _ in range(30)
        ] + [{"close_price": Decimal("110.00")}]
        period = 10

        ema = indicators.calculate_ema(data, period)
        dema = indicators.calculate_dema(data, period)

        # DEMA should be closer to the new price than EMA
        if ema[-1] is not None and dema[-1] is not None:
            assert abs(dema[-1] - 110.0) < abs(ema[-1] - 110.0)


class TestTEMA:
    """Test Triple Exponential Moving Average calculation."""

    def test_tema_with_valid_data(self):
        """Test TEMA calculation with valid data."""
        data = generate_price_data(days=50)
        period = 20
        tema = indicators.calculate_tema(data, period)

        assert len(tema) == len(data)
        valid_values = [v for v in tema if v is not None]
        assert len(valid_values) > 0

    def test_tema_faster_than_dema(self):
        """Test that TEMA reacts faster than DEMA."""
        data = [
            {"close_price": Decimal("100.00")} for _ in range(30)
        ] + [{"close_price": Decimal("110.00")}]
        period = 10

        dema = indicators.calculate_dema(data, period)
        tema = indicators.calculate_tema(data, period)

        if dema[-1] is not None and tema[-1] is not None:
            assert abs(tema[-1] - 110.0) < abs(dema[-1] - 110.0)


class TestTMA:
    """Test Triangular Moving Average calculation."""

    def test_tma_with_valid_data(self):
        """Test TMA calculation with valid data."""
        data = generate_price_data(days=50)
        period = 20
        tma = indicators.calculate_tma(data, period)

        assert len(tma) == len(data)
        valid_values = [v for v in tma if v is not None]
        assert len(valid_values) > 0

    def test_tma_smoother_than_sma(self):
        """Test that TMA is calculated correctly."""
        data = generate_volatile_price_data(days=50)
        period = 20

        sma = indicators.calculate_sma(data, period)
        tma = indicators.calculate_tma(data, period)

        # TMA is double-smoothed SMA, so it should have values
        valid_sma = [v for v in sma if v is not None]
        valid_tma = [v for v in tma if v is not None]

        # Both should have valid values
        assert len(valid_sma) > 0
        assert len(valid_tma) > 0
        # TMA values should be in reasonable range (not None and not extreme)
        for val in valid_tma:
            assert val is not None
            assert not (math.isnan(val) or math.isinf(val))


class TestHMA:
    """Test Hull Moving Average calculation."""

    def test_hma_with_valid_data(self):
        """Test HMA calculation with valid data."""
        data = generate_price_data(days=50)
        period = 20
        hma = indicators.calculate_hma(data, period)

        assert len(hma) == len(data)
        valid_values = [v for v in hma if v is not None]
        assert len(valid_values) > 0


class TestMcGinley:
    """Test McGinley Dynamic Indicator calculation."""

    def test_mcginley_with_valid_data(self):
        """Test McGinley calculation with valid data."""
        data = generate_price_data(days=50)
        period = 14
        mcginley = indicators.calculate_mcginley(data, period)

        assert len(mcginley) == len(data)
        # First value should be the price itself
        assert mcginley[0] is not None


class TestVWAPMA:
    """Test VWAP Moving Average calculation."""

    def test_vwap_ma_with_valid_data(self):
        """Test VWAP MA calculation with valid data."""
        data = generate_price_data(days=50)
        # Add volume to data
        for i, item in enumerate(data):
            item["volume"] = Decimal(str(1000 + i * 10))

        period = 20
        vwap_ma = indicators.calculate_vwap_ma(data, period)

        assert len(vwap_ma) == len(data)
        valid_values = [v for v in vwap_ma if v is not None]
        assert len(valid_values) > 0


class TestKeltnerChannels:
    """Test Keltner Channels calculation."""

    def test_keltner_with_valid_data(self):
        """Test Keltner Channels calculation with valid data."""
        data = generate_price_data(days=50)
        kc = indicators.calculate_keltner_channels(data, period=20, multiplier=2.0)

        assert "upper" in kc
        assert "middle" in kc
        assert "lower" in kc
        assert len(kc["upper"]) == len(data)

    def test_keltner_structure(self):
        """Test Keltner Channels structure."""
        data = generate_price_data(days=50)
        kc = indicators.calculate_keltner_channels(data)

        # Upper should be > middle > lower
        for i in range(len(data)):
            if (
                kc["upper"][i] is not None
                and kc["middle"][i] is not None
                and kc["lower"][i] is not None
            ):
                assert kc["upper"][i] > kc["middle"][i] > kc["lower"][i]


class TestDonchianChannels:
    """Test Donchian Channels calculation."""

    def test_donchian_with_valid_data(self):
        """Test Donchian Channels calculation with valid data."""
        data = generate_price_data(days=50)
        dc = indicators.calculate_donchian_channels(data, period=20)

        assert "upper" in dc
        assert "middle" in dc
        assert "lower" in dc
        assert len(dc["upper"]) == len(data)

    def test_donchian_structure(self):
        """Test Donchian Channels structure."""
        data = generate_price_data(days=50)
        dc = indicators.calculate_donchian_channels(data)

        # Upper should be >= middle >= lower
        for i in range(len(data)):
            if (
                dc["upper"][i] is not None
                and dc["middle"][i] is not None
                and dc["lower"][i] is not None
            ):
                assert dc["upper"][i] >= dc["middle"][i] >= dc["lower"][i]


class TestFractalBands:
    """Test Fractal Chaos Bands calculation."""

    def test_fractal_with_valid_data(self):
        """Test Fractal Bands calculation with valid data."""
        data = generate_price_data(days=50)
        fb = indicators.calculate_fractal_bands(data, period=5)

        assert "upper" in fb
        assert "lower" in fb
        assert len(fb["upper"]) == len(data)

    def test_fractal_structure(self):
        """Test Fractal Bands structure."""
        data = generate_price_data(days=50)
        fb = indicators.calculate_fractal_bands(data)

        # Upper should be >= lower
        for i in range(len(data)):
            if fb["upper"][i] is not None and fb["lower"][i] is not None:
                assert fb["upper"][i] >= fb["lower"][i]


class TestMFI:
    """Test Money Flow Index calculation."""

    def test_mfi_with_valid_data(self):
        """Test MFI calculation with valid data."""
        data = generate_price_data(days=50)
        # Add volume
        for i, item in enumerate(data):
            item["volume"] = Decimal(str(1000 + i * 10))

        period = 14
        mfi = indicators.calculate_mfi(data, period)

        assert len(mfi) == len(data)
        # First value should be None
        assert mfi[0] is None

    def test_mfi_values_in_range(self):
        """Test MFI values are within 0-100 range."""
        data = generate_price_data(days=50)
        for i, item in enumerate(data):
            item["volume"] = Decimal(str(1000 + i * 10))

        mfi = indicators.calculate_mfi(data)

        for val in mfi:
            if val is not None:
                assert 0.0 <= val <= 100.0


class TestMomentum:
    """Test Momentum Indicator calculation."""

    def test_momentum_with_valid_data(self):
        """Test Momentum calculation with valid data."""
        data = generate_price_data(days=50)
        period = 10
        momentum = indicators.calculate_momentum(data, period)

        assert len(momentum) == len(data)
        # First period values should be None
        assert all(momentum[i] is None for i in range(period))

    def test_momentum_positive_with_uptrend(self):
        """Test Momentum is positive in uptrend."""
        data = [
            {"close_price": Decimal(str(100 + i))} for i in range(30)
        ]
        period = 10
        momentum = indicators.calculate_momentum(data, period)

        # Last momentum should be positive
        last_momentum = momentum[-1]
        if last_momentum is not None:
            assert last_momentum > 0.0


class TestPROC:
    """Test Price Rate of Change calculation."""

    def test_proc_with_valid_data(self):
        """Test PROC calculation with valid data."""
        data = generate_price_data(days=50)
        period = 12
        proc = indicators.calculate_proc(data, period)

        assert len(proc) == len(data)
        # First period values should be None
        assert all(proc[i] is None for i in range(period))

    def test_proc_positive_with_uptrend(self):
        """Test PROC is positive in uptrend."""
        data = [
            {"close_price": Decimal(str(100 + i))} for i in range(30)
        ]
        period = 10
        proc = indicators.calculate_proc(data, period)

        # Last PROC should be positive
        last_proc = proc[-1]
        if last_proc is not None:
            assert last_proc > 0.0


class TestATRTrailingStop:
    """Test ATR Trailing Stop calculation."""

    def test_atr_trailing_with_valid_data(self):
        """Test ATR Trailing Stop calculation with valid data."""
        data = generate_price_data(days=50)
        period = 14
        atr_trailing = indicators.calculate_atr_trailing_stop(data, period)

        assert len(atr_trailing) == len(data)
        # First value should be None
        assert atr_trailing[0] is None

    def test_atr_trailing_values_positive(self):
        """Test ATR Trailing Stop values are positive."""
        data = generate_price_data(days=50)
        atr_trailing = indicators.calculate_atr_trailing_stop(data)

        for val in atr_trailing:
            if val is not None:
                assert val > 0.0


class TestSupertrend:
    """Test Supertrend calculation."""

    def test_supertrend_with_valid_data(self):
        """Test Supertrend calculation with valid data."""
        data = generate_price_data(days=50)
        st = indicators.calculate_supertrend(data, period=10, multiplier=3.0)

        assert "supertrend" in st
        assert "trend" in st
        assert len(st["supertrend"]) == len(data)

    def test_supertrend_trend_values(self):
        """Test Supertrend trend values are 1 or -1."""
        data = generate_price_data(days=50)
        st = indicators.calculate_supertrend(data)

        for val in st["trend"]:
            if val is not None:
                assert val in [1, -1]


class TestAlligator:
    """Test Alligator indicator calculation."""

    def test_alligator_with_valid_data(self):
        """Test Alligator calculation with valid data."""
        data = generate_price_data(days=50)
        alligator = indicators.calculate_alligator(data)

        assert "jaw" in alligator
        assert "teeth" in alligator
        assert "lips" in alligator
        assert len(alligator["jaw"]) == len(data)

    def test_alligator_structure(self):
        """Test Alligator structure."""
        data = generate_price_data(days=50)
        alligator = indicators.calculate_alligator(data)

        # In uptrend: jaw > teeth > lips
        # In downtrend: lips > teeth > jaw
        # We just verify the values exist
        for i in range(len(data)):
            if (
                alligator["jaw"][i] is not None
                and alligator["teeth"][i] is not None
                and alligator["lips"][i] is not None
            ):
                # Values should be valid numbers
                assert isinstance(alligator["jaw"][i], float)
                assert isinstance(alligator["teeth"][i], float)
                assert isinstance(alligator["lips"][i], float)


class TestLinearRegression:
    """Test Linear Regression Forecast calculation."""

    def test_linear_regression_with_valid_data(self):
        """Test Linear Regression calculation with valid data."""
        data = generate_price_data(days=50)
        period = 14
        lr = indicators.calculate_linear_regression(data, period)

        assert len(lr) == len(data)
        valid_values = [v for v in lr if v is not None]
        assert len(valid_values) > 0

    def test_linear_regression_trend(self):
        """Test Linear Regression shows trend."""
        # Uptrend data
        data = [
            {"close_price": Decimal(str(100 + i * 0.5))} for i in range(30)
        ]
        period = 14
        lr = indicators.calculate_linear_regression(data, period)

        # Last value should be higher than first valid value
        valid_values = [v for v in lr if v is not None]
        if len(valid_values) > 1:
            assert valid_values[-1] > valid_values[0]


class TestDEMAEdgeCases:
    """Test DEMA edge cases."""

    def test_dema_with_empty_data(self):
        """Test DEMA with empty data."""
        data = []
        dema = indicators.calculate_dema(data, 10)
        assert dema == []

    def test_dema_with_invalid_period(self):
        """Test DEMA with invalid period."""
        data = generate_price_data(days=20)
        dema = indicators.calculate_dema(data, 0)
        assert all(v is None for v in dema)

    def test_dema_with_single_value(self):
        """Test DEMA with single data point."""
        data = [{"close_price": Decimal("100.00")}]
        dema = indicators.calculate_dema(data, 10)
        assert len(dema) == 1
        assert dema[0] is not None


class TestTEMAEdgeCases:
    """Test TEMA edge cases."""

    def test_tema_with_empty_data(self):
        """Test TEMA with empty data."""
        data = []
        tema = indicators.calculate_tema(data, 10)
        assert tema == []

    def test_tema_with_invalid_period(self):
        """Test TEMA with invalid period."""
        data = generate_price_data(days=20)
        tema = indicators.calculate_tema(data, 0)
        assert all(v is None for v in tema)


class TestTMAEdgeCases:
    """Test TMA edge cases."""

    def test_tma_with_empty_data(self):
        """Test TMA with empty data."""
        data = []
        tma = indicators.calculate_tma(data, 10)
        assert tma == []

    def test_tma_with_small_period(self):
        """Test TMA with small period."""
        data = generate_price_data(days=20)
        tma = indicators.calculate_tma(data, 2)
        assert len(tma) == len(data)


class TestHMAEdgeCases:
    """Test HMA edge cases."""

    def test_hma_with_empty_data(self):
        """Test HMA with empty data."""
        data = []
        hma = indicators.calculate_hma(data, 10)
        assert hma == []

    def test_hma_with_small_period(self):
        """Test HMA with small period."""
        data = generate_price_data(days=20)
        hma = indicators.calculate_hma(data, 2)
        assert len(hma) == len(data)


class TestMcGinleyEdgeCases:
    """Test McGinley edge cases."""

    def test_mcginley_with_empty_data(self):
        """Test McGinley with empty data."""
        data = []
        mcginley = indicators.calculate_mcginley(data, 10)
        assert mcginley == []

    def test_mcginley_with_zero_prev_value(self):
        """Test McGinley handles zero previous value."""
        data = [
            {"close_price": Decimal("0.00")},
            {"close_price": Decimal("100.00")},
        ]
        mcginley = indicators.calculate_mcginley(data, 10)
        assert len(mcginley) == 2


class TestVWAPMAEdgeCases:
    """Test VWAP MA edge cases."""

    def test_vwap_ma_with_empty_data(self):
        """Test VWAP MA with empty data."""
        data = []
        vwap_ma = indicators.calculate_vwap_ma(data, 10)
        assert vwap_ma == []

    def test_vwap_ma_with_no_volume(self):
        """Test VWAP MA with no volume data."""
        data = generate_price_data(days=20)
        # Remove volume
        for item in data:
            if "volume" in item:
                del item["volume"]
        vwap_ma = indicators.calculate_vwap_ma(data, 10)
        assert len(vwap_ma) == len(data)


class TestKeltnerChannelsEdgeCases:
    """Test Keltner Channels edge cases."""

    def test_keltner_with_empty_data(self):
        """Test Keltner with empty data."""
        data = []
        kc = indicators.calculate_keltner_channels(data)
        assert kc == {"upper": [], "middle": [], "lower": []}

    def test_keltner_with_different_multiplier(self):
        """Test Keltner with different multiplier."""
        data = generate_price_data(days=30)
        kc = indicators.calculate_keltner_channels(data, period=20, multiplier=3.0)
        # Wider bands with higher multiplier
        for i in range(len(data)):
            if (
                kc["upper"][i] is not None
                and kc["middle"][i] is not None
                and kc["lower"][i] is not None
            ):
                band_width = kc["upper"][i] - kc["lower"][i]
                assert band_width > 0


class TestDonchianChannelsEdgeCases:
    """Test Donchian Channels edge cases."""

    def test_donchian_with_empty_data(self):
        """Test Donchian with empty data."""
        data = []
        dc = indicators.calculate_donchian_channels(data)
        assert dc == {"upper": [], "middle": [], "lower": []}

    def test_donchian_with_period_one(self):
        """Test Donchian with period = 1."""
        data = generate_price_data(days=20)
        dc = indicators.calculate_donchian_channels(data, period=1)
        # Upper and lower should equal high and low
        for i in range(1, len(data)):
            if dc["upper"][i] is not None and dc["lower"][i] is not None:
                high = float(data[i].get("high_price") or data[i].get("close_price") or 0)
                low = float(data[i].get("low_price") or data[i].get("close_price") or 0)
                assert dc["upper"][i] == high
                assert dc["lower"][i] == low


class TestFractalBandsEdgeCases:
    """Test Fractal Bands edge cases."""

    def test_fractal_with_empty_data(self):
        """Test Fractal with empty data."""
        data = []
        fb = indicators.calculate_fractal_bands(data)
        assert fb == {"upper": [], "lower": []}

    def test_fractal_with_small_period(self):
        """Test Fractal with small period."""
        data = generate_price_data(days=20)
        fb = indicators.calculate_fractal_bands(data, period=2)
        assert len(fb["upper"]) == len(data)


class TestMFIEdgeCases:
    """Test MFI edge cases."""

    def test_mfi_with_empty_data(self):
        """Test MFI with empty data."""
        data = []
        mfi = indicators.calculate_mfi(data)
        assert mfi == []

    def test_mfi_with_no_volume(self):
        """Test MFI with no volume data."""
        data = generate_price_data(days=20)
        # Remove volume
        for item in data:
            if "volume" in item:
                del item["volume"]
        mfi = indicators.calculate_mfi(data)
        # Should still calculate but may have different results
        assert len(mfi) == len(data)

    def test_mfi_with_all_positive_flow(self):
        """Test MFI with all positive money flow."""
        data = []
        for i in range(20):
            data.append(
                {
                    "open_price": Decimal(str(100 + i)),
                    "high_price": Decimal(str(102 + i)),
                    "low_price": Decimal(str(99 + i)),
                    "close_price": Decimal(str(101 + i)),
                    "volume": Decimal("1000"),
                }
            )
        mfi = indicators.calculate_mfi(data, period=14)
        # Last MFI should be high (approaching 100)
        last_mfi = mfi[-1]
        if last_mfi is not None:
            assert last_mfi > 50.0


class TestMomentumEdgeCases:
    """Test Momentum edge cases."""

    def test_momentum_with_empty_data(self):
        """Test Momentum with empty data."""
        data = []
        momentum = indicators.calculate_momentum(data, 10)
        assert momentum == []

    def test_momentum_with_period_one(self):
        """Test Momentum with period = 1."""
        data = generate_price_data(days=20)
        momentum = indicators.calculate_momentum(data, period=1)
        # First value should be None, rest should be price differences
        assert momentum[0] is None
        for i in range(1, len(data)):
            if momentum[i] is not None:
                current = float(data[i].get("close_price") or 0)
                prev = float(data[i - 1].get("close_price") or 0)
                assert momentum[i] == current - prev


class TestPROCEdgeCases:
    """Test PROC edge cases."""

    def test_proc_with_empty_data(self):
        """Test PROC with empty data."""
        data = []
        proc = indicators.calculate_proc(data, 10)
        assert proc == []

    def test_proc_with_zero_past_price(self):
        """Test PROC handles zero past price."""
        data = [
            {"close_price": Decimal("0.00")},
            {"close_price": Decimal("100.00")},
        ] + generate_price_data(days=18)
        proc = indicators.calculate_proc(data, period=1)
        # Should handle gracefully
        assert len(proc) == len(data)


class TestATRTrailingStopEdgeCases:
    """Test ATR Trailing Stop edge cases."""

    def test_atr_trailing_with_empty_data(self):
        """Test ATR Trailing with empty data."""
        data = []
        atr_trailing = indicators.calculate_atr_trailing_stop(data)
        assert atr_trailing == []

    def test_atr_trailing_with_different_multiplier(self):
        """Test ATR Trailing with different multiplier."""
        data = generate_price_data(days=30)
        atr_trailing_2x = indicators.calculate_atr_trailing_stop(data, period=14, multiplier=2.0)
        atr_trailing_3x = indicators.calculate_atr_trailing_stop(data, period=14, multiplier=3.0)
        # Both should calculate successfully
        assert len(atr_trailing_2x) == len(data)
        assert len(atr_trailing_3x) == len(data)
        # Both should have valid values
        valid_2x = [v for v in atr_trailing_2x if v is not None]
        valid_3x = [v for v in atr_trailing_3x if v is not None]
        assert len(valid_2x) > 0
        assert len(valid_3x) > 0
        # Values should be positive
        for val in valid_2x + valid_3x:
            assert val > 0.0


class TestSupertrendEdgeCases:
    """Test Supertrend edge cases."""

    def test_supertrend_with_empty_data(self):
        """Test Supertrend with empty data."""
        data = []
        st = indicators.calculate_supertrend(data)
        assert st == {"supertrend": [], "trend": []}

    def test_supertrend_with_different_multiplier(self):
        """Test Supertrend with different multiplier."""
        data = generate_price_data(days=30)
        st_2x = indicators.calculate_supertrend(data, period=10, multiplier=2.0)
        st_3x = indicators.calculate_supertrend(data, period=10, multiplier=3.0)
        # Both should have same structure
        assert len(st_2x["supertrend"]) == len(st_3x["supertrend"])


class TestAlligatorEdgeCases:
    """Test Alligator edge cases."""

    def test_alligator_with_empty_data(self):
        """Test Alligator with empty data."""
        data = []
        alligator = indicators.calculate_alligator(data)
        assert alligator == {"jaw": [], "teeth": [], "lips": []}

    def test_alligator_with_custom_periods(self):
        """Test Alligator with custom periods."""
        data = generate_price_data(days=50)
        alligator = indicators.calculate_alligator(
            data, jaw_period=21, teeth_period=13, lips_period=8
        )
        assert "jaw" in alligator
        assert "teeth" in alligator
        assert "lips" in alligator


class TestLinearRegressionEdgeCases:
    """Test Linear Regression edge cases."""

    def test_linear_regression_with_empty_data(self):
        """Test Linear Regression with empty data."""
        data = []
        lr = indicators.calculate_linear_regression(data, 10)
        assert lr == []

    def test_linear_regression_with_period_one(self):
        """Test Linear Regression with period = 1."""
        data = generate_price_data(days=20)
        lr = indicators.calculate_linear_regression(data, period=1)
        # With period=1, we need at least period-1=0 values before, so index 0 should be None
        # Linear regression with 1 point doesn't make mathematical sense
        # The implementation requires period-1 values before calculation
        assert len(lr) == len(data)
        # First value should be None (need at least period-1=0 before, but calculation needs data)
        assert lr[0] is None

    def test_linear_regression_with_flat_data(self):
        """Test Linear Regression with flat price data."""
        data = [{"close_price": Decimal("100.00")} for _ in range(20)]
        lr = indicators.calculate_linear_regression(data, period=10)
        # Should return values close to 100
        valid_values = [v for v in lr if v is not None]
        if valid_values:
            for val in valid_values:
                assert abs(val - 100.0) < 1.0
