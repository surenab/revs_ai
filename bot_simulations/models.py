"""
Models for bot simulation functionality.
"""

import logging
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from stocks.models import Stock

User = get_user_model()
logger = logging.getLogger(__name__)


class BotSimulationRun(models.Model):
    """
    Model for tracking multi-bot simulation runs.
    """

    STATUS_CHOICES = [
        ("pending", _("Pending")),
        ("running", _("Running")),
        ("paused", _("Paused")),
        ("completed", _("Completed")),
        ("failed", _("Failed")),
        ("cancelled", _("Cancelled")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="simulation_runs"
    )
    name = models.CharField(
        _("name"), max_length=200, help_text=_("Simulation run name/identifier")
    )
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text=_("Current status of the simulation"),
    )

    # Bot execution period - when bot should actually execute trades
    execution_start_date = models.DateField(
        _("execution start date"),
        null=True,
        blank=True,
        help_text=_(
            "Start date when bot should begin executing trades (daily execution)"
        ),
    )
    execution_end_date = models.DateField(
        _("execution end date"),
        null=True,
        blank=True,
        help_text=_("End date when bot should stop executing trades"),
    )

    # Data point counts
    total_data_points = models.IntegerField(
        _("total data points"),
        default=0,
        help_text=_("Total number of tick data points"),
    )
    training_data_points = models.IntegerField(
        _("training data points"),
        default=0,
        help_text=_("Number of tick data points in training set"),
    )
    validation_data_points = models.IntegerField(
        _("validation data points"),
        default=0,
        help_text=_("Number of tick data points in validation set"),
    )

    # Stocks to test
    stocks = models.ManyToManyField(
        Stock,
        related_name="simulation_runs",
        help_text=_("Stocks to include in simulation"),
    )

    # Configuration
    total_bots = models.IntegerField(
        _("total bots"),
        default=0,
        help_text=_("Total number of bot configurations to test"),
    )
    config_ranges = models.JSONField(
        _("config ranges"),
        default=dict,
        blank=True,
        help_text=_("Parameter ranges used for grid search"),
    )

    # Progress tracking
    progress = models.DecimalField(
        _("progress"),
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(Decimal("100.00")),
        ],
        help_text=_("Simulation progress percentage (0-100)"),
    )
    current_day = models.DateField(
        _("current day"),
        null=True,
        blank=True,
        help_text=_("Current day being processed"),
    )
    bots_completed = models.IntegerField(
        _("bots completed"), default=0, help_text=_("Number of bots completed")
    )

    # Results summary
    top_performers = models.JSONField(
        _("top performers"),
        default=list,
        blank=True,
        help_text=_("Top performing bot configurations"),
    )
    # Bot execution times for better estimation (stores list of seconds per bot)
    bot_execution_times = models.JSONField(
        _("bot execution times"),
        default=list,
        blank=True,
        help_text=_(
            "Execution times in seconds for each completed bot (for ETA calculation)"
        ),
    )
    error_message = models.TextField(
        _("error message"),
        blank=True,
        help_text=_("Error message if simulation failed"),
    )

    # Simulation type and initial state
    SIMULATION_TYPE_CHOICES = [
        ("fund", _("Fund Based")),
        ("portfolio", _("Portfolio Based")),
    ]
    simulation_type = models.CharField(
        _("simulation type"),
        max_length=20,
        choices=SIMULATION_TYPE_CHOICES,
        default="fund",
        help_text=_(
            "Type of simulation: fund-based (cash) or portfolio-based (existing positions)"
        ),
    )
    initial_fund = models.DecimalField(
        _("initial fund"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("10000.00"),
        help_text=_("Initial cash fund for fund-based simulations"),
    )
    initial_portfolio = models.JSONField(
        _("initial portfolio"),
        default=dict,
        blank=True,
        help_text=_(
            "Initial portfolio for portfolio-based simulations. Format: {'SYMBOL': quantity, ...}"
        ),
    )

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    started_at = models.DateTimeField(_("started at"), null=True, blank=True)
    completed_at = models.DateTimeField(_("completed at"), null=True, blank=True)

    class Meta:
        verbose_name = _("Bot Simulation Run")
        verbose_name_plural = _("Bot Simulation Runs")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.name} - {self.get_status_display()}"


