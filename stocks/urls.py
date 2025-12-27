from django.urls import path

from . import views

app_name = "stocks"

urlpatterns = [
    # Stock endpoints
    path("stocks/", views.StockListView.as_view(), name="stock-list"),
    path("stocks/all/", views.AllStocksListView.as_view(), name="all-stocks-list"),
    path("stocks/<str:symbol>/", views.StockDetailView.as_view(), name="stock-detail"),
    path(
        "stocks/<str:symbol>/timeseries/",
        views.StockTimeSeriesView.as_view(),
        name="stock-timeseries",
    ),
    # Stock prices
    path("prices/", views.StockPriceListView.as_view(), name="stockprice-list"),
    # Intraday and real-time data
    path(
        "stocks/<str:symbol>/intraday/",
        views.IntradayPriceView.as_view(),
        name="stock-intraday",
    ),
    path(
        "stocks/<str:symbol>/ticks/",
        views.StockTickDataView.as_view(),
        name="stock-ticks",
    ),
    path("stocks/<str:symbol>/quote/", views.real_time_quote, name="real-time-quote"),
    path("stocks/<str:symbol>/depth/", views.market_depth, name="market-depth"),
    path("intraday/", views.IntradayPriceListView.as_view(), name="intraday-list"),
    path("ticks/", views.StockTickListView.as_view(), name="tick-list"),
    # User watchlist
    path("watchlist/", views.UserWatchlistView.as_view(), name="watchlist-list"),
    path(
        "watchlist/<uuid:pk>/",
        views.UserWatchlistDetailView.as_view(),
        name="watchlist-detail",
    ),
    # Stock alerts
    path("alerts/", views.StockAlertListView.as_view(), name="alert-list"),
    path(
        "alerts/<uuid:pk>/", views.StockAlertDetailView.as_view(), name="alert-detail"
    ),
    # Utility endpoints
    path("search/", views.stock_search, name="stock-search"),
    path("market-summary/", views.market_summary, name="market-summary"),
    path("dashboard/", views.user_dashboard, name="user-dashboard"),
    # Real-time data endpoints
    path("real-market-summary/", views.real_market_summary, name="real-market-summary"),
    path("sync-data/", views.sync_stock_data, name="sync-stock-data"),
    # Portfolio endpoints
    path("portfolio/", views.PortfolioListView.as_view(), name="portfolio-list"),
    path(
        "portfolio/<uuid:pk>/",
        views.PortfolioDetailView.as_view(),
        name="portfolio-detail",
    ),
    path("portfolio/summary/", views.portfolio_summary, name="portfolio-summary"),
    path("portfolio/add-funds/", views.add_funds, name="add-funds"),
    # Order endpoints
    path("orders/", views.OrderListView.as_view(), name="order-list"),
    path("orders/<uuid:pk>/", views.OrderDetailView.as_view(), name="order-detail"),
    path("orders/execute/", views.execute_orders, name="execute-orders"),
    path("orders/summary/", views.order_summary, name="order-summary"),
    # Trading bot endpoints
    path("bots/", views.TradingBotListView.as_view(), name="bot-list"),
    path("bots/<uuid:pk>/", views.TradingBotDetailView.as_view(), name="bot-detail"),
    path("bots/<uuid:pk>/activate/", views.activate_bot, name="bot-activate"),
    path("bots/<uuid:pk>/deactivate/", views.deactivate_bot, name="bot-deactivate"),
    path("bots/<uuid:pk>/execute/", views.execute_bot, name="bot-execute"),
    path(
        "bots/<uuid:bot_id>/executions/",
        views.TradingBotExecutionListView.as_view(),
        name="bot-executions",
    ),
    path(
        "executions/<uuid:pk>/",
        views.TradingBotExecutionDetailView.as_view(),
        name="execution-detail",
    ),
    path(
        "bots/<uuid:bot_id>/orders/",
        views.TradingBotOrdersListView.as_view(),
        name="bot-orders",
    ),
    path("bots/<uuid:pk>/performance/", views.bot_performance, name="bot-performance"),
    # ML Model endpoints
    path("ml-models/", views.MLModelViewSet.as_view(), name="ml-model-list"),
    path(
        "ml-models/<uuid:pk>/",
        views.MLModelDetailView.as_view(),
        name="ml-model-detail",
    ),
    path(
        "ml-models/<uuid:model_id>/predict/",
        views.MLModelPredictionView.as_view(),
        name="ml-model-predict",
    ),
    # Signal history endpoints
    path(
        "signal-history/",
        views.BotSignalHistoryViewSet.as_view(),
        name="signal-history-list",
    ),
    path(
        "signal-history/<uuid:pk>/",
        views.BotSignalHistoryDetailView.as_view(),
        name="signal-history-detail",
    ),
    path(
        "bots/<uuid:bot_id>/signal-analytics/",
        views.BotSignalAnalyticsView.as_view(),
        name="bot-signal-analytics",
    ),
    # Bot configuration templates
    path(
        "bot-templates/",
        views.BotConfigurationTemplatesView.as_view(),
        name="bot-templates",
    ),
    # Default indicator thresholds
    path(
        "default-indicator-thresholds/",
        views.DefaultIndicatorThresholdsView.as_view(),
        name="default-indicator-thresholds",
    ),
]
