import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords

User = get_user_model()
logger = logging.getLogger(__name__)


class Stock(models.Model):
    """
    Model representing a stock/security.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    symbol = models.CharField(
        _("symbol"),
        max_length=20,
        unique=True,
        help_text=_("Stock ticker symbol (e.g., AAPL, GOOGL)"),
    )
    name = models.CharField(
        _("company name"), max_length=200, help_text=_("Full company name")
    )
    exchange = models.CharField(
        _("exchange"), max_length=50, help_text=_("Stock exchange (e.g., NASDAQ, NYSE)")
    )
    sector = models.CharField(
        _("sector"), max_length=100, blank=True, help_text=_("Industry sector")
    )
    industry = models.CharField(
        _("industry"), max_length=100, blank=True, help_text=_("Specific industry")
    )
    market_cap = models.BigIntegerField(
        _("market capitalization"),
        null=True,
        blank=True,
        help_text=_("Market capitalization in USD"),
    )
    description = models.TextField(
        _("description"), blank=True, help_text=_("Company description")
    )

    # Metadata
    is_active = models.BooleanField(_("active"), default=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    # History tracking
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Stock")
        verbose_name_plural = _("Stocks")
        ordering = ["symbol"]
        indexes = [
            models.Index(fields=["symbol"]),
            models.Index(fields=["exchange"]),
            models.Index(fields=["sector"]),
        ]

    def __str__(self):
        return f"{self.symbol} - {self.name}"

    @property
    def market_cap_formatted(self):
        """Return formatted market cap string."""
        if not self.market_cap:
            return "N/A"

        if self.market_cap >= 1_000_000_000_000:  # Trillion
            return f"${self.market_cap / 1_000_000_000_000:.1f}T"
        if self.market_cap >= 1_000_000_000:  # Billion
            return f"${self.market_cap / 1_000_000_000:.1f}B"
        if self.market_cap >= 1_000_000:  # Million
            return f"${self.market_cap / 1_000_000:.1f}M"
        return f"${self.market_cap:,}"

    @property
    def latest_price(self):
        """Get the latest stock price."""
        return self.prices.filter(interval="1d").order_by("-date").first()

    def get_price_history(self, days=30):
        """Get price history for the last N days."""
        return self.prices.filter(interval="1d").order_by("-date")[:days]

    def get_intraday_data(self, interval="5m", hours=24):
        """Get intraday data for the last N hours."""
        cutoff_time = timezone.now() - timedelta(hours=hours)
        return self.intraday_prices.filter(
            interval=interval, timestamp__gte=cutoff_time
        ).order_by("-timestamp")


class StockPrice(models.Model):
    """
    Model for storing historical stock price data (time series).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="prices")

    # Price data
    open_price = models.DecimalField(
        _("open price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Opening price for the trading period"),
    )
    high_price = models.DecimalField(
        _("high price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Highest price during the trading period"),
    )
    low_price = models.DecimalField(
        _("low price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Lowest price during the trading period"),
    )
    close_price = models.DecimalField(
        _("close price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Closing price for the trading period"),
    )
    adjusted_close = models.DecimalField(
        _("adjusted close"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        null=True,
        blank=True,
        help_text=_("Adjusted closing price accounting for splits and dividends"),
    )

    # Volume and other metrics
    volume = models.BigIntegerField(
        _("volume"),
        validators=[MinValueValidator(0)],
        help_text=_("Number of shares traded"),
    )

    # Time information
    date = models.DateField(_("date"), help_text=_("Trading date"))
    timestamp = models.DateTimeField(
        _("timestamp"),
        null=True,
        blank=True,
        help_text=_("Exact timestamp for intraday data"),
    )

    # Interval type for different time series
    INTERVAL_CHOICES = [
        ("1d", _("Daily")),
        ("4h", _("4 Hours")),
        ("1h", _("Hourly")),
        ("30m", _("30 Minutes")),
        ("15m", _("15 Minutes")),
        ("5m", _("5 Minutes")),
        ("1m", _("1 Minute")),
        ("30s", _("30 Seconds")),
        ("15s", _("15 Seconds")),
        ("5s", _("5 Seconds")),
        ("1s", _("1 Second")),
    ]
    interval = models.CharField(
        _("interval"), max_length=5, choices=INTERVAL_CHOICES, default="1d"
    )

    # Metadata
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Stock Price")
        verbose_name_plural = _("Stock Prices")
        ordering = ["-date", "-created_at"]
        unique_together = ["stock", "date", "timestamp", "interval"]
        indexes = [
            models.Index(fields=["stock", "date"]),
            models.Index(fields=["stock", "interval", "date"]),
            models.Index(fields=["stock", "timestamp"]),
            models.Index(fields=["stock", "interval", "timestamp"]),
            models.Index(fields=["date"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.date} ({self.interval})"

    @property
    def price_change(self):
        """Calculate price change from open to close."""
        if self.close_price is None or self.open_price is None:
            return Decimal("0.00")
        return self.close_price - self.open_price

    @property
    def price_change_percent(self):
        """Calculate percentage price change from open to close."""
        if self.open_price and self.open_price > 0:
            return (self.price_change / self.open_price) * 100
        return Decimal("0.00")


class UserWatchlist(models.Model):
    """
    Model for user's stock watchlist.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="watchlists")
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="watchers")

    # Watchlist metadata
    notes = models.TextField(
        _("notes"), blank=True, help_text=_("Personal notes about this stock")
    )
    target_price = models.DecimalField(
        _("target price"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Target price for alerts"),
    )

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("User Watchlist")
        verbose_name_plural = _("User Watchlists")
        unique_together = ["user", "stock"]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["stock"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.stock.symbol}"


class StockAlert(models.Model):
    """
    Model for stock price alerts.
    """

    ALERT_TYPES = [
        ("above", _("Price Above")),
        ("below", _("Price Below")),
        ("change_percent", _("Percentage Change")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="stock_alerts"
    )
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="alerts")

    alert_type = models.CharField(_("alert type"), max_length=20, choices=ALERT_TYPES)
    threshold_value = models.DecimalField(
        _("threshold value"),
        max_digits=12,
        decimal_places=4,
        help_text=_("Price or percentage threshold for the alert"),
    )

    # Alert status
    is_active = models.BooleanField(_("active"), default=True)
    is_triggered = models.BooleanField(_("triggered"), default=False)
    triggered_at = models.DateTimeField(_("triggered at"), null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Stock Alert")
        verbose_name_plural = _("Stock Alerts")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["stock", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.stock.symbol} {self.alert_type} {self.threshold_value}"


class StockTick(models.Model):
    """
    Model for tick-by-tick price data (real-time price movements).
    This stores individual trades/price updates.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="ticks")

    # Price and volume for this tick
    price = models.DecimalField(
        _("price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Price at this tick"),
    )
    volume = models.BigIntegerField(
        _("volume"),
        validators=[MinValueValidator(0)],
        help_text=_("Volume traded at this price"),
    )

    # Bid/Ask spread information
    bid_price = models.DecimalField(
        _("bid price"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Best bid price"),
    )
    ask_price = models.DecimalField(
        _("ask price"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Best ask price"),
    )
    bid_size = models.BigIntegerField(
        _("bid size"),
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text=_("Volume at bid price"),
    )
    ask_size = models.BigIntegerField(
        _("ask size"),
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text=_("Volume at ask price"),
    )

    # Trade information
    TRADE_TYPES = [
        ("buy", _("Buy")),
        ("sell", _("Sell")),
        ("market", _("Market")),
    ]
    trade_type = models.CharField(
        _("trade type"), max_length=10, choices=TRADE_TYPES, null=True, blank=True
    )

    # Precise timestamp
    timestamp = models.DateTimeField(
        _("timestamp"), help_text=_("Exact timestamp of the tick")
    )

    # Market conditions
    is_market_hours = models.BooleanField(
        _("market hours"),
        default=True,
        help_text=_("Whether this tick occurred during market hours"),
    )

    # Metadata
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        verbose_name = _("Stock Tick")
        verbose_name_plural = _("Stock Ticks")
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["stock", "timestamp"]),
            models.Index(fields=["stock", "is_market_hours", "timestamp"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.price} @ {self.timestamp}"

    @property
    def spread(self):
        """Calculate bid-ask spread."""
        if self.bid_price and self.ask_price:
            return self.ask_price - self.bid_price
        return None

    @property
    def spread_percentage(self):
        """Calculate bid-ask spread as percentage."""
        if self.bid_price and self.ask_price and self.bid_price > 0:
            spread = self.ask_price - self.bid_price
            return (spread / self.bid_price) * 100
        return None


class IntradayPrice(models.Model):
    """
    Model for aggregated intraday price data with sub-minute intervals.
    This is optimized for high-frequency data storage and retrieval.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stock = models.ForeignKey(
        Stock, on_delete=models.CASCADE, related_name="intraday_prices"
    )

    # OHLCV data for the time period
    open_price = models.DecimalField(
        _("open price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    high_price = models.DecimalField(
        _("high price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    low_price = models.DecimalField(
        _("low price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    close_price = models.DecimalField(
        _("close price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    volume = models.BigIntegerField(_("volume"), validators=[MinValueValidator(0)])

    # Additional metrics for intraday analysis
    vwap = models.DecimalField(
        _("VWAP"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        help_text=_("Volume Weighted Average Price"),
    )
    trade_count = models.IntegerField(
        _("trade count"), default=0, help_text=_("Number of trades in this period")
    )

    # Time information with precise intervals
    timestamp = models.DateTimeField(
        _("timestamp"), help_text=_("Start time of the interval")
    )

    INTRADAY_INTERVALS = [
        ("1m", _("1 Minute")),
        ("30s", _("30 Seconds")),
        ("15s", _("15 Seconds")),
        ("10s", _("10 Seconds")),
        ("5s", _("5 Seconds")),
        ("1s", _("1 Second")),
    ]
    interval = models.CharField(
        _("interval"), max_length=5, choices=INTRADAY_INTERVALS, default="1m"
    )

    # Market session information
    session_type = models.CharField(
        _("session type"),
        max_length=20,
        choices=[
            ("pre_market", _("Pre-Market")),
            ("regular", _("Regular Hours")),
            ("after_hours", _("After Hours")),
        ],
        default="regular",
    )

    # Metadata
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        verbose_name = _("Intraday Price")
        verbose_name_plural = _("Intraday Prices")
        ordering = ["-timestamp"]
        unique_together = ["stock", "timestamp", "interval"]
        indexes = [
            models.Index(fields=["stock", "timestamp"]),
            models.Index(fields=["stock", "interval", "timestamp"]),
            models.Index(fields=["stock", "session_type", "timestamp"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.timestamp} ({self.interval})"

    @property
    def price_change(self):
        """Calculate price change from open to close."""
        if self.close_price is None or self.open_price is None:
            return Decimal("0.00")
        return self.close_price - self.open_price

    @property
    def price_change_percent(self):
        """Calculate percentage price change from open to close."""
        if self.open_price > 0:
            return (self.price_change / self.open_price) * 100
        return Decimal("0.00")

    @property
    def typical_price(self):
        """Calculate typical price (HLC/3)."""
        return (self.high_price + self.low_price + self.close_price) / 3


class Order(models.Model):
    """
    Model for stock buy/sell orders (order-based trading system).
    """

    ORDER_STATUS_CHOICES = [
        ("waiting", _("Waiting")),
        ("in_progress", _("In Progress")),
        ("done", _("Done")),
        ("cancelled", _("Cancelled")),
        ("insufficient_funds", _("Insufficient Funds")),
    ]

    ORDER_TYPE_CHOICES = [
        ("market", _("Market Order - Execute at current price")),
        ("target", _("Target Order - Execute when price reaches target")),
    ]

    TRANSACTION_TYPE_CHOICES = [
        ("buy", _("Buy")),
        ("sell", _("Sell")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="orders")
    history = HistoricalRecords()

    # Order details
    transaction_type = models.CharField(
        _("transaction type"),
        max_length=4,
        choices=TRANSACTION_TYPE_CHOICES,
        default="buy",
        help_text=_("Type of transaction: buy or sell"),
    )
    order_type = models.CharField(
        _("order type"),
        max_length=10,
        choices=ORDER_TYPE_CHOICES,
        default="market",
        help_text=_("Type of order: market (immediate) or target (conditional)"),
    )
    quantity = models.DecimalField(
        _("quantity"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Number of shares to purchase"),
    )
    target_price = models.DecimalField(
        _("target price"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Target price for conditional orders (only for target orders)"),
    )

    # Order status
    status = models.CharField(
        _("status"),
        max_length=25,
        choices=ORDER_STATUS_CHOICES,
        default="waiting",
        help_text=_("Current status of the order"),
    )

    # Execution details (filled when order is executed)
    executed_price = models.DecimalField(
        _("executed price"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Price at which the order was executed"),
    )
    executed_at = models.DateTimeField(
        _("executed at"),
        null=True,
        blank=True,
        help_text=_("When the order was executed"),
    )

    # Notes
    notes = models.TextField(
        _("notes"), blank=True, help_text=_("Personal notes about this order")
    )

    # Bot reference (if order was created by a trading bot)
    # Note: Using string reference to avoid forward reference issues
    bot_config = models.ForeignKey(
        "TradingBotConfig",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        help_text=_("Trading bot that created this order"),
    )

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Order")
        verbose_name_plural = _("Orders")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status", "created_at"]),
            models.Index(fields=["stock", "status"]),
            models.Index(fields=["status", "order_type"]),
            models.Index(fields=["user", "stock"]),
            models.Index(fields=["transaction_type", "status"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.get_transaction_type_display()} {self.stock.symbol} ({self.quantity} shares) - {self.get_status_display()}"

    @property
    def can_execute(self):  # noqa: PLR0911
        """Check if order can be executed based on current market price and holdings."""
        if self.status != "waiting":
            logger.warning(
                f"Order {self.id} cannot be executed - status is not waiting"
            )
            return False

        latest_price = self.stock.latest_price
        if not latest_price:
            logger.warning(f"Order {self.id} cannot be executed - no latest price")
            return False

        # For sell orders, check if user has enough shares
        if self.transaction_type == "sell":
            try:
                portfolio_entry = Portfolio.objects.get(
                    user=self.user, stock=self.stock
                )
                if portfolio_entry.quantity < self.quantity:
                    logger.warning(
                        f"Order {self.id} cannot be executed - insufficient shares"
                    )
                    return False  # Insufficient shares
            except Portfolio.DoesNotExist:
                logger.warning(
                    f"Order {self.id} cannot be executed - no portfolio entry"
                )
                return False  # No shares to sell

        # For buy orders, check if user has enough cash
        if self.transaction_type == "buy":
            from users.models import UserProfile

            try:
                user_profile = UserProfile.objects.get(user=self.user)
                total_cost = self.quantity * latest_price.close_price
                if user_profile.cash < total_cost:
                    logger.warning(
                        f"Order {self.id} cannot be executed - insufficient funds"
                    )
                    return False  # Insufficient funds
            except UserProfile.DoesNotExist:
                logger.warning(f"Order {self.id} cannot be executed - no user profile")
                return False  # No user profile

        if self.order_type == "market":
            logger.info(f"Order {self.id} can be executed - market order")
            return True  # Market orders can always execute

        if self.order_type == "target" and self.target_price:
            # For buy orders: execute if price reaches or goes below target
            # For sell orders: execute if price reaches or goes above target
            if self.transaction_type == "buy":
                return latest_price.close_price <= self.target_price
            # sell
            return latest_price.close_price >= self.target_price
        logger.warning(
            f"Order {self.id} cannot be executed - order type is not market or target"
        )
        return False

    def execute(self):  # noqa: PLR0915
        """Execute the order and update portfolio/cash accordingly."""
        if not self.can_execute:
            logger.warning(f"Order {self.id} cannot be executed - can_execute is False")
            return False

        latest_price = self.stock.latest_price
        if not latest_price:
            logger.warning(f"Order {self.id} cannot be executed - no latest price")
            return False
        logger.info(
            f"Order {self.id} can be executed - latest price: {latest_price.close_price}"
        )
        # Set execution price
        execution_price = latest_price.close_price
        total_cost = self.quantity * execution_price
        logger.info(f"Order {self.id} total cost: {total_cost}")
        # Get user profile for cash management
        from users.models import UserProfile

        user_profile = UserProfile.objects.get(user=self.user)
        logger.info(f"Order {self.id} user profile: {user_profile.cash}")
        # Handle buy orders
        if self.transaction_type == "buy":
            # Check if user has enough cash
            if user_profile.cash < total_cost:
                logger.warning(
                    f"Order {self.id} cannot be executed - insufficient funds. Need: {total_cost}, Have: {user_profile.cash}"
                )
                self.status = "insufficient_funds"
                self.save()
                return False  # Insufficient funds

            # Deduct cash
            user_profile.cash -= total_cost
            user_profile.save()
            logger.info(f"Order {self.id} cash deducted: {total_cost}")
            # Get or create portfolio entry for this stock
            portfolio_entry, created = Portfolio.objects.get_or_create(
                user=self.user,
                stock=self.stock,
                defaults={
                    "quantity": Decimal("0.00"),
                    "purchase_price": execution_price,
                    "purchase_date": timezone.now().date(),
                },
            )

            # Update portfolio: add quantity and recalculate average purchase price
            if created:
                portfolio_entry.quantity = self.quantity
                portfolio_entry.purchase_price = execution_price
            else:
                # Calculate weighted average purchase price
                total_shares = portfolio_entry.quantity + self.quantity
                total_value = (
                    portfolio_entry.quantity * portfolio_entry.purchase_price
                ) + total_cost
                portfolio_entry.purchase_price = total_value / total_shares
                portfolio_entry.quantity = total_shares

            portfolio_entry.notes = self.notes or portfolio_entry.notes
            portfolio_entry.order = self
            portfolio_entry.save()

        # Handle sell orders
        elif self.transaction_type == "sell":
            # Check if user has enough shares
            try:
                portfolio_entry = Portfolio.objects.get(
                    user=self.user, stock=self.stock
                )
            except Portfolio.DoesNotExist:
                self.status = "insufficient_funds"  # No shares to sell
                self.save()
                return False

            if portfolio_entry.quantity < self.quantity:
                self.status = "insufficient_funds"  # Insufficient shares
                self.save()
                return False

            # Add cash from sale
            user_profile.cash += total_cost
            user_profile.save()

            # Update portfolio: reduce quantity
            portfolio_entry.quantity -= self.quantity

            # If quantity becomes zero or negative, delete the portfolio entry
            if portfolio_entry.quantity <= Decimal("0.00"):
                portfolio_entry.delete()
            else:
                portfolio_entry.save()

        # Mark order as executed
        self.executed_price = execution_price
        self.executed_at = timezone.now()
        self.status = "in_progress"
        self.save()

        # Mark order as done
        self.status = "done"
        self.save()

        return True


class Portfolio(models.Model):
    """
    Model for user's stock portfolio (purchased stocks).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="portfolio_holdings"
    )
    stock = models.ForeignKey(
        Stock, on_delete=models.CASCADE, related_name="portfolio_holders"
    )
    order = models.ForeignKey(
        "Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="portfolio_entry",
        help_text=_("The order that created this portfolio entry"),
    )

    # Purchase information
    quantity = models.DecimalField(
        _("quantity"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Number of shares purchased"),
    )
    purchase_price = models.DecimalField(
        _("purchase price"),
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Price per share at purchase"),
    )
    purchase_date = models.DateField(
        _("purchase date"), help_text=_("Date when the stock was purchased")
    )

    # Notes
    notes = models.TextField(
        _("notes"), blank=True, help_text=_("Personal notes about this holding")
    )

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Portfolio")
        verbose_name_plural = _("Portfolios")
        ordering = ["-purchase_date", "-created_at"]
        indexes = [
            models.Index(fields=["user", "purchase_date"]),
            models.Index(fields=["stock"]),
            models.Index(fields=["user", "stock"]),
        ]

    # History tracking
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.user.email} - {self.stock.symbol} ({self.quantity} shares)"

    @property
    def total_cost(self):
        """Calculate total cost of purchase."""
        return self.quantity * self.purchase_price

    @property
    def current_value(self):
        """Calculate current value based on latest price."""
        latest_price = self.stock.latest_price
        if latest_price:
            return self.quantity * latest_price.close_price
        return Decimal("0.00")

    @property
    def gain_loss(self):
        """Calculate gain/loss amount."""
        return self.current_value - self.total_cost

    @property
    def gain_loss_percent(self):
        """Calculate gain/loss percentage."""
        if self.total_cost > 0:
            return (self.gain_loss / self.total_cost) * 100
        return Decimal("0.00")


class TradingBotConfig(models.Model):
    """
    Model for trading bot configuration.
    """

    BUDGET_TYPE_CHOICES = [
        ("cash", _("Cash Budget")),
        ("portfolio", _("Portfolio Budget")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="trading_bots"
    )
    name = models.CharField(
        _("name"), max_length=200, help_text=_("Bot name/identifier")
    )
    is_active = models.BooleanField(
        _("active"), default=False, help_text=_("Is bot active")
    )

    # Budget configuration
    budget_type = models.CharField(
        _("budget type"),
        max_length=20,
        choices=BUDGET_TYPE_CHOICES,
        default="cash",
        help_text=_("Type of budget assignment: cash or portfolio"),
    )
    budget_cash = models.DecimalField(
        _("budget cash"),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Cash budget amount (if budget_type is 'cash')"),
    )
    budget_portfolio = models.ManyToManyField(
        Portfolio,
        related_name="bot_configs",
        blank=True,
        help_text=_(
            "Existing portfolio positions assigned to bot (if budget_type is 'portfolio')"
        ),
    )

    # Stock assignment
    assigned_stocks = models.ManyToManyField(
        Stock,
        related_name="bot_configs",
        help_text=_("Stock symbols in which bot can operate (REQUIRED)"),
    )

    # Risk management
    max_position_size = models.DecimalField(
        _("max position size"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_("Maximum position size per trade"),
    )
    max_daily_trades = models.IntegerField(
        _("max daily trades"),
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text=_("Maximum trades per day"),
    )
    max_daily_loss = models.DecimalField(
        _("max daily loss"),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Maximum loss threshold per day"),
    )
    risk_per_trade = models.DecimalField(
        _("risk per trade"),
        max_digits=5,
        decimal_places=2,
        default=Decimal("2.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text=_("Risk percentage per trade (0.01-100)"),
    )
    stop_loss_percent = models.DecimalField(
        _("stop loss percent"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text=_("Stop loss percentage (0.01-100)"),
    )
    take_profit_percent = models.DecimalField(
        _("take profit percent"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text=_("Take profit percentage (0.01-100)"),
    )

    # Analysis period
    period_days = models.IntegerField(
        _("period days"),
        default=14,
        validators=[MinValueValidator(1), MaxValueValidator(365)],
        help_text=_(
            "Number of days to look back for indicators and patterns calculation (1-365)"
        ),
    )

    # ML Models configuration
    enabled_ml_models = models.JSONField(
        _("enabled ml models"),
        default=list,
        blank=True,
        help_text=_("List of ML model IDs to use"),
    )
    ml_model_weights = models.JSONField(
        _("ml model weights"),
        default=dict,
        blank=True,
        help_text=_("Weights for each ML model (model_id: weight)"),
    )

    # Signal sources
    enable_social_analysis = models.BooleanField(
        _("enable social analysis"),
        default=False,
        help_text=_("Enable social media sentiment analysis"),
    )
    enable_news_analysis = models.BooleanField(
        _("enable news analysis"),
        default=False,
        help_text=_("Enable news sentiment analysis"),
    )

    # Signal aggregation
    signal_aggregation_method = models.CharField(
        _("signal aggregation method"),
        max_length=20,
        choices=[
            ("weighted_average", _("Weighted Average")),
            ("ensemble_voting", _("Ensemble Voting")),
            ("threshold_based", _("Threshold Based")),
            ("custom_rule", _("Custom Rule")),
        ],
        default="weighted_average",
        help_text=_("Method to combine multiple signals"),
    )
    signal_weights = models.JSONField(
        _("signal weights"),
        default=dict,
        blank=True,
        help_text=_(
            "Weights for each signal type (ml, indicators, patterns, social, news)"
        ),
    )
    signal_thresholds = models.JSONField(
        _("signal thresholds"),
        default=dict,
        blank=True,
        help_text=_("Minimum thresholds for signals (confidence, strength, count)"),
    )
    risk_score_threshold = models.DecimalField(
        _("risk score threshold"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Maximum risk score to allow trading (0-100)"),
    )
    risk_adjustment_factor = models.DecimalField(
        _("risk adjustment factor"),
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.40"),
        validators=[
            MinValueValidator(Decimal("0.00")),
            MinValueValidator(Decimal("1.00")),
        ],
        help_text=_("How much risk reduces signal confidence (0-1)"),
    )
    risk_based_position_scaling = models.BooleanField(
        _("risk based position scaling"),
        default=True,
        help_text=_("Automatically reduce position size when risk score is high"),
    )

    # Trading rules
    enabled_indicators = models.JSONField(
        _("enabled indicators"),
        default=dict,
        blank=True,
        help_text=_("Indicator configurations (JSON)"),
    )
    indicator_thresholds = models.JSONField(
        _("indicator thresholds"),
        default=dict,
        blank=True,
        help_text=_(
            "Custom thresholds for indicator signals (overrides defaults). "
            "Format: {'rsi': {'oversold': 30, 'overbought': 70}, ...}"
        ),
    )
    enabled_patterns = models.JSONField(
        _("enabled patterns"),
        default=dict,
        blank=True,
        help_text=_("Pattern configurations (JSON)"),
    )
    buy_rules = models.JSONField(
        _("buy rules"),
        default=dict,
        blank=True,
        help_text=_("Buy condition rules (JSON)"),
    )
    sell_rules = models.JSONField(
        _("sell rules"),
        default=dict,
        blank=True,
        help_text=_("Sell condition rules (JSON)"),
    )

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Trading Bot Config")
        verbose_name_plural = _("Trading Bot Configs")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["is_active", "created_at"]),
        ]

    # History tracking
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.user.email} - {self.name} ({'Active' if self.is_active else 'Inactive'})"

    def clean(self):
        """Validate bot configuration."""
        from django.core.exceptions import ValidationError

        if self.budget_type == "cash" and not self.budget_cash:
            raise ValidationError(
                _("Cash budget is required when budget_type is 'cash'")
            )
        if self.budget_type == "portfolio" and not self.budget_portfolio.exists():
            raise ValidationError(
                _("Portfolio positions are required when budget_type is 'portfolio'")
            )
        if not self.assigned_stocks.exists():
            raise ValidationError(_("At least one stock must be assigned to the bot"))


class TradingBotExecution(models.Model):
    """
    Model for tracking trading bot execution history.
    """

    ACTION_CHOICES = [
        ("buy", _("Buy")),
        ("sell", _("Sell")),
        ("skip", _("Skip")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bot_config = models.ForeignKey(
        TradingBotConfig,
        on_delete=models.CASCADE,
        related_name="executions",
    )
    stock = models.ForeignKey(
        Stock, on_delete=models.CASCADE, related_name="bot_executions"
    )
    action = models.CharField(
        _("action"),
        max_length=10,
        choices=ACTION_CHOICES,
        help_text=_("Action taken by bot: buy, sell, or skip"),
    )
    reason = models.TextField(
        _("reason"), blank=True, help_text=_("Why the decision was made")
    )
    indicators_data = models.JSONField(
        _("indicators data"),
        default=dict,
        blank=True,
        help_text=_("Snapshot of indicators at decision time"),
    )
    patterns_detected = models.JSONField(
        _("patterns detected"),
        default=dict,
        blank=True,
        help_text=_("Patterns found at decision time"),
    )
    risk_score = models.DecimalField(
        _("risk score"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Calculated risk score (0-100)"),
    )
    executed_order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bot_executions",
        help_text=_("Order created if trade was executed"),
    )
    timestamp = models.DateTimeField(_("timestamp"), auto_now_add=True)

    class Meta:
        verbose_name = _("Trading Bot Execution")
        verbose_name_plural = _("Trading Bot Executions")
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["bot_config", "timestamp"]),
            models.Index(fields=["stock", "timestamp"]),
            models.Index(fields=["action", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.bot_config.name} - {self.stock.symbol} - {self.get_action_display()} @ {self.timestamp}"


class MLModel(models.Model):
    """
    Model for storing registered ML models with metadata.
    """

    MODEL_TYPE_CHOICES = [
        ("classification", _("Classification")),
        ("regression", _("Regression")),
    ]

    FRAMEWORK_CHOICES = [
        ("sklearn", _("scikit-learn")),
        ("pytorch", _("PyTorch")),
        ("tensorflow", _("TensorFlow")),
        ("custom", _("Custom")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        _("name"), max_length=200, help_text=_("Model name/identifier")
    )
    model_type = models.CharField(
        _("model type"),
        max_length=20,
        choices=MODEL_TYPE_CHOICES,
        help_text=_("Type of model: classification or regression"),
    )
    framework = models.CharField(
        _("framework"),
        max_length=20,
        choices=FRAMEWORK_CHOICES,
        help_text=_("ML framework used"),
    )
    version = models.CharField(
        _("version"), max_length=50, default="1.0.0", help_text=_("Model version")
    )
    description = models.TextField(
        _("description"), blank=True, help_text=_("Model description")
    )
    parameters = models.JSONField(
        _("parameters"),
        default=dict,
        blank=True,
        help_text=_("Model parameters and configuration (JSON)"),
    )
    is_active = models.BooleanField(
        _("active"), default=True, help_text=_("Is model active and available")
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("ML Model")
        verbose_name_plural = _("ML Models")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_active", "model_type"]),
            models.Index(fields=["framework", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.framework}) - {self.get_model_type_display()}"

    def get_metadata(self) -> dict:
        """Get model metadata."""
        return {
            "id": str(self.id),
            "name": self.name,
            "model_type": self.model_type,
            "framework": self.framework,
            "version": self.version,
            "description": self.description,
            "parameters": self.parameters,
            "is_active": self.is_active,
        }


class BotSignalHistory(models.Model):
    """
    Model for tracking all signals and decisions for bot analysis.
    Provides transparent audit trail of all signal sources and decision-making.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bot_config = models.ForeignKey(
        TradingBotConfig,
        on_delete=models.CASCADE,
        related_name="signal_history",
        help_text=_("Bot configuration that generated this signal"),
    )
    stock = models.ForeignKey(
        Stock,
        on_delete=models.CASCADE,
        related_name="signal_history",
        help_text=_("Stock being analyzed"),
    )
    timestamp = models.DateTimeField(
        _("timestamp"), auto_now_add=True, help_text=_("When analysis was performed")
    )
    price_data_snapshot = models.JSONField(
        _("price data snapshot"),
        default=dict,
        blank=True,
        help_text=_("Snapshot of price data at analysis time"),
    )
    ml_signals = models.JSONField(
        _("ml signals"),
        default=dict,
        blank=True,
        help_text=_("ML model predictions and signals"),
    )
    social_signals = models.JSONField(
        _("social signals"),
        default=dict,
        blank=True,
        help_text=_("Social media sentiment signals"),
    )
    news_signals = models.JSONField(
        _("news signals"),
        default=dict,
        blank=True,
        help_text=_("News sentiment signals"),
    )
    indicator_signals = models.JSONField(
        _("indicator signals"),
        default=dict,
        blank=True,
        help_text=_("Technical indicator signals"),
    )
    pattern_signals = models.JSONField(
        _("pattern signals"),
        default=dict,
        blank=True,
        help_text=_("Chart pattern signals"),
    )
    aggregated_signal = models.JSONField(
        _("aggregated signal"),
        default=dict,
        blank=True,
        help_text=_("Combined signal after aggregation"),
    )
    final_decision = models.CharField(
        _("final decision"),
        max_length=10,
        choices=[("buy", _("Buy")), ("sell", _("Sell")), ("hold", _("Hold"))],
        help_text=_("Final trading decision"),
    )
    decision_confidence = models.DecimalField(
        _("decision confidence"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Confidence in final decision (0-100)"),
    )
    risk_score = models.DecimalField(
        _("risk score"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Calculated risk score (0-100)"),
    )
    execution = models.ForeignKey(
        TradingBotExecution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signal_history",
        help_text=_("Related bot execution if trade was executed"),
    )

    class Meta:
        verbose_name = _("Bot Signal History")
        verbose_name_plural = _("Bot Signal Histories")
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["bot_config", "timestamp"]),
            models.Index(fields=["stock", "timestamp"]),
            models.Index(fields=["final_decision", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.bot_config.name} - {self.stock.symbol} - {self.final_decision} @ {self.timestamp}"


class NewsSource(models.Model):
    """
    Model for configuring news sources.
    """

    SOURCE_TYPE_CHOICES = [
        ("api", _("API")),
        ("scraper", _("Web Scraper")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_("name"), max_length=200, help_text=_("News source name"))
    source_type = models.CharField(
        _("source type"),
        max_length=20,
        choices=SOURCE_TYPE_CHOICES,
        help_text=_("Type of news source"),
    )
    api_config = models.JSONField(
        _("api config"),
        default=dict,
        blank=True,
        help_text=_("API configuration (keys, endpoints, etc.)"),
    )
    is_active = models.BooleanField(
        _("active"), default=True, help_text=_("Is source active")
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("News Source")
        verbose_name_plural = _("News Sources")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_source_type_display()})"


class SocialMediaSource(models.Model):
    """
    Model for configuring social media sources.
    """

    PLATFORM_CHOICES = [
        ("twitter", _("Twitter")),
        ("reddit", _("Reddit")),
        ("stocktwits", _("StockTwits")),
        ("other", _("Other")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        _("name"), max_length=200, help_text=_("Social media source name")
    )
    platform = models.CharField(
        _("platform"),
        max_length=20,
        choices=PLATFORM_CHOICES,
        help_text=_("Social media platform"),
    )
    api_config = models.JSONField(
        _("api config"),
        default=dict,
        blank=True,
        help_text=_("API configuration (keys, endpoints, etc.)"),
    )
    is_active = models.BooleanField(
        _("active"), default=True, help_text=_("Is source active")
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Social Media Source")
        verbose_name_plural = _("Social Media Sources")
        ordering = ["platform", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_platform_display()})"


class TradingBotSettings(models.Model):
    """
    Singleton model for Trading Bot global settings.
    Only one instance should exist in the database.
    """

    id = models.AutoField(primary_key=True)
    default_indicator_thresholds = models.JSONField(
        _("default indicator thresholds"),
        default=dict,
        blank=True,
        help_text=_(
            "Default threshold values for all technical indicators. "
            "These values are used when bot configs don't specify custom thresholds."
        ),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Trading Bot Settings")
        verbose_name_plural = _("Trading Bot Settings")

    def __str__(self):
        return "Trading Bot Settings"

    def save(self, *args, **kwargs):
        """
        Ensure only one instance exists.
        """
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """
        Prevent deletion of the singleton instance.
        """

    @classmethod
    def load(cls):
        """
        Get or create the singleton instance.
        """
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