class BotSimulationConfig(models.Model):
    """
    Individual bot configuration for a simulation run.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    simulation_run = models.ForeignKey(
        BotSimulationRun,
        on_delete=models.CASCADE,
        related_name="bot_configs",
        help_text=_("Parent simulation run"),
    )
    bot_index = models.IntegerField(
        _("bot index"), help_text=_("Index of this bot in the simulation (0-based)")
    )

    # Bot configuration (full JSON config)
    config_json = models.JSONField(
        _("config json"),
        default=dict,
        help_text=_("Complete bot configuration as JSON"),
    )

    # Stock assignment
    assigned_stocks = models.ManyToManyField(
        Stock,
        related_name="simulation_configs",
        help_text=_("Stocks assigned to this bot"),
    )

    # Feature flags
    use_social_analysis = models.BooleanField(
        _("use social analysis"),
        default=False,
        help_text=_("Whether to use social media analysis"),
    )
    use_news_analysis = models.BooleanField(
        _("use news analysis"),
        default=False,
        help_text=_("Whether to use news analysis"),
    )

    # Progress tracking fields
    STATUS_CHOICES = [
        ("pending", _("Pending")),
        ("running", _("Running")),
        ("completed", _("Completed")),
        ("failed", _("Failed")),
    ]
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text=_("Current execution status of this bot"),
    )
    current_date = models.DateField(
        _("current date"),
        null=True,
        blank=True,
        help_text=_("Current day being processed for this bot"),
    )
    current_tick_index = models.IntegerField(
        _("current tick index"),
        default=0,
        help_text=_("Current tick index within the current day"),
    )
    progress_percentage = models.DecimalField(
        _("progress percentage"),
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(Decimal("100.00")),
        ],
        help_text=_("Progress percentage for this bot (0-100)"),
    )

    class Meta:
        verbose_name = _("Bot Simulation Config")
        verbose_name_plural = _("Bot Simulation Configs")
        ordering = ["simulation_run", "bot_index"]
        unique_together = ["simulation_run", "bot_index"]
        indexes = [
            models.Index(fields=["simulation_run", "bot_index"]),
        ]

    def __str__(self):
        return f"{self.simulation_run.name} - Bot {self.bot_index}"


class BotSimulationDay(models.Model):
    """
    Daily execution results for each bot in a simulation.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    simulation_config = models.ForeignKey(
        BotSimulationConfig,
        on_delete=models.CASCADE,
        related_name="daily_results",
        help_text=_("Bot configuration for this day"),
    )
    date = models.DateField(_("date"), help_text=_("Trading date"))

    # Decisions made on this day
    decisions = models.JSONField(
        _("decisions"),
        default=dict,
        blank=True,
        help_text=_("Decisions made for each stock (buy/sell/hold)"),
    )

    # Actual prices and outcomes
    actual_prices = models.JSONField(
        _("actual prices"),
        default=dict,
        blank=True,
        help_text=_("Actual prices for each stock on this day"),
    )

    # Performance metrics for this day
    performance_metrics = models.JSONField(
        _("performance metrics"),
        default=dict,
        blank=True,
        help_text=_("Daily performance metrics (profit, trades, etc.)"),
    )

    # Signal contributions
    signal_contributions = models.JSONField(
        _("signal contributions"),
        default=dict,
        blank=True,
        help_text=_("Which signals contributed to each decision"),
    )

    class Meta:
        verbose_name = _("Bot Simulation Day")
        verbose_name_plural = _("Bot Simulation Days")
        ordering = ["simulation_config", "date"]
        unique_together = ["simulation_config", "date"]
        indexes = [
            models.Index(fields=["simulation_config", "date"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        return f"{self.simulation_config} - {self.date}"


class BotSimulationResult(models.Model):
    """
    Final aggregated results for each bot configuration in a simulation.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    simulation_config = models.OneToOneField(
        BotSimulationConfig,
        on_delete=models.CASCADE,
        related_name="final_result",
        help_text=_("Bot configuration for this result"),
    )

    # Performance metrics
    total_profit = models.DecimalField(
        _("total profit"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("Total profit/loss in USD"),
    )
    total_trades = models.IntegerField(
        _("total trades"), default=0, help_text=_("Total number of trades executed")
    )
    winning_trades = models.IntegerField(
        _("winning trades"), default=0, help_text=_("Number of profitable trades")
    )
    losing_trades = models.IntegerField(
        _("losing trades"), default=0, help_text=_("Number of losing trades")
    )
    win_rate = models.DecimalField(
        _("win rate"),
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(Decimal("100.00")),
        ],
        help_text=_("Win rate percentage (0-100)"),
    )

    # Additional metrics
    average_profit = models.DecimalField(
        _("average profit"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("Average profit per trade"),
    )
    average_loss = models.DecimalField(
        _("average loss"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("Average loss per trade"),
    )
    max_drawdown = models.DecimalField(
        _("max drawdown"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("Maximum drawdown in USD"),
    )
    sharpe_ratio = models.DecimalField(
        _("sharpe ratio"),
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text=_("Sharpe ratio (risk-adjusted return)"),
    )

    # Signal productivity analysis
    signal_productivity = models.JSONField(
        _("signal productivity"),
        default=dict,
        blank=True,
        help_text=_(
            "Analysis of which signals contributed to correct decisions. "
            "Format: {signal_type: {accuracy, true_positives, false_positives, contribution}}"
        ),
    )

    # Best and worst decisions
    best_decisions = models.JSONField(
        _("best decisions"),
        default=list,
        blank=True,
        help_text=_("Best performing decisions with details"),
    )
    worst_decisions = models.JSONField(
        _("worst decisions"),
        default=list,
        blank=True,
        help_text=_("Worst performing decisions with details"),
    )

    # Final portfolio state
    final_cash = models.DecimalField(
        _("final cash"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("Final cash balance"),
    )
    final_portfolio_value = models.DecimalField(
        _("final portfolio value"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("Final total portfolio value"),
    )

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        verbose_name = _("Bot Simulation Result")
        verbose_name_plural = _("Bot Simulation Results")
        ordering = ["-total_profit"]
        indexes = [
            models.Index(fields=["simulation_config"]),
            models.Index(fields=["-total_profit"]),
            models.Index(fields=["-win_rate"]),
        ]

    def __str__(self):
        return f"{self.simulation_config} - Profit: ${self.total_profit}"


class BotSimulationTick(models.Model):
    """
    Individual tick-level execution results for each bot in a simulation.
    Stores decisions made at each tick with full metadata.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    simulation_config = models.ForeignKey(
        BotSimulationConfig,
        on_delete=models.CASCADE,
        related_name="tick_results",
        help_text=_("Bot configuration for this tick"),
    )
    date = models.DateField(_("date"), help_text=_("Trading date"))
    tick_timestamp = models.DateTimeField(
        _("tick timestamp"), help_text=_("Exact timestamp of this tick")
    )
    stock_symbol = models.CharField(
        _("stock symbol"), max_length=20, help_text=_("Stock symbol for this tick")
    )
    tick_price = models.DecimalField(
        _("tick price"),
        max_digits=15,
        decimal_places=4,
        help_text=_("Price at this tick"),
    )

    # Decision made at this tick
    decision = models.JSONField(
        _("decision"),
        default=dict,
        blank=True,
        help_text=_(
            "Buy/hold/sell decision with metadata (action, confidence, risk_score, position_size, reason)"
        ),
    )

    # Signal contributions
    signal_contributions = models.JSONField(
        _("signal contributions"),
        default=dict,
        blank=True,
        help_text=_(
            "Which signals contributed to this decision (indicators, patterns, ML, social, news)"
        ),
    )

    # Portfolio state at this tick
    portfolio_state = models.JSONField(
        _("portfolio state"),
        default=dict,
        blank=True,
        help_text=_("Portfolio state at this tick (cash, positions, portfolio_value)"),
    )

    # Cumulative profit up to this tick
    cumulative_profit = models.DecimalField(
        _("cumulative profit"),
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("Cumulative profit/loss up to this tick"),
    )

    # Trade execution info (if trade was executed)
    trade_executed = models.BooleanField(
        _("trade executed"),
        default=False,
        help_text=_("Whether a trade was executed at this tick"),
    )
    trade_details = models.JSONField(
        _("trade details"),
        default=dict,
        blank=True,
        help_text=_("Trade execution details (action, quantity, price, cost/revenue)"),
    )

    class Meta:
        verbose_name = _("Bot Simulation Tick")
        verbose_name_plural = _("Bot Simulation Ticks")
        ordering = ["simulation_config", "date", "tick_timestamp"]
        indexes = [
            models.Index(fields=["simulation_config", "date"]),
            models.Index(fields=["simulation_config", "date", "tick_timestamp"]),
            models.Index(fields=["date", "stock_symbol"]),
        ]

    def __str__(self):
        return f"{self.simulation_config} - {self.date} {self.tick_timestamp} - {self.stock_symbol}"
