"""
Data splitter utility for splitting tick data into training and validation sets.
"""

import logging
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any

from stocks.models import Stock, StockTick

logger = logging.getLogger(__name__)


class DataSplitter:
    """Utility class for splitting tick data chronologically into training and validation sets."""

    def __init__(self, split_ratio: float = 0.8):
        """
        Initialize data splitter.

        Args:
            split_ratio: Ratio for training data (default 0.8 = 80%)
        """
        if not 0.1 <= split_ratio <= 0.9:
            msg = "Split ratio must be between 0.1 and 0.9"
            raise ValueError(msg)
        self.split_ratio = Decimal(str(split_ratio))

    def split_data(
        self,
        stocks: list[Stock],
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        """
        Split tick data for given stocks into training and validation sets.

        Args:
            stocks: List of Stock instances
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dictionary with:
            - training_data: List of tick data for training
            - validation_data: List of tick data for validation
            - training_start: Start date of training data
            - training_end: End date of training data
            - validation_start: Start date of validation data
            - validation_end: End date of validation data
            - total_points: Total number of data points
            - training_points: Number of training data points
            - validation_points: Number of validation data points
        """
        if not stocks:
            msg = "At least one stock must be provided"
            raise ValueError(msg)

        # Get date range for all stocks
        date_range = self._get_date_range(stocks, start_date, end_date)
        if not date_range:
            msg = "No tick data found for selected stocks"
            raise ValueError(msg)

        all_dates = sorted(date_range["dates"])
        total_dates = len(all_dates)

        if total_dates < 2:
            msg = f"Insufficient data: Only {total_dates} unique dates found. Need at least 2."
            raise ValueError(msg)

        # Calculate split point
        split_index = int(total_dates * float(self.split_ratio))
        if split_index == 0:
            split_index = 1
        if split_index >= total_dates:
            split_index = total_dates - 1

        training_end_date = all_dates[split_index - 1]
        validation_start_date = all_dates[split_index]

        # Load tick data for each stock
        training_data = {}
        validation_data = {}

        for stock in stocks:
            stock_training, stock_validation = self._split_stock_data(
                stock, training_end_date, validation_start_date, start_date, end_date
            )
            training_data[stock.symbol] = stock_training
            validation_data[stock.symbol] = stock_validation

        # Calculate totals
        total_points = sum(len(ticks) for ticks in training_data.values()) + sum(
            len(ticks) for ticks in validation_data.values()
        )
        training_points = sum(len(ticks) for ticks in training_data.values())
        validation_points = sum(len(ticks) for ticks in validation_data.values())

        return {
            "training_data": training_data,
            "validation_data": validation_data,
            "training_start": all_dates[0],
            "training_end": training_end_date,
            "validation_start": validation_start_date,
            "validation_end": all_dates[-1],
            "total_points": total_points,
            "training_points": training_points,
            "validation_points": validation_points,
            "split_ratio": float(self.split_ratio),
        }

    def _get_date_range(
        self, stocks: list[Stock], start_date: date | None, end_date: date | None
    ) -> dict[str, Any] | None:
        """Get date range for all stocks."""
        date_set = set()

        for stock in stocks:
            query = StockTick.objects.filter(stock=stock)
            if start_date:
                query = query.filter(timestamp__date__gte=start_date)
            if end_date:
                query = query.filter(timestamp__date__lte=end_date)

            dates = query.values_list("timestamp__date", flat=True).distinct()
            date_set.update(dates)

        if not date_set:
            return None

        return {
            "dates": sorted(date_set),
            "min_date": min(date_set),
            "max_date": max(date_set),
        }

    def _split_stock_data(
        self,
        stock: Stock,
        training_end_date: date,
        validation_start_date: date,
        start_date: date | None,
        end_date: date | None,
    ) -> tuple[list[dict], list[dict]]:
        """Split tick data for a single stock."""
        # Get all ticks for training period
        training_query = StockTick.objects.filter(
            stock=stock, timestamp__date__lte=training_end_date
        )
        if start_date:
            training_query = training_query.filter(timestamp__date__gte=start_date)

        training_ticks = list(training_query.order_by("timestamp"))

        # Get all ticks for validation period
        validation_query = StockTick.objects.filter(
            stock=stock,
            timestamp__date__gte=validation_start_date,
        )
        if end_date:
            validation_query = validation_query.filter(timestamp__date__lte=end_date)

        validation_ticks = list(validation_query.order_by("timestamp"))

        # Convert to dict format
        training_data = [self._tick_to_dict(tick) for tick in training_ticks]
        validation_data = [self._tick_to_dict(tick) for tick in validation_ticks]

        return training_data, validation_data

    def _tick_to_dict(self, tick: StockTick) -> dict[str, Any]:
        """Convert StockTick to dictionary."""
        return {
            "id": str(tick.id),
            "stock_symbol": tick.stock.symbol,
            "price": float(tick.price) if tick.price else None,
            "volume": tick.volume or 0,
            "bid_price": float(tick.bid_price) if tick.bid_price else None,
            "ask_price": float(tick.ask_price) if tick.ask_price else None,
            "bid_size": tick.bid_size or 0,
            "ask_size": tick.ask_size or 0,
            "timestamp": tick.timestamp.isoformat() if tick.timestamp else None,
            "date": tick.timestamp.date().isoformat() if tick.timestamp else None,
        }

    def aggregate_to_daily(self, tick_data: list[dict]) -> list[dict[str, Any]]:
        """
        Aggregate tick data into daily OHLCV candles.

        Args:
            tick_data: List of tick dictionaries

        Returns:
            List of daily OHLCV candles
        """
        if not tick_data:
            return []

        # Group by date
        candles = defaultdict(
            lambda: {
                "open": None,
                "high": None,
                "low": None,
                "close": None,
                "volume": 0,
                "date": None,
            }
        )

        for tick in tick_data:
            if not tick.get("date") or not tick.get("price"):
                continue

            tick_date = tick["date"]
            price = tick["price"]

            candle = candles[tick_date]

            # Set open (first tick of the day)
            if candle["open"] is None:
                candle["open"] = price
                candle["date"] = tick_date

            # Update high and low
            if candle["high"] is None or price > candle["high"]:
                candle["high"] = price
            if candle["low"] is None or price < candle["low"]:
                candle["low"] = price

            # Set close (last tick of the day)
            candle["close"] = price

            # Accumulate volume
            candle["volume"] += tick.get("volume", 0)

        # Convert to list and sort by date
        return [
            {
                "symbol": tick_data[0].get("stock_symbol", ""),
                "open_price": Decimal(str(candle["open"])),
                "high_price": Decimal(str(candle["high"])),
                "low_price": Decimal(str(candle["low"])),
                "close_price": Decimal(str(candle["close"])),
                "volume": candle["volume"],
                "date": candle["date"],
                "_data_source": "tick",
            }
            for candle_key in sorted(candles.keys())
            for candle in [candles[candle_key]]
            if candle["open"] is not None
        ]
