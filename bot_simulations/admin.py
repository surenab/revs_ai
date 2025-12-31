"""
Admin configuration for bot simulation models.
"""

from django.contrib import admin, messages
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

from bot_simulations.models import (
    BotSimulationConfig,
    BotSimulationDay,
    BotSimulationResult,
    BotSimulationRun,
)


class BotSimulationConfigInline(admin.TabularInline):
    """Inline admin for bot configurations within a simulation run."""

    model = BotSimulationConfig
    extra = 0
    readonly_fields = ["id", "bot_index", "use_social_analysis", "use_news_analysis"]
    fields = [
        "bot_index",
        "assigned_stocks",
        "use_social_analysis",
        "use_news_analysis",
    ]
    filter_horizontal = ["assigned_stocks"]
    can_delete = False


@admin.register(BotSimulationRun)
class BotSimulationRunAdmin(admin.ModelAdmin):
    """Admin interface for BotSimulationRun."""

    list_display = [
        "name",
        "user",
        "status",
        "progress_display",
        "total_bots",
        "bots_completed",
        "execution_start_date",
        "execution_end_date",
        "created_at",
        "started_at",
        "completed_at",
    ]
    list_filter = [
        "status",
        "created_at",
        "started_at",
        "completed_at",
    ]
    search_fields = [
        "name",
        "user__email",
        "user__first_name",
        "user__last_name",
        "id",
    ]
    readonly_fields = [
        "id",
        "user",
        "total_bots",
        "progress",
        "current_day",
        "bots_completed",
        "top_performers",
        "error_message",
        "created_at",
        "started_at",
        "completed_at",
        "total_data_points",
    ]
    filter_horizontal = ["stocks"]
    fieldsets = (
        ("Basic Information", {"fields": ("id", "name", "user", "status")}),
        (
            "Execution Period",
            {
                "fields": (
                    "execution_start_date",
                    "execution_end_date",
                )
            },
        ),
        (
            "Data Configuration",
            {
                "fields": (
                    "stocks",
                    "total_data_points",
                )
            },
        ),
        ("Simulation Configuration", {"fields": ("total_bots", "config_ranges")}),
        (
            "Progress Tracking",
            {
                "fields": (
                    "progress",
                    "current_day",
                    "bots_completed",
                )
            },
        ),
        ("Results", {"fields": ("top_performers", "error_message")}),
        ("Timestamps", {"fields": ("created_at", "started_at", "completed_at")}),
    )
    actions = ["delete_all_selected", "delete_all_records"]

    def delete_all_selected(self, request, queryset):
        """Delete all selected simulation runs and related data."""
        count = queryset.count()
        for obj in queryset:
            # Delete related configs, days, and results
            obj.bot_configs.all().delete()
        queryset.delete()
        self.message_user(
            request,
            f"Successfully deleted {count} simulation run(s) and all related data.",
            messages.SUCCESS,
        )

    delete_all_selected.short_description = (
        "Delete selected simulation runs and all related data"
    )

    def delete_all_records(self, request, queryset):
        """Delete ALL simulation runs and related data (no selection required)."""
        all_runs = BotSimulationRun.objects.all()
        count = all_runs.count()
        for obj in all_runs:
            # Delete related configs, days, and results
            obj.bot_configs.all().delete()
        all_runs.delete()
        self.message_user(
            request,
            f"Successfully deleted ALL {count} simulation run(s) and all related data.",
            messages.SUCCESS,
        )

    delete_all_records.short_description = (
        "⚠️ DELETE ALL simulation runs (no selection required)"
    )

    def progress_display(self, obj):
        """Display progress with color coding."""
        if obj.progress is None:
            return "0.00%"
        progress = float(obj.progress)
        color = "green" if progress >= 100 else "blue" if progress >= 50 else "orange"
        progress_str = f"{progress:.2f}"
        return format_html('<span style="color: {};">{}%</span>', color, progress_str)

    progress_display.short_description = "Progress"
    progress_display.admin_order_field = "progress"

    def save_model(self, request, obj, form, change):
        """Handle status changes and update timestamps accordingly."""
        if change:
            # Get the original object to compare status
            original = BotSimulationRun.objects.get(pk=obj.pk)

            # If status changed to running and started_at is not set, set it
            if (
                obj.status == "running"
                and original.status != "running"
                and not obj.started_at
            ):
                obj.started_at = timezone.now()

            # If status changed to completed and completed_at is not set, set it
            if (
                obj.status == "completed"
                and original.status != "completed"
                and not obj.completed_at
            ):
                obj.completed_at = timezone.now()

            # If status changed from running/paused to something else, update timestamps
            if (
                original.status in ["running", "paused"]
                and obj.status not in ["running", "paused"]
                and obj.status == "completed"
                and not obj.completed_at
            ):
                obj.completed_at = timezone.now()

        super().save_model(request, obj, form, change)


