import logging

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import (
    IntradayPrice,
    Order,
    Portfolio,
    Stock,
    StockAlert,
    StockPrice,
    StockTick,
    TradingBotConfig,
    TradingBotExecution,
    UserWatchlist,
)

logger = logging.getLogger(__name__)


class StockListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for stock lists (id, symbol, name only)."""

    class Meta:
        model = Stock
        fields = ["id", "symbol", "name"]
        read_only_fields = ["id", "symbol", "name"]


class StockSerializer(serializers.ModelSerializer):
    """Serializer for Stock model."""

    market_cap_formatted = serializers.SerializerMethodField()
    latest_price = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = [
            "id",
            "symbol",
            "name",
            "exchange",
            "sector",
            "industry",
            "market_cap",
            "market_cap_formatted",
            "description",
            "is_active",
            "latest_price",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "market_cap_formatted",
            "latest_price",
        ]

    def get_market_cap_formatted(self, obj):
        """Format market cap for display."""
        if obj.market_cap:
            if obj.market_cap >= 1_000_000_000:
                return f"${obj.market_cap / 1_000_000_000:.1f}B"
            if obj.market_cap >= 1_000_000:
                return f"${obj.market_cap / 1_000_000:.1f}M"
            return f"${obj.market_cap:,}"
        return None

    def get_latest_price(self, obj):
        """Get the latest stock price."""
        try:
            latest_price = (
                StockPrice.objects.filter(stock=obj, interval="1d")
                .order_by("-date")
                .first()
            )
            if latest_price:
                return {
                    "close_price": latest_price.close_price,
                    "date": latest_price.date,
                    "price_change": latest_price.price_change,
                    "price_change_percent": latest_price.price_change_percent,
                }
        except (AttributeError, ValueError, TypeError) as e:
            logger.debug("Error getting latest price: %s", e)
        return None


class StockPriceSerializer(serializers.ModelSerializer):
    """Serializer for StockPrice model."""

    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    stock_name = serializers.CharField(source="stock.name", read_only=True)
    price_change = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )
    price_change_percent = serializers.DecimalField(
        max_digits=8, decimal_places=4, read_only=True
    )

    class Meta:
        model = StockPrice
        fields = [
            "id",
            "stock",
            "stock_symbol",
            "stock_name",
            "date",
            "interval",
            "open_price",
            "high_price",
            "low_price",
            "close_price",
            "adjusted_close",
            "volume",
            "price_change",
            "price_change_percent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "stock_symbol",
            "stock_name",
            "price_change",
            "price_change_percent",
            "created_at",
            "updated_at",
        ]

    def validate(self, data):
        """Validate price data."""
        open_price = data.get("open_price")
        high_price = data.get("high_price")
        low_price = data.get("low_price")
        close_price = data.get("close_price")

        if high_price and low_price and high_price < low_price:
            raise serializers.ValidationError(
                _("High price cannot be lower than low price.")
            )

        if open_price and high_price and open_price > high_price:
            raise serializers.ValidationError(
                _("Open price cannot be higher than high price.")
            )

        if open_price and low_price and open_price < low_price:
            raise serializers.ValidationError(
                _("Open price cannot be lower than low price.")
            )

        if close_price and high_price and close_price > high_price:
            raise serializers.ValidationError(
                _("Close price cannot be higher than high price.")
            )

        if close_price and low_price and close_price < low_price:
            raise serializers.ValidationError(
                _("Close price cannot be lower than low price.")
            )

        return data


class StockPriceListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing stock prices."""

    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    price_change = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )
    price_change_percent = serializers.DecimalField(
        max_digits=8, decimal_places=4, read_only=True
    )

    class Meta:
        model = StockPrice
        fields = [
            "id",
            "stock_symbol",
            "date",
            "interval",
            "open_price",
            "high_price",
            "low_price",
            "close_price",
            "volume",
            "price_change",
            "price_change_percent",
        ]


