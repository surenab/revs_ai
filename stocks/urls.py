from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'stocks'

urlpatterns = [
    # Stock endpoints
    path('stocks/', views.StockListView.as_view(), name='stock-list'),
    path('stocks/<str:symbol>/', views.StockDetailView.as_view(), name='stock-detail'),
    path('stocks/<str:symbol>/timeseries/', views.StockTimeSeriesView.as_view(), name='stock-timeseries'),

    # Stock prices
    path('prices/', views.StockPriceListView.as_view(), name='stockprice-list'),

    # Intraday and real-time data
    path('stocks/<str:symbol>/intraday/', views.IntradayPriceView.as_view(), name='stock-intraday'),
    path('stocks/<str:symbol>/ticks/', views.StockTickDataView.as_view(), name='stock-ticks'),
    path('stocks/<str:symbol>/quote/', views.real_time_quote, name='real-time-quote'),
    path('stocks/<str:symbol>/depth/', views.market_depth, name='market-depth'),
    path('intraday/', views.IntradayPriceListView.as_view(), name='intraday-list'),
    path('ticks/', views.StockTickListView.as_view(), name='tick-list'),

    # User watchlist
    path('watchlist/', views.UserWatchlistView.as_view(), name='watchlist-list'),
    path('watchlist/<uuid:pk>/', views.UserWatchlistDetailView.as_view(), name='watchlist-detail'),

    # Stock alerts
    path('alerts/', views.StockAlertListView.as_view(), name='alert-list'),
    path('alerts/<uuid:pk>/', views.StockAlertDetailView.as_view(), name='alert-detail'),

    # Utility endpoints
    path('search/', views.stock_search, name='stock-search'),
    path('market-summary/', views.market_summary, name='market-summary'),
    path('dashboard/', views.user_dashboard, name='user-dashboard'),

    # Real-time data endpoints
    path('real-market-summary/', views.real_market_summary, name='real-market-summary'),
    path('sync-data/', views.sync_stock_data, name='sync-stock-data'),

    # Portfolio endpoints
    path('portfolio/', views.PortfolioListView.as_view(), name='portfolio-list'),
    path('portfolio/<uuid:pk>/', views.PortfolioDetailView.as_view(), name='portfolio-detail'),
    path('portfolio/summary/', views.portfolio_summary, name='portfolio-summary'),
    path('portfolio/add-funds/', views.add_funds, name='add-funds'),

    # Order endpoints
    path('orders/', views.OrderListView.as_view(), name='order-list'),
    path('orders/<uuid:pk>/', views.OrderDetailView.as_view(), name='order-detail'),
    path('orders/execute/', views.execute_orders, name='execute-orders'),
    path('orders/summary/', views.order_summary, name='order-summary'),
]