@admin.register(BotSimulationConfig)
class BotSimulationConfigAdmin(admin.ModelAdmin):
    """Admin interface for BotSimulationConfig."""

    list_display = [
        "detail_link",
        "simulation_run_link",
        "bot_index",
        "use_social_analysis",
        "use_news_analysis",
        "assigned_stocks_count",
        "assigned_stocks_display",
        "config_summary",
    ]
    list_filter = [
        "simulation_run__status",
        "use_social_analysis",
        "use_news_analysis",
    ]
    search_fields = [
        "simulation_run__name",
        "simulation_run__id",
        "bot_index",
        "id",
    ]
    readonly_fields = [
        "id",
        "simulation_run",
        "bot_index",
        "config_json",
        "use_social_analysis",
        "use_news_analysis",
        "assigned_stocks_list",
    ]
    filter_horizontal = ["assigned_stocks"]
    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "id",
                    "simulation_run",
                    "bot_index",
                )
            },
        ),
        (
            "Configuration",
            {
                "fields": (
                    "config_json",
                    "use_social_analysis",
                    "use_news_analysis",
                ),
                "description": "Complete bot configuration and feature flags",
            },
        ),
        (
            "Stock Assignment",
            {
                "fields": ("assigned_stocks", "assigned_stocks_list"),
                "description": "Stocks assigned to this bot configuration",
            },
        ),
    )
    list_per_page = 50
    list_max_show_all = 200
    actions = ["delete_all_selected", "delete_all_records"]

    def delete_all_selected(self, request, queryset):
        """Delete all selected bot configurations and related data."""
        count = queryset.count()
        for obj in queryset:
            # Delete related days and results
            obj.daily_results.all().delete()
            if hasattr(obj, "final_result"):
                obj.final_result.delete()
        queryset.delete()
        self.message_user(
            request,
            f"Successfully deleted {count} bot configuration(s) and all related data.",
            messages.SUCCESS,
        )

    delete_all_selected.short_description = (
        "Delete selected bot configurations and all related data"
    )

    def delete_all_records(self, request, queryset):
        """Delete ALL bot configurations and related data (no selection required)."""
        all_configs = BotSimulationConfig.objects.all()
        count = all_configs.count()
        for obj in all_configs:
            # Delete related days and results
            obj.daily_results.all().delete()
            if hasattr(obj, "final_result"):
                obj.final_result.delete()
        all_configs.delete()
        self.message_user(
            request,
            f"Successfully deleted ALL {count} bot configuration(s) and all related data.",
            messages.SUCCESS,
        )

    delete_all_records.short_description = (
        "⚠️ DELETE ALL bot configurations (no selection required)"
    )

    def detail_link(self, obj):
        """Link to the detail view."""
        url = reverse(
            "admin:bot_simulations_botsimulationconfig_change",
            args=[obj.id],
        )
        return format_html('<a href="{}" title="View/Edit Details">🔍 View</a>', url)

    detail_link.short_description = "Detail"
    detail_link.admin_order_field = "bot_index"

    def simulation_run_link(self, obj):
        """Link to the simulation run."""
        url = reverse(
            "admin:bot_simulations_botsimulationrun_change",
            args=[obj.simulation_run.id],
        )
        return format_html(
            '<a href="{}" title="View Simulation Run">{}</a>',
            url,
            obj.simulation_run.name,
        )

    simulation_run_link.short_description = "Simulation Run"
    simulation_run_link.admin_order_field = "simulation_run__name"

    def assigned_stocks_count(self, obj):
        """Display count of assigned stocks."""
        return obj.assigned_stocks.count()

    assigned_stocks_count.short_description = "Stocks Count"
    assigned_stocks_count.admin_order_field = "assigned_stocks"

    def assigned_stocks_display(self, obj):
        """Display assigned stocks as a comma-separated list."""
        stocks = obj.assigned_stocks.all()[:10]
        stock_list = ", ".join([stock.symbol for stock in stocks])
        if obj.assigned_stocks.count() > 10:
            stock_list += f" (+{obj.assigned_stocks.count() - 10} more)"
        return stock_list or "None"

    assigned_stocks_display.short_description = "Assigned Stocks"

    def assigned_stocks_list(self, obj):
        """Display full list of assigned stocks in detail view."""
        stocks = obj.assigned_stocks.all()
        if not stocks.exists():
            return "No stocks assigned"

        stock_links = []
        for stock in stocks:
            url = reverse("admin:stocks_stock_change", args=[stock.id])
            stock_links.append(format_html('<a href="{}">{}</a>', url, stock.symbol))
        return format_html("<br>".join(stock_links))

    assigned_stocks_list.short_description = "All Assigned Stocks"
    assigned_stocks_list.allow_tags = True

    def config_summary(self, obj):
        """Display a summary of the configuration."""
        config = obj.config_json or {}
        summary_parts = []

        # Signal weights
        signal_weights = config.get("signal_weights", {})
        if signal_weights:
            weights_str = ", ".join(
                [
                    f"{k}: {v}"
                    for k, v in signal_weights.items()
                    if isinstance(v, int | float)
                ]
            )
            if weights_str:
                summary_parts.append(f"Weights: {weights_str[:50]}")

        # Risk params
        risk_params = config.get("risk_params", {})
        if risk_params:
            threshold = risk_params.get("risk_score_threshold")
            if threshold:
                summary_parts.append(f"Risk: {threshold}")

        # Period
        period = config.get("period_days")
        if period:
            summary_parts.append(f"Period: {period}d")

        return " | ".join(summary_parts[:3]) or "No config summary"

    config_summary.short_description = "Config Summary"


