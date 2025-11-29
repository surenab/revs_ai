from django.contrib import admin
from django.utils.html import format_html

from .models import (
    IntradayPrice,
    Order,
    Portfolio,
    Stock,
    StockAlert,
    StockPrice,
    StockTick,
    UserWatchlist,
)


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = [
        "symbol",
        "name",
        "exchange",
        "sector",
        "market_cap_display",
        "is_active",
        "created_at",
    ]
    list_filter = ["exchange", "sector", "is_active", "created_at"]
    search_fields = ["symbol", "name", "exchange", "sector"]
    readonly_fields = ["id", "created_at", "updated_at"]
    ordering = ["symbol"]

    fieldsets = (
        ("Basic Information", {"fields": ("symbol", "name", "exchange")}),
        (
            "Company Details",
            {"fields": ("sector", "industry", "market_cap", "description")},
        ),
        ("Status", {"fields": ("is_active",)}),
        (
            "Metadata",
            {"fields": ("id", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def market_cap_display(self, obj):
        if obj.market_cap:
            if obj.market_cap >= 1_000_000_000:
                return f"${obj.market_cap / 1_000_000_000:.1f}B"
            if obj.market_cap >= 1_000_000:
                return f"${obj.market_cap / 1_000_000:.1f}M"
            return f"${obj.market_cap:,}"
        return "-"

    market_cap_display.short_description = "Market Cap"


@admin.register(StockPrice)
class StockPriceAdmin(admin.ModelAdmin):
    list_display = [
        "stock_symbol",
        "date",
        "interval",
        "open_price",
        "close_price",
        "price_change_display",
        "volume_display",
        "created_at",
    ]
    list_filter = ["interval", "date", "stock__exchange", "created_at"]
    search_fields = ["stock__symbol", "stock__name"]
    readonly_fields = [
        "id",
        "price_change",
        "price_change_percent",
        "created_at",
        "updated_at",
    ]
    date_hierarchy = "date"
    ordering = ["-date", "stock__symbol"]

    fieldsets = (
        ("Stock Information", {"fields": ("stock", "date", "interval")}),
        (
            "Price Data",
            {
                "fields": (
                    "open_price",
                    "high_price",
                    "low_price",
                    "close_price",
                    "adjusted_close",
                )
            },
        ),
        ("Volume", {"fields": ("volume",)}),
        (
            "Calculated Fields",
            {
                "fields": ("price_change", "price_change_percent"),
                "classes": ("collapse",),
            },
        ),
        (
            "Metadata",
            {"fields": ("id", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def stock_symbol(self, obj):
        return obj.stock.symbol

    stock_symbol.short_description = "Symbol"
    stock_symbol.admin_order_field = "stock__symbol"

    def price_change_display(self, obj):
        change = obj.price_change or 0
        change_percent = obj.price_change_percent or 0

        # Ensure we have numeric values
        try:
            change = float(change)
            change_percent = float(change_percent)
        except (ValueError, TypeError):
            change = 0
            change_percent = 0

        if change > 0:
            return format_html(
                f'<span style="color: green;">+${change:.2f} ({change_percent:.2f}%)</span>'
            )
        if change < 0:
            return format_html(
                f'<span style="color: red;">${change:.2f} ({change_percent:.2f}%)</span>'
            )
        return format_html(f"<span>${change:.2f} (0.00%)</span>")

    price_change_display.short_description = "Price Change"

    def volume_display(self, obj):
        if obj.volume >= 1_000_000:
            return f"{obj.volume / 1_000_000:.1f}M"
        if obj.volume >= 1_000:
            return f"{obj.volume / 1_000:.1f}K"
        return f"{obj.volume:,}"

    volume_display.short_description = "Volume"


@admin.register(UserWatchlist)
class UserWatchlistAdmin(admin.ModelAdmin):
    list_display = ["user_email", "stock_symbol", "target_price", "created_at"]
    list_filter = ["created_at", "stock__exchange"]
    search_fields = ["user__email", "stock__symbol", "stock__name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    ordering = ["-created_at"]

    fieldsets = (
        ("Watchlist Entry", {"fields": ("user", "stock")}),
        ("Settings", {"fields": ("target_price", "notes")}),
        (
            "Metadata",
            {"fields": ("id", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def user_email(self, obj):
        return obj.user.email

    user_email.short_description = "User"
    user_email.admin_order_field = "user__email"

    def stock_symbol(self, obj):
        return obj.stock.symbol

    stock_symbol.short_description = "Stock"
    stock_symbol.admin_order_field = "stock__symbol"


@admin.register(StockAlert)
class StockAlertAdmin(admin.ModelAdmin):
    list_display = [
        "user_email",
        "stock_symbol",
        "alert_type",
        "threshold_value",
        "is_active",
        "is_triggered",
        "created_at",
    ]
    list_filter = [
        "alert_type",
        "is_active",
        "is_triggered",
        "created_at",
        "stock__exchange",
    ]
    search_fields = ["user__email", "stock__symbol", "stock__name"]
    readonly_fields = ["id", "triggered_at", "created_at", "updated_at"]
    ordering = ["-created_at"]

    fieldsets = (
        (
            "Alert Configuration",
            {"fields": ("user", "stock", "alert_type", "threshold_value")},
        ),
        ("Status", {"fields": ("is_active", "is_triggered", "triggered_at")}),
        (
            "Metadata",
            {"fields": ("id", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def user_email(self, obj):
        return obj.user.email

    user_email.short_description = "User"
    user_email.admin_order_field = "user__email"

    def stock_symbol(self, obj):
        return obj.stock.symbol

    stock_symbol.short_description = "Stock"
    stock_symbol.admin_order_field = "stock__symbol"

    actions = ["activate_alerts", "deactivate_alerts"]

    def activate_alerts(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} alerts were successfully activated.")

    activate_alerts.short_description = "Activate selected alerts"

    def deactivate_alerts(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} alerts were successfully deactivated.")

    deactivate_alerts.short_description = "Deactivate selected alerts"


@admin.register(StockTick)
class StockTickAdmin(admin.ModelAdmin):
    list_display = [
        "stock_symbol",
        "price",
        "volume",
        "bid_price",
        "ask_price",
        "spread_display",
        "trade_type",
        "timestamp",
        "is_market_hours",
    ]
    list_filter = ["trade_type", "is_market_hours", "timestamp", "stock__exchange"]
    search_fields = ["stock__symbol", "stock__name"]
    readonly_fields = ["id", "spread", "spread_percentage", "created_at"]
    date_hierarchy = "timestamp"
    ordering = ["-timestamp"]

    fieldsets = (
        (
            "Stock Information",
            {"fields": ("stock", "timestamp", "trade_type", "is_market_hours")},
        ),
        ("Price Data", {"fields": ("price", "volume")}),
        (
            "Bid/Ask Data",
            {"fields": ("bid_price", "ask_price", "bid_size", "ask_size")},
        ),
        (
            "Calculated Fields",
            {"fields": ("spread", "spread_percentage"), "classes": ("collapse",)},
        ),
        ("Metadata", {"fields": ("id", "created_at"), "classes": ("collapse",)}),
    )

    def stock_symbol(self, obj):
        return obj.stock.symbol

    stock_symbol.short_description = "Symbol"
    stock_symbol.admin_order_field = "stock__symbol"

    def spread_display(self, obj):
        if obj.spread:
            return f"${obj.spread:.4f} ({obj.spread_percentage:.2f}%)"
        return "-"

    spread_display.short_description = "Spread"


@admin.register(IntradayPrice)
class IntradayPriceAdmin(admin.ModelAdmin):
    list_display = [
        "stock_symbol",
        "timestamp",
        "interval",
        "session_type",
        "open_price",
        "close_price",
        "price_change_display",
        "volume_display",
        "vwap",
        "trade_count",
    ]
    list_filter = ["interval", "session_type", "timestamp", "stock__exchange"]
    search_fields = ["stock__symbol", "stock__name"]
    readonly_fields = [
        "id",
        "price_change",
        "price_change_percent",
        "typical_price",
        "created_at",
    ]
    date_hierarchy = "timestamp"
    ordering = ["-timestamp"]

    fieldsets = (
        (
            "Stock Information",
            {"fields": ("stock", "timestamp", "interval", "session_type")},
        ),
        (
            "Price Data",
            {"fields": ("open_price", "high_price", "low_price", "close_price")},
        ),
        ("Volume and Metrics", {"fields": ("volume", "vwap", "trade_count")}),
        (
            "Calculated Fields",
            {
                "fields": ("price_change", "price_change_percent", "typical_price"),
                "classes": ("collapse",),
            },
        ),
        ("Metadata", {"fields": ("id", "created_at"), "classes": ("collapse",)}),
    )

    def stock_symbol(self, obj):
        return obj.stock.symbol

    stock_symbol.short_description = "Symbol"
    stock_symbol.admin_order_field = "stock__symbol"

    def price_change_display(self, obj):
        # Ensure we have numeric values
        try:
            change = float(obj.price_change or 0)
        except (ValueError, TypeError):
            change = 0.0

        try:
            change_percent = float(obj.price_change_percent or 0)
        except (ValueError, TypeError):
            change_percent = 0.0

        if change > 0:
            format_html(
                f'<span style="color: red;">${change} ({change_percent:.4f}%)</span>'
            )
        elif change < 0:
            return format_html(
                f'<span style="color: red;">${change} ({change_percent:.4f}%)</span>'
            )

        else:
            return format_html(f"<span>${change} (0.00%)</span>")
        return None

    price_change_display.short_description = "Price Change"

    def volume_display(self, obj):
        if obj.volume >= 1_000_000:
            return f"{obj.volume / 1_000_000:.1f}M"
        if obj.volume >= 1_000:
            return f"{obj.volume / 1_000:.1f}K"
        return f"{obj.volume:,}"

    volume_display.short_description = "Volume"


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = [
        "user_email",
        "stock_symbol",
        "quantity",
        "purchase_price",
        "purchase_date",
        "total_cost_display",
        "current_value_display",
        "gain_loss_display",
        "created_at",
    ]
    list_filter = ["purchase_date", "created_at", "stock__exchange"]
    search_fields = ["user__email", "stock__symbol", "stock__name", "notes"]
    readonly_fields = [
        "id",
        "total_cost",
        "current_value",
        "gain_loss",
        "gain_loss_percent",
        "created_at",
        "updated_at",
    ]
    date_hierarchy = "purchase_date"
    ordering = ["-purchase_date", "-created_at"]

    fieldsets = (
        ("Portfolio Entry", {"fields": ("user", "stock")}),
        (
            "Purchase Information",
            {"fields": ("quantity", "purchase_price", "purchase_date")},
        ),
        ("Notes", {"fields": ("notes",)}),
        (
            "Calculated Fields",
            {
                "fields": (
                    "total_cost",
                    "current_value",
                    "gain_loss",
                    "gain_loss_percent",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Metadata",
            {"fields": ("id", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def user_email(self, obj):
        return obj.user.email

    user_email.short_description = "User"
    user_email.admin_order_field = "user__email"

    def stock_symbol(self, obj):
        return obj.stock.symbol

    stock_symbol.short_description = "Stock"
    stock_symbol.admin_order_field = "stock__symbol"

    def total_cost_display(self, obj):
        return f"${obj.total_cost:,.2f}"

    total_cost_display.short_description = "Total Cost"
    total_cost_display.admin_order_field = "quantity"

    def current_value_display(self, obj):
        value = obj.current_value
        return f"${value:,.2f}"

    current_value_display.short_description = "Current Value"

    def gain_loss_display(self, obj):
        gain_loss = obj.gain_loss
        gain_loss_percent = obj.gain_loss_percent
        color = "green" if gain_loss >= 0 else "red"
        sign = "+" if gain_loss >= 0 else ""
        return format_html(
            f'<span style="color: {color};">{sign}${gain_loss:,.2f} ({sign}{gain_loss_percent:.2f}%)</span>'
        )

    gain_loss_display.short_description = "Gain/Loss"


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "user_email",
        "stock_symbol",
        "transaction_type",
        "order_type",
        "quantity",
        "status_display",
        "target_price",
        "executed_price",
        "executed_at",
        "created_at",
    ]
    list_filter = [
        "transaction_type",
        "order_type",
        "status",
        "created_at",
        "executed_at",
        "stock__exchange",
    ]
    search_fields = ["user__email", "stock__symbol", "stock__name", "notes"]
    readonly_fields = ["id", "can_execute", "created_at", "updated_at"]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]

    fieldsets = (
        (
            "Order Information",
            {"fields": ("user", "stock", "transaction_type", "order_type", "status")},
        ),
        ("Order Details", {"fields": ("quantity", "target_price", "notes")}),
        (
            "Execution Details",
            {"fields": ("executed_price", "executed_at"), "classes": ("collapse",)},
        ),
        ("Calculated Fields", {"fields": ("can_execute",), "classes": ("collapse",)}),
        (
            "Metadata",
            {"fields": ("id", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def user_email(self, obj):
        return obj.user.email

    user_email.short_description = "User"
    user_email.admin_order_field = "user__email"

    def stock_symbol(self, obj):
        return obj.stock.symbol

    stock_symbol.short_description = "Stock"
    stock_symbol.admin_order_field = "stock__symbol"

    def status_display(self, obj):
        status_colors = {
            "waiting": "orange",
            "in_progress": "blue",
            "done": "green",
            "cancelled": "gray",
            "insufficient_funds": "red",
        }
        color = status_colors.get(obj.status, "black")
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{obj.get_status_display()}</span>'
        )

    status_display.short_description = "Status"
    status_display.admin_order_field = "status"

    actions = ["mark_as_cancelled", "retry_execution"]

    def mark_as_cancelled(self, request, queryset):
        updated = queryset.filter(status__in=["waiting", "insufficient_funds"]).update(
            status="cancelled"
        )
        self.message_user(request, f"{updated} orders were successfully cancelled.")

    mark_as_cancelled.short_description = "Cancel selected orders"

    def retry_execution(self, request, queryset):
        count = 0
        for order in queryset.filter(status__in=["waiting", "insufficient_funds"]):
            order.status = "waiting"
            order.save()
            if order.execute():
                count += 1
        self.message_user(request, f"{count} orders were successfully executed.")

    retry_execution.short_description = "Retry execution for selected orders"