class UserWatchlistSerializer(serializers.ModelSerializer):
    """Serializer for UserWatchlist model."""

    stock_details = StockSerializer(source="stock", read_only=True)
    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)

    class Meta:
        model = UserWatchlist
        fields = [
            "id",
            "stock",
            "stock_symbol",
            "stock_details",
            "notes",
            "target_price",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "stock_symbol",
            "stock_details",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        """Create watchlist entry for the current user."""
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class UserWatchlistCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating watchlist entries."""

    stock_symbol = serializers.CharField(write_only=True)

    class Meta:
        model = UserWatchlist
        fields = ["stock_symbol", "notes", "target_price"]

    def validate_stock_symbol(self, value):
        """Validate that the stock symbol exists."""
        try:
            return Stock.objects.get(symbol=value.upper(), is_active=True)
        except Stock.DoesNotExist as err:
            raise serializers.ValidationError(
                _("Stock with symbol '{}' not found or inactive.").format(value)
            ) from err

    def create(self, validated_data):
        """Create watchlist entry."""
        stock = validated_data.pop("stock_symbol")
        validated_data["stock"] = stock
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class StockAlertSerializer(serializers.ModelSerializer):
    """Serializer for StockAlert model."""

    stock_details = StockSerializer(source="stock", read_only=True)
    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)

    class Meta:
        model = StockAlert
        fields = [
            "id",
            "stock",
            "stock_symbol",
            "stock_details",
            "alert_type",
            "threshold_value",
            "is_active",
            "is_triggered",
            "triggered_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "stock_symbol",
            "stock_details",
            "is_triggered",
            "triggered_at",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        """Create alert for the current user."""
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class StockAlertCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating stock alerts."""

    stock_symbol = serializers.CharField(write_only=True)

    class Meta:
        model = StockAlert
        fields = ["stock_symbol", "alert_type", "threshold_value"]

    def validate_stock_symbol(self, value):
        """Validate that the stock symbol exists."""
        try:
            return Stock.objects.get(symbol=value.upper(), is_active=True)
        except Stock.DoesNotExist as err:
            raise serializers.ValidationError(
                _("Stock with symbol '{}' not found or inactive.").format(value)
            ) from err

    def validate_threshold_value(self, value):
        """Validate threshold value based on alert type."""
        if value <= 0:
            raise serializers.ValidationError(
                _("Threshold value must be greater than 0.")
            )
        return value

    def validate(self, data):
        """Additional validation for alert creation."""
        alert_type = data.get("alert_type")
        threshold_value = data.get("threshold_value")

        if alert_type == "change_percent" and threshold_value > 100:
            raise serializers.ValidationError(
                _("Percentage change threshold cannot exceed 100%.")
            )

        return data

    def create(self, validated_data):
        """Create alert."""
        stock = validated_data.pop("stock_symbol")
        validated_data["stock"] = stock
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class StockTimeSeriesSerializer(serializers.Serializer):
    """Serializer for time series data requests."""

    symbol = serializers.CharField(max_length=20)
    interval = serializers.ChoiceField(
        choices=StockPrice.INTERVAL_CHOICES, default="1d"
    )
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    limit = serializers.IntegerField(min_value=1, max_value=10000, default=100)

    def validate_symbol(self, value):
        """Validate that the stock symbol exists."""
        try:
            return Stock.objects.get(symbol=value.upper(), is_active=True)
        except Stock.DoesNotExist as err:
            raise serializers.ValidationError(
                _("Stock with symbol '{}' not found or inactive.").format(value)
            ) from err

    def validate(self, data):
        """Validate date range."""
        start_date = data.get("start_date")
        end_date = data.get("end_date")

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError(_("Start date cannot be after end date."))

        return data


class StockTickSerializer(serializers.ModelSerializer):
    """Serializer for StockTick model (real-time tick data)."""

    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    spread = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)
    spread_percentage = serializers.DecimalField(
        max_digits=8, decimal_places=4, read_only=True
    )

    class Meta:
        model = StockTick
        fields = [
            "id",
            "stock",
            "stock_symbol",
            "price",
            "volume",
            "bid_price",
            "ask_price",
            "bid_size",
            "ask_size",
            "spread",
            "spread_percentage",
            "trade_type",
            "timestamp",
            "is_market_hours",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "stock_symbol",
            "spread",
            "spread_percentage",
            "created_at",
        ]


class StockTickListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing stock ticks."""

    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    spread = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)

    class Meta:
        model = StockTick
        fields = [
            "id",
            "stock_symbol",
            "price",
            "volume",
            "bid_price",
            "ask_price",
            "spread",
            "trade_type",
            "timestamp",
        ]


class IntradayPriceSerializer(serializers.ModelSerializer):
    """Serializer for IntradayPrice model (sub-minute intervals)."""

    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    stock_name = serializers.CharField(source="stock.name", read_only=True)
    price_change = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )
    price_change_percent = serializers.DecimalField(
        max_digits=8, decimal_places=4, read_only=True
    )
    typical_price = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )

    class Meta:
        model = IntradayPrice
        fields = [
            "id",
            "stock",
            "stock_symbol",
            "stock_name",
            "timestamp",
            "interval",
            "open_price",
            "high_price",
            "low_price",
            "close_price",
            "volume",
            "vwap",
            "trade_count",
            "session_type",
            "price_change",
            "price_change_percent",
            "typical_price",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "stock_symbol",
            "stock_name",
            "price_change",
            "price_change_percent",
            "typical_price",
            "created_at",
        ]


class IntradayPriceListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing intraday prices."""

    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    price_change = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )
    price_change_percent = serializers.DecimalField(
        max_digits=8, decimal_places=4, read_only=True
    )

    class Meta:
        model = IntradayPrice
        fields = [
            "id",
            "stock_symbol",
            "timestamp",
            "interval",
            "open_price",
            "high_price",
            "low_price",
            "close_price",
            "volume",
            "vwap",
            "price_change",
            "price_change_percent",
            "session_type",
        ]


class RealTimeDataSerializer(serializers.Serializer):
    """Serializer for real-time data requests."""

    symbol = serializers.CharField(max_length=20)
    interval = serializers.ChoiceField(
        choices=[
            *IntradayPrice.INTRADAY_INTERVALS,
            ("5m", "5 Minutes"),
            ("15m", "15 Minutes"),
            ("30m", "30 Minutes"),
        ],
        default="1m",
    )
    start_time = serializers.DateTimeField(required=False, allow_null=True)
    end_time = serializers.DateTimeField(required=False, allow_null=True)
    limit = serializers.IntegerField(min_value=1, max_value=100000, default=100000)
    session_type = serializers.ChoiceField(
        choices=[
            ("all", "All Sessions"),
            ("pre_market", "Pre-Market"),
            ("regular", "Regular Hours"),
            ("after_hours", "After Hours"),
        ],
        default="all",
        required=False,
    )

    def validate_symbol(self, value):
        """Validate that the stock symbol exists."""
        try:
            return Stock.objects.get(symbol=value.upper(), is_active=True)
        except Stock.DoesNotExist as err:
            raise serializers.ValidationError(
                _("Stock with symbol '{}' not found or inactive.").format(value)
            ) from err

    def validate(self, data):
        """Validate time range."""
        start_time = data.get("start_time")
        end_time = data.get("end_time")

        if start_time and end_time and start_time > end_time:
            raise serializers.ValidationError(_("Start time cannot be after end time."))

        return data


class TickDataSerializer(serializers.Serializer):
    """Serializer for tick data requests."""

    symbol = serializers.CharField(max_length=20)
    start_time = serializers.DateTimeField(required=False, allow_null=True)
    end_time = serializers.DateTimeField(required=False, allow_null=True)
    limit = serializers.IntegerField(min_value=1, max_value=50000, default=5000)
    trade_type = serializers.ChoiceField(
        choices=[("all", "All"), *list(StockTick.TRADE_TYPES)],
        default="all",
        required=False,
    )
    market_hours_only = serializers.BooleanField(default=True)

    def validate_symbol(self, value):
        """Validate that the stock symbol exists."""
        try:
            return Stock.objects.get(symbol=value.upper(), is_active=True)
        except Stock.DoesNotExist as err:
            raise serializers.ValidationError(
                _("Stock with symbol '{}' not found or inactive.").format(value)
            ) from err

    def validate(self, data):
        """Validate time range."""
        start_time = data.get("start_time")
        end_time = data.get("end_time")

        if start_time and end_time and start_time > end_time:
            raise serializers.ValidationError(_("Start time cannot be after end time."))

        return data