@admin.register(BotSimulationDay)
class BotSimulationDayAdmin(admin.ModelAdmin):
    """Admin interface for BotSimulationDay."""

    list_display = [
        "simulation_config_link",
        "date",
        "decisions_count",
        "performance_summary",
    ]
    list_filter = [
        "date",
        "simulation_config__simulation_run__status",
    ]
    search_fields = [
        "simulation_config__simulation_run__name",
        "simulation_config__bot_index",
        "date",
    ]
    readonly_fields = [
        "id",
        "simulation_config",
        "date",
        "decisions",
        "actual_prices",
        "performance_metrics",
        "signal_contributions",
    ]
    date_hierarchy = "date"
    actions = ["delete_all_selected", "delete_all_records"]
    fieldsets = (
        ("Basic Information", {"fields": ("id", "simulation_config", "date")}),
        ("Trading Data", {"fields": ("decisions", "actual_prices")}),
        ("Performance Metrics", {"fields": ("performance_metrics",)}),
        ("Signal Contributions", {"fields": ("signal_contributions",)}),
    )

    def delete_all_selected(self, request, queryset):
        """Delete all selected daily results."""
        count = queryset.delete()[0]
        self.message_user(
            request,
            f"Successfully deleted {count} daily result(s).",
            messages.SUCCESS,
        )

    delete_all_selected.short_description = "Delete selected daily results"

    def delete_all_records(self, request, queryset):
        """Delete ALL daily results (no selection required)."""
        count = BotSimulationDay.objects.all().delete()[0]
        self.message_user(
            request,
            f"Successfully deleted ALL {count} daily result(s).",
            messages.SUCCESS,
        )

    delete_all_records.short_description = (
        "⚠️ DELETE ALL daily results (no selection required)"
    )

    def simulation_config_link(self, obj):
        """Link to the simulation config."""
        url = reverse(
            "admin:bot_simulations_botsimulationconfig_change",
            args=[obj.simulation_config.id],
        )
        return format_html(
            '<a href="{}">Bot {}</a>', url, obj.simulation_config.bot_index
        )

    simulation_config_link.short_description = "Bot Config"
    simulation_config_link.admin_order_field = "simulation_config__bot_index"

    def decisions_count(self, obj):
        """Count of decisions made."""
        if isinstance(obj.decisions, dict):
            return len(obj.decisions)
        return 0

    decisions_count.short_description = "Decisions"

    def performance_summary(self, obj):
        """Summary of performance metrics."""
        if not isinstance(obj.performance_metrics, dict):
            return "N/A"
        profit = obj.performance_metrics.get("profit", 0)
        trades = obj.performance_metrics.get("trades", 0)
        # Format profit as string before passing to format_html
        profit_str = f"{float(profit):.2f}" if profit else "0.00"
        return format_html("Profit: ${} | Trades: {}", profit_str, trades)

    performance_summary.short_description = "Performance"


