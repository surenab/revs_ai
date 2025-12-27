"""
Test factories for creating test data.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from stocks.models import (
    BotSignalHistory,
    MLModel,
    Order,
    Portfolio,
    Stock,
    StockPrice,
    TradingBotConfig,
    TradingBotExecution,
)
from users.models import UserProfile

User = get_user_model()


class StockFactory:
    """Factory for creating Stock instances."""

    @staticmethod
    def create(
        symbol: str = "AAPL",
        name: str = "Apple Inc.",
        exchange: str = "NASDAQ",
        sector: str = "Technology",
        industry: str = "Consumer Electronics",
        market_cap: int = 2500000000000,
        **kwargs,
    ) -> Stock:
        """Create a Stock instance."""
        defaults = {
            "symbol": symbol,
            "name": name,
            "exchange": exchange,
            "sector": sector,
            "industry": industry,
            "market_cap": market_cap,
            "is_active": True,
        }
        defaults.update(kwargs)
        return Stock.objects.create(**defaults)


class StockPriceFactory:
    """Factory for creating StockPrice instances."""

    @staticmethod
    def create(
        stock: Stock | None = None,
        date_obj: date | None = None,
        open_price: Decimal | None = None,
        high_price: Decimal | None = None,
        low_price: Decimal | None = None,
        close_price: Decimal | None = None,
        volume: int = 1000000,
        interval: str = "1d",
        **kwargs,
    ) -> StockPrice:
        """Create a StockPrice instance."""
        if stock is None:
            stock = StockFactory.create()

        if date_obj is None:
            date_obj = date.today()

        if close_price is None:
            close_price = Decimal("150.00")

        if open_price is None:
            open_price = close_price

        if high_price is None:
            high_price = close_price * Decimal("1.02")

        if low_price is None:
            low_price = close_price * Decimal("0.98")

        defaults = {
            "stock": stock,
            "date": date_obj,
            "open_price": open_price,
            "high_price": high_price,
            "low_price": low_price,
            "close_price": close_price,
            "volume": volume,
            "interval": interval,
        }
        defaults.update(kwargs)
        return StockPrice.objects.create(**defaults)

    @staticmethod
    def create_series(
        stock: Stock,
        days: int = 30,
        start_price: Decimal = Decimal("150.00"),
        volatility: float = 0.02,
    ) -> list[StockPrice]:
        """Create a series of StockPrice instances."""
        prices = []
        current_price = start_price
        start_date = date.today() - timedelta(days=days - 1)

        for i in range(days):
            price_date = start_date + timedelta(days=i)
            # Simple random walk for price
            import random

            change = Decimal(str(random.uniform(-volatility, volatility)))
            current_price = current_price * (Decimal("1.0") + change)

            prices.append(
                StockPriceFactory.create(
                    stock=stock,
                    date_obj=price_date,
                    close_price=current_price,
                    open_price=current_price * Decimal("0.99"),
                    high_price=current_price * Decimal("1.01"),
                    low_price=current_price * Decimal("0.98"),
                )
            )

        return prices


class UserFactory:
    """Factory for creating User instances."""

    @staticmethod
    def create(
        email: str = "test@example.com",
        password: str = "testpass123",
        **kwargs,
    ) -> User:
        """Create a User instance."""
        defaults = {"email": email}
        defaults.update(kwargs)
        user = User.objects.create_user(**defaults)
        if password:
            user.set_password(password)
            user.save()
        return user


class TradingBotConfigFactory:
    """Factory for creating TradingBotConfig instances."""

    @staticmethod
    def create(
        user: User | None = None,
        name: str = "Test Bot",
        is_active: bool = True,
        budget_type: str = "cash",
        budget_cash: Decimal = Decimal("10000.00"),
        risk_per_trade: Decimal = Decimal("2.00"),
        stop_loss_percent: Decimal | None = Decimal("5.00"),
        take_profit_percent: Decimal | None = Decimal("10.00"),
        signal_aggregation_method: str = "weighted_average",
        **kwargs,
    ) -> TradingBotConfig:
        """Create a TradingBotConfig instance."""
        if user is None:
            user = UserFactory.create()

        defaults = {
            "user": user,
            "name": name,
            "is_active": is_active,
            "budget_type": budget_type,
            "budget_cash": budget_cash,
            "risk_per_trade": risk_per_trade,
            "stop_loss_percent": stop_loss_percent,
            "take_profit_percent": take_profit_percent,
            "signal_aggregation_method": signal_aggregation_method,
            "risk_score_threshold": Decimal("80.00"),
            "risk_adjustment_factor": Decimal("0.40"),
            "risk_based_position_scaling": True,
        }
        defaults.update(kwargs)

        bot_config = TradingBotConfig.objects.create(**defaults)

        # Add assigned stocks if provided
        if "assigned_stocks" in kwargs:
            bot_config.assigned_stocks.set(kwargs["assigned_stocks"])

        return bot_config


class MLModelFactory:
    """Factory for creating MLModel instances."""

    @staticmethod
    def create(
        name: str = "Test ML Model",
        model_type: str = "classification",
        framework: str = "custom",
        is_active: bool = True,
        **kwargs,
    ) -> MLModel:
        """Create an MLModel instance."""
        defaults = {
            "name": name,
            "model_type": model_type,
            "framework": framework,
            "is_active": is_active,
            "version": "1.0.0",
        }
        defaults.update(kwargs)
        return MLModel.objects.create(**defaults)


class PortfolioFactory:
    """Factory for creating Portfolio instances."""

    @staticmethod
    def create(
        user: User | None = None,
        stock: Stock | None = None,
        quantity: Decimal = Decimal("10.00"),
        purchase_price: Decimal = Decimal("150.00"),
        purchase_date: date | None = None,
        **kwargs,
    ) -> Portfolio:
        """Create a Portfolio instance."""
        if user is None:
            user = UserFactory.create()

        if stock is None:
            stock = StockFactory.create()

        if purchase_date is None:
            purchase_date = date.today()

        defaults = {
            "user": user,
            "stock": stock,
            "quantity": quantity,
            "purchase_price": purchase_price,
            "purchase_date": purchase_date,
        }
        defaults.update(kwargs)
        return Portfolio.objects.create(**defaults)


class OrderFactory:
    """Factory for creating Order instances."""

    @staticmethod
    def create(
        user: User | None = None,
        stock: Stock | None = None,
        transaction_type: str = "buy",
        order_type: str = "market",
        quantity: Decimal = Decimal("10.00"),
        status: str = "waiting",
        bot_config: TradingBotConfig | None = None,
        **kwargs,
    ) -> Order:
        """Create an Order instance."""
        if user is None:
            user = UserFactory.create()

        if stock is None:
            stock = StockFactory.create()

        defaults = {
            "user": user,
            "stock": stock,
            "transaction_type": transaction_type,
            "order_type": order_type,
            "quantity": quantity,
            "status": status,
            "bot_config": bot_config,
        }
        defaults.update(kwargs)
        return Order.objects.create(**defaults)


class TradingBotExecutionFactory:
    """Factory for creating TradingBotExecution instances."""

    @staticmethod
    def create(
        bot_config: TradingBotConfig | None = None,
        stock: Stock | None = None,
        action: str = "buy",
        reason: str = "Test execution",
        risk_score: Decimal | None = Decimal("50.00"),
        executed_order: Order | None = None,
        **kwargs,
    ) -> TradingBotExecution:
        """Create a TradingBotExecution instance."""
        if bot_config is None:
            user = UserFactory.create()
            bot_config = TradingBotConfigFactory.create(user=user)

        if stock is None:
            stock = StockFactory.create()

        defaults = {
            "bot_config": bot_config,
            "stock": stock,
            "action": action,
            "reason": reason,
            "risk_score": risk_score,
            "executed_order": executed_order,
            "indicators_data": {},
            "patterns_detected": {},
        }
        defaults.update(kwargs)
        return TradingBotExecution.objects.create(**defaults)


class BotSignalHistoryFactory:
    """Factory for creating BotSignalHistory instances."""

    @staticmethod
    def create(
        bot_config: TradingBotConfig | None = None,
        stock: Stock | None = None,
        final_decision: str = "buy",
        decision_confidence: Decimal = Decimal("75.00"),
        risk_score: Decimal | None = Decimal("50.00"),
        **kwargs,
    ) -> BotSignalHistory:
        """Create a BotSignalHistory instance."""
        if bot_config is None:
            user = UserFactory.create()
            bot_config = TradingBotConfigFactory.create(user=user)

        if stock is None:
            stock = StockFactory.create()

        defaults = {
            "bot_config": bot_config,
            "stock": stock,
            "final_decision": final_decision,
            "decision_confidence": decision_confidence,
            "risk_score": risk_score,
            "price_data_snapshot": {"latest": {}, "count": 0},
            "ml_signals": {"predictions": [], "count": 0},
            "social_signals": {},
            "news_signals": {},
            "indicator_signals": {"signals": [], "count": 0},
            "pattern_signals": {"patterns": [], "count": 0},
            "aggregated_signal": {},
        }
        defaults.update(kwargs)
        return BotSignalHistory.objects.create(**defaults)