class PortfolioSerializer(serializers.ModelSerializer):
    """Serializer for Portfolio model."""

    stock_details = StockSerializer(source="stock", read_only=True)
    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    total_cost = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )
    current_value = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )
    gain_loss = serializers.DecimalField(
        max_digits=12, decimal_places=4, read_only=True
    )
    gain_loss_percent = serializers.DecimalField(
        max_digits=8, decimal_places=4, read_only=True
    )
    current_price = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = [
            "id",
            "stock",
            "stock_symbol",
            "stock_details",
            "quantity",
            "purchase_price",
            "purchase_date",
            "notes",
            "total_cost",
            "current_value",
            "gain_loss",
            "gain_loss_percent",
            "current_price",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "stock_symbol",
            "stock_details",
            "total_cost",
            "current_value",
            "gain_loss",
            "gain_loss_percent",
            "current_price",
            "created_at",
            "updated_at",
        ]

    def get_current_price(self, obj):
        """Get current stock price."""
        latest_price = obj.stock.latest_price
        if latest_price:
            return {
                "close_price": latest_price.close_price,
                "date": latest_price.date,
                "price_change": latest_price.price_change,
                "price_change_percent": latest_price.price_change_percent,
            }
        return None

    def create(self, validated_data):
        """Create portfolio entry for the current user."""
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class PortfolioCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating portfolio entries."""

    stock_symbol = serializers.CharField(write_only=True)

    class Meta:
        model = Portfolio
        fields = [
            "stock_symbol",
            "quantity",
            "purchase_price",
            "purchase_date",
            "notes",
        ]

    def validate_stock_symbol(self, value):
        """Validate that the stock symbol exists."""
        try:
            return Stock.objects.get(symbol=value.upper(), is_active=True)
        except Stock.DoesNotExist as err:
            raise serializers.ValidationError(
                _("Stock with symbol '{}' not found or inactive.").format(value)
            ) from err

    def validate_quantity(self, value):
        """Validate quantity."""
        if value <= 0:
            raise serializers.ValidationError(_("Quantity must be greater than 0."))
        return value

    def validate_purchase_price(self, value):
        """Validate purchase price."""
        if value <= 0:
            raise serializers.ValidationError(
                _("Purchase price must be greater than 0.")
            )
        return value

    def create(self, validated_data):
        """Create portfolio entry."""
        stock = validated_data.pop("stock_symbol")
        validated_data["stock"] = stock
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for Order model."""

    stock_details = StockSerializer(source="stock", read_only=True)
    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)
    can_execute = serializers.BooleanField(read_only=True)
    current_price = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "stock",
            "stock_symbol",
            "stock_details",
            "transaction_type",
            "order_type",
            "quantity",
            "target_price",
            "status",
            "executed_price",
            "executed_at",
            "notes",
            "can_execute",
            "current_price",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "stock_symbol",
            "stock_details",
            "status",
            "executed_price",
            "executed_at",
            "can_execute",
            "current_price",
            "created_at",
            "updated_at",
        ]

    def get_current_price(self, obj):
        """Get current stock price."""
        latest_price = obj.stock.latest_price
        if latest_price:
            return {
                "close_price": latest_price.close_price,
                "date": latest_price.date,
                "price_change": latest_price.price_change,
                "price_change_percent": latest_price.price_change_percent,
            }
        return None

    def create(self, validated_data):
        """Create order for the current user."""
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class OrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating orders."""

    stock_symbol = serializers.CharField(write_only=True)

    class Meta:
        model = Order
        fields = [
            "stock_symbol",
            "transaction_type",
            "order_type",
            "quantity",
            "target_price",
            "notes",
        ]

    def validate_stock_symbol(self, value):
        """Validate that the stock symbol exists."""
        try:
            return Stock.objects.get(symbol=value.upper(), is_active=True)
        except Stock.DoesNotExist as err:
            raise serializers.ValidationError(
                _("Stock with symbol '{}' not found or inactive.").format(value)
            ) from err

    def validate_quantity(self, value):
        """Validate quantity."""
        if value <= 0:
            raise serializers.ValidationError(_("Quantity must be greater than 0."))
        return value

    def validate_target_price(self, value):
        """Validate target price."""
        if value is not None and value <= 0:
            raise serializers.ValidationError(_("Target price must be greater than 0."))
        return value

    def validate(self, data):
        """Additional validation for order creation."""
        order_type = data.get("order_type")
        target_price = data.get("target_price")

        # Target orders must have a target price
        if order_type == "target" and not target_price:
            raise serializers.ValidationError(
                _("Target price is required for target orders.")
            )

        # Market orders should not have target price
        if order_type == "market" and target_price:
            raise serializers.ValidationError(
                _("Target price should not be set for market orders.")
            )

        return data

    def create(self, validated_data):
        """Create order."""
        stock = validated_data.pop("stock_symbol")
        validated_data["stock"] = stock
        validated_data["user"] = self.context["request"].user
        validated_data["status"] = "waiting"  # Start as waiting

        order = super().create(validated_data)

        # Refresh from database to ensure all relationships are loaded
        order.refresh_from_db()

        # Check for insufficient funds before executing (for buy orders)
        if order.transaction_type == "buy" and order.order_type == "market":
            from users.models import UserProfile

            latest_price = order.stock.latest_price
            if latest_price:
                execution_price = latest_price.close_price
                total_cost = order.quantity * execution_price

                try:
                    user_profile = UserProfile.objects.get(user=order.user)
                    if user_profile.cash < total_cost:
                        order.status = "insufficient_funds"
                        order.save()
                        logger.warning(
                            f"Order {order.id} set to insufficient_funds: need {total_cost}, have {user_profile.cash}"
                        )
                        return order
                except UserProfile.DoesNotExist:
                    order.status = "insufficient_funds"
                    order.save()
                    logger.warning(
                        f"Order {order.id} set to insufficient_funds: no user profile"
                    )
                    return order

        # Execute market orders immediately
        if order.order_type == "market":
            logger.info(
                f"Executing market order for {order.stock.symbol} ({order.transaction_type}, {order.quantity} shares)"
            )
            executed = order.execute()
            logger.info(f"Execution result: {executed}")
            if not executed:
                # Refresh to get the updated status (might be 'insufficient_funds' or 'waiting')
                order.refresh_from_db()
                if order.status == "waiting":
                    # Only set to waiting if status wasn't changed by execute() method
                    # (e.g., if it failed due to no price available)
                    logger.warning(
                        f"Execution failed for {order.stock.symbol} ({order.transaction_type}, {order.quantity} shares) - keeping in waiting status"
                    )
                elif order.status == "insufficient_funds":
                    logger.warning(
                        f"Order failed due to insufficient funds for {order.stock.symbol}"
                    )
            else:
                logger.info(f"Order executed successfully for {order.stock.symbol}")

        return order


class TradingBotConfigSerializer(serializers.ModelSerializer):
    """Serializer for TradingBotConfig model."""

    assigned_stocks = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Stock.objects.all(), required=True
    )
    budget_portfolio = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Portfolio.objects.all(), required=False, allow_empty=True
    )

    class Meta:
        model = TradingBotConfig
        fields = [
            "id",
            "user",
            "name",
            "is_active",
            "budget_type",
            "budget_cash",
            "budget_portfolio",
            "assigned_stocks",
            "max_position_size",
            "max_daily_trades",
            "max_daily_loss",
            "risk_per_trade",
            "stop_loss_percent",
            "take_profit_percent",
            "enabled_indicators",
            "enabled_patterns",
            "buy_rules",
            "sell_rules",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

    def validate(self, data):
        """Validate bot configuration."""
        budget_type = data.get("budget_type", "cash")

        if budget_type == "cash" and not data.get("budget_cash"):
            raise serializers.ValidationError(
                {"budget_cash": "Cash budget is required when budget_type is 'cash'"}
            )

        if budget_type == "portfolio" and not data.get("budget_portfolio"):
            raise serializers.ValidationError(
                {
                    "budget_portfolio": "Portfolio positions are required when budget_type is 'portfolio'"
                }
            )

        # Check if portfolio positions are already assigned to other bots
        budget_portfolio = data.get("budget_portfolio", [])
        if budget_portfolio:
            instance = self.instance  # For updates, this will be the current bot
            # Get user from instance (for updates) or from request context (for creates)
            user = None
            if instance:
                user = instance.user
            elif self.context and "request" in self.context:
                user = self.context["request"].user

            if user:
                # Get all bots for this user (excluding current bot if updating)
                other_bots = TradingBotConfig.objects.filter(user=user)
                if instance:
                    other_bots = other_bots.exclude(id=instance.id)

                # Check which portfolio positions are already assigned
                assigned_positions = set()
                for bot in other_bots:
                    assigned_positions.update(
                        bot.budget_portfolio.values_list("id", flat=True)
                    )

                # Check if any of the requested positions are already assigned
                requested_position_ids = {pos.id for pos in budget_portfolio}
                conflicting_positions = requested_position_ids & assigned_positions

                if conflicting_positions:
                    # Get portfolio position details for error message
                    from .models import Portfolio

                    conflicting_portfolios = Portfolio.objects.filter(
                        id__in=conflicting_positions
                    )
                    portfolio_details = [
                        f"{p.stock.symbol} ({p.quantity} shares)"
                        for p in conflicting_portfolios
                    ]
                    raise serializers.ValidationError(
                        {
                            "budget_portfolio": f"Portfolio position(s) already assigned to another bot: {', '.join(portfolio_details)}"
                        }
                    )

        assigned_stocks = data.get("assigned_stocks", [])
        if not assigned_stocks:
            raise serializers.ValidationError(
                {"assigned_stocks": "At least one stock must be assigned to the bot"}
            )

        return data

    def create(self, validated_data):
        """Create bot configuration."""
        assigned_stocks = validated_data.pop("assigned_stocks", [])
        budget_portfolio = validated_data.pop("budget_portfolio", [])

        bot_config = TradingBotConfig.objects.create(**validated_data)

        # Set many-to-many relationships
        bot_config.assigned_stocks.set(assigned_stocks)
        if budget_portfolio:
            bot_config.budget_portfolio.set(budget_portfolio)

        return bot_config

    def update(self, instance, validated_data):
        """Update bot configuration."""
        assigned_stocks = validated_data.pop("assigned_stocks", None)
        budget_portfolio = validated_data.pop("budget_portfolio", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if assigned_stocks is not None:
            instance.assigned_stocks.set(assigned_stocks)

        if budget_portfolio is not None:
            instance.budget_portfolio.set(budget_portfolio)

        return instance


class TradingBotExecutionSerializer(serializers.ModelSerializer):
    """Serializer for TradingBotExecution model."""

    bot_config_name = serializers.CharField(source="bot_config.name", read_only=True)
    stock_symbol = serializers.CharField(source="stock.symbol", read_only=True)

    class Meta:
        model = TradingBotExecution
        fields = [
            "id",
            "bot_config",
            "bot_config_name",
            "stock",
            "stock_symbol",
            "action",
            "reason",
            "indicators_data",
            "patterns_detected",
            "risk_score",
            "executed_order",
            "timestamp",
        ]
        read_only_fields = ["id", "timestamp"]


class BotPerformanceSerializer(serializers.Serializer):
    """Serializer for bot performance metrics."""

    bot_id = serializers.UUIDField()
    bot_name = serializers.CharField()
    total_trades = serializers.IntegerField()
    successful_trades = serializers.IntegerField()
    total_profit_loss = serializers.DecimalField(max_digits=15, decimal_places=2)
    win_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    average_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    average_loss = serializers.DecimalField(max_digits=15, decimal_places=2)
