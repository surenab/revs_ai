"""
Test factories for creating bot simulation test data.
"""

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from bot_simulations.models import BotSimulationConfig, BotSimulationRun
from stocks.models import Stock, StockTick
from stocks.tests.fixtures.factories import StockFactory, UserFactory

User = get_user_model()


class BotSimulationRunFactory:
    """Factory for creating BotSimulationRun instances."""

    @staticmethod
    def create(
        user=None,
        name: str = "Test Simulation",
        status: str = "pending",
        execution_start_date: date | None = None,
        execution_end_date: date | None = None,
        stocks: list[Stock] | None = None,
        config_ranges: dict | None = None,
        simulation_type: str = "fund",
        initial_fund: Decimal = Decimal("10000.00"),
        initial_portfolio: dict | None = None,
        **kwargs,
    ) -> BotSimulationRun:
        """Create a BotSimulationRun instance."""
        if user is None:
            user = UserFactory.create()

        if execution_start_date is None:
            execution_start_date = date.today() - timedelta(days=30)

        if execution_end_date is None:
            execution_end_date = date.today() - timedelta(days=1)

        if config_ranges is None:
            config_ranges = {
                "signal_weights": {
                    "indicator": [0.3],
                    "pattern": [0.15],
                },
                "risk_params": {
                    "risk_score_threshold": [80],
                },
                "period_days": [14],
            }

        defaults = {
            "user": user,
            "name": name,
            "status": status,
            "execution_start_date": execution_start_date,
            "execution_end_date": execution_end_date,
            "config_ranges": config_ranges,
            "simulation_type": simulation_type,
            "initial_fund": initial_fund,
            "initial_portfolio": initial_portfolio or {},
        }
        defaults.update(kwargs)

        simulation_run = BotSimulationRun.objects.create(**defaults)

        # Add stocks if provided
        if stocks:
            simulation_run.stocks.set(stocks)

        return simulation_run


class StockTickFactory:
    """Factory for creating StockTick instances."""

    @staticmethod
    def create(
        stock: Stock | None = None,
        timestamp: datetime | None = None,
        price: Decimal | None = None,
        volume: int | None = None,
        bid_price: Decimal | None = None,
        ask_price: Decimal | None = None,
        bid_size: int | None = None,
        ask_size: int | None = None,
        **kwargs,
    ) -> StockTick:
        """Create a StockTick instance."""
        if stock is None:
            stock = StockFactory.create()

        if timestamp is None:
            timestamp = timezone.now()

        if price is None:
            price = Decimal("150.00")

        if volume is None:
            volume = random.randint(1000, 100000)

        if bid_price is None:
            bid_price = price * Decimal("0.999")

        if ask_price is None:
            ask_price = price * Decimal("1.001")

        if bid_size is None:
            bid_size = random.randint(100, 1000)

        if ask_size is None:
            ask_size = random.randint(100, 1000)

        defaults = {
            "stock": stock,
            "timestamp": timestamp,
            "price": price,
            "volume": volume,
            "bid_price": bid_price,
            "ask_price": ask_price,
            "bid_size": bid_size,
            "ask_size": ask_size,
            "is_market_hours": True,
        }
        defaults.update(kwargs)
        return StockTick.objects.create(**defaults)

    @staticmethod
    def create_series(
        stock: Stock,
        start_date: date,
        end_date: date,
        start_price: Decimal = Decimal("150.00"),
        volatility: float = 0.02,
        ticks_per_day: int = 10,
    ) -> list[StockTick]:
        """
        Create a series of StockTick instances for a date range.

        Args:
            stock: Stock instance
            start_date: Start date for the series
            end_date: End date for the series
            start_price: Starting price
            volatility: Price volatility (0.02 = 2%)
            ticks_per_day: Number of ticks per day

        Returns:
            List of StockTick instances
        """
        ticks = []
        current_price = start_price
        current_date = start_date

        while current_date <= end_date:
            # Create multiple ticks per day
            for tick_num in range(ticks_per_day):
                # Generate timestamp within the day
                hour = 9 + (tick_num * 6 // ticks_per_day)  # Market hours 9-15
                minute = (tick_num * 60 // ticks_per_day) % 60
                time_obj = datetime.min.time().replace(hour=hour, minute=minute)
                timestamp = timezone.make_aware(
                    datetime.combine(current_date, time_obj)
                )

                # Simple random walk for price
                change = Decimal(str(random.uniform(-volatility, volatility)))
                current_price = current_price * (Decimal("1.0") + change)

                # Ensure price doesn't go negative
                if current_price < Decimal("0.01"):
                    current_price = Decimal("0.01")

                tick = StockTickFactory.create(
                    stock=stock,
                    timestamp=timestamp,
                    price=current_price,
                    volume=random.randint(1000, 100000),
                )
                ticks.append(tick)

            current_date += timedelta(days=1)

        return ticks


class BotSimulationConfigFactory:
    """Factory for creating BotSimulationConfig instances (for testing, not generation)."""

    @staticmethod
    def create(
        simulation_run: BotSimulationRun | None = None,
        bot_index: int = 0,
        config_json: dict | None = None,
        assigned_stocks: list[Stock] | None = None,
        use_social_analysis: bool = False,
        use_news_analysis: bool = False,
        **kwargs,
    ) -> BotSimulationConfig:
        """Create a BotSimulationConfig instance."""
        if simulation_run is None:
            user = UserFactory.create()
            simulation_run = BotSimulationRunFactory.create(user=user)

        if config_json is None:
            config_json = {
                "signal_weights": {
                    "indicator": 0.3,
                    "pattern": 0.15,
                },
                "risk_score_threshold": 80,
                "period_days": 14,
                "signal_aggregation_method": "weighted_average",
            }

        defaults = {
            "simulation_run": simulation_run,
            "bot_index": bot_index,
            "config_json": config_json,
            "use_social_analysis": use_social_analysis,
            "use_news_analysis": use_news_analysis,
        }
        defaults.update(kwargs)

        bot_config = BotSimulationConfig.objects.create(**defaults)

        # Add assigned stocks if provided
        if assigned_stocks:
            bot_config.assigned_stocks.set(assigned_stocks)

        return bot_config