@admin.register(BotSimulationResult)
class BotSimulationResultAdmin(admin.ModelAdmin):
    """Admin interface for BotSimulationResult."""

    list_display = [
        "simulation_config_link",
        "total_profit",
        "total_trades",
        "win_rate",
        "sharpe_ratio",
        "final_portfolio_value",
        "created_at",
    ]
    list_filter = [
        "created_at",
        "simulation_config__simulation_run__status",
    ]
    search_fields = [
        "simulation_config__simulation_run__name",
        "simulation_config__bot_index",
    ]
    readonly_fields = [
        "id",
        "simulation_config",
        "total_profit",
        "total_trades",
        "winning_trades",
        "losing_trades",
        "win_rate",
        "average_profit",
        "average_loss",
        "max_drawdown",
        "sharpe_ratio",
        "signal_productivity",
        "best_decisions",
        "worst_decisions",
        "final_cash",
        "final_portfolio_value",
        "created_at",
    ]
    fieldsets = (
        ("Basic Information", {"fields": ("id", "simulation_config", "created_at")}),
        (
            "Trade Statistics",
            {
                "fields": (
                    "total_trades",
                    "winning_trades",
                    "losing_trades",
                    "win_rate",
                )
            },
        ),
        (
            "Profit/Loss Metrics",
            {
                "fields": (
                    "total_profit",
                    "average_profit",
                    "average_loss",
                    "max_drawdown",
                )
            },
        ),
        ("Risk Metrics", {"fields": ("sharpe_ratio",)}),
        ("Signal Analysis", {"fields": ("signal_productivity",)}),
        ("Decision Analysis", {"fields": ("best_decisions", "worst_decisions")}),
        ("Final Portfolio State", {"fields": ("final_cash", "final_portfolio_value")}),
    )
    ordering = ["-total_profit"]
    actions = ["delete_all_selected", "delete_all_records"]

    def delete_all_selected(self, request, queryset):
        """Delete all selected simulation results."""
        count = queryset.delete()[0]
        self.message_user(
            request,
            f"Successfully deleted {count} simulation result(s).",
            messages.SUCCESS,
        )

    delete_all_selected.short_description = "Delete selected simulation results"

    def delete_all_records(self, request, queryset):
        """Delete ALL simulation results (no selection required)."""
        count = BotSimulationResult.objects.all().delete()[0]
        self.message_user(
            request,
            f"Successfully deleted ALL {count} simulation result(s).",
            messages.SUCCESS,
        )

    delete_all_records.short_description = (
        "⚠️ DELETE ALL simulation results (no selection required)"
    )

    def simulation_config_link(self, obj):
        """Link to the simulation config."""
        url = reverse(
            "admin:bot_simulations_botsimulationconfig_change",
            args=[obj.simulation_config.id],
        )
        return format_html(
            '<a href="{}">Bot {}</a>', url, obj.simulation_config.bot_index
        )

    simulation_config_link.short_description = "Bot Config"
    simulation_config_link.admin_order_field = "simulation_config__bot_index"
