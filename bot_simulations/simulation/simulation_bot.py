"""
Simulation-specific bot analyzer that works with historical price data.
"""

import logging
from typing import Any

from stocks.bot_engine import TradingBot
from stocks.models import Stock, TradingBotConfig

logger = logging.getLogger(__name__)


class SimulationBot(TradingBot):
    """TradingBot extended for simulation with historical price data."""

    def __init__(
        self,
        bot_config: TradingBotConfig,
        historical_price_data: dict[str, list[dict]],
        simulation_date: Any = None,
    ):
        """
        Initialize simulation bot.

        Args:
            bot_config: TradingBotConfig instance
            historical_price_data: Dictionary mapping stock symbols to price data lists
            simulation_date: Current simulation date (for filtering data)
        """
        super().__init__(bot_config)
        self.historical_price_data = historical_price_data
        self.simulation_date = simulation_date

    def _get_price_data(self, stock: Stock, limit: int = 200) -> list[dict]:
        """
        Override to use historical price data instead of querying database.

        Args:
            stock: Stock instance
            limit: Number of days to retrieve

        Returns:
            List of price data dictionaries
        """
        # Get price data from historical data
        stock_data = self.historical_price_data.get(stock.symbol, [])

        if not stock_data:
            logger.warning(f"No historical price data for {stock.symbol}")
            return []

        # Filter by simulation date if provided
        if self.simulation_date:
            from datetime import date as date_type

            # Convert simulation_date to date object if it's a string
            if isinstance(self.simulation_date, str):
                sim_date = date_type.fromisoformat(self.simulation_date)
            else:
                sim_date = self.simulation_date

            # Filter data up to simulation date
            filtered_data = []
            for candle in stock_data:
                candle_date_str = candle.get("date")
                if candle_date_str:
                    if isinstance(candle_date_str, str):
                        candle_date = date_type.fromisoformat(candle_date_str)
                    else:
                        candle_date = candle_date_str
                    if candle_date <= sim_date:
                        filtered_data.append(candle)

            # Take last 'limit' days
            if len(filtered_data) > limit:
                filtered_data = filtered_data[-limit:]
            return filtered_data

        # Return last 'limit' days (already in correct format from day_executor)
        if len(stock_data) > limit:
            return stock_data[-limit:]

        return stock_data
