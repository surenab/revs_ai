from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import UserProfile
from users.views import create_notification

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
from .serializers import (
    BotPerformanceSerializer,
    IntradayPriceListSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    PortfolioCreateSerializer,
    PortfolioSerializer,
    RealTimeDataSerializer,
    StockAlertCreateSerializer,
    StockAlertSerializer,
    StockListSerializer,
    StockPriceListSerializer,
    StockSerializer,
    StockTickListSerializer,
    StockTimeSeriesSerializer,
    TickDataSerializer,
    TradingBotConfigSerializer,
    TradingBotExecutionSerializer,
    UserWatchlistCreateSerializer,
    UserWatchlistSerializer,
)
from .services import alpha_vantage_service


class StockListView(generics.ListAPIView):
    """
    List all active stocks with optional search and filtering.
    """

    serializer_class = StockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Stock.objects.filter(is_active=True)

        # Search functionality
        search = self.request.query_params.get("search", None)
        if search:
            queryset = queryset.filter(
                Q(symbol__icontains=search)
                | Q(name__icontains=search)
                | Q(sector__icontains=search)
            )

        # Filter by exchange
        exchange = self.request.query_params.get("exchange", None)
        if exchange:
            queryset = queryset.filter(exchange__iexact=exchange)

        # Filter by sector
        sector = self.request.query_params.get("sector", None)
        if sector:
            queryset = queryset.filter(sector__icontains=sector)

        return queryset.order_by("symbol")


class AllStocksListView(generics.ListAPIView):
    """
    Get all active stocks (id, symbol, name only) in one response.
    Used for dropdowns and selection widgets.
    """

    serializer_class = StockListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Disable pagination to return all stocks

    def get_queryset(self):
        return Stock.objects.filter(is_active=True).order_by("symbol")


class StockDetailView(generics.RetrieveAPIView):
    """
    Retrieve detailed information about a specific stock.
    """

    serializer_class = StockSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "symbol"

    def get_queryset(self):
        return Stock.objects.filter(is_active=True)


class StockTimeSeriesView(APIView):
    """
    Get time series data for a specific stock.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        # Validate input parameters
        serializer = StockTimeSeriesSerializer(
            data={
                "symbol": symbol,
                "interval": request.query_params.get("interval", "1d"),
                "start_date": request.query_params.get("start_date"),
                "end_date": request.query_params.get("end_date"),
                "limit": request.query_params.get("limit", 100),
            }
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        stock = validated_data["symbol"]  # This is now a Stock object from validation
        interval = validated_data["interval"]
        start_date = validated_data.get("start_date")
        end_date = validated_data.get("end_date")
        limit = validated_data["limit"]

        # Build query
        queryset = StockPrice.objects.filter(stock=stock, interval=interval)

        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        # Order by date descending and limit results
        prices = queryset.order_by("-date")[:limit]

        # Serialize the data
        price_serializer = StockPriceListSerializer(prices, many=True)

        return Response(
            {
                "stock": {
                    "symbol": stock.symbol,
                    "name": stock.name,
                    "exchange": stock.exchange,
                },
                "interval": interval,
                "count": len(price_serializer.data),
                "prices": price_serializer.data,
            }
        )


class StockPriceListView(generics.ListAPIView):
    """
    List stock prices with filtering options.
    """

    serializer_class = StockPriceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = StockPrice.objects.select_related("stock")

        # Filter by stock symbol
        symbol = self.request.query_params.get("symbol", None)
        if symbol:
            queryset = queryset.filter(stock__symbol__iexact=symbol)

        # Filter by interval
        interval = self.request.query_params.get("interval", None)
        if interval:
            queryset = queryset.filter(interval=interval)

        # Filter by date range
        start_date = self.request.query_params.get("start_date", None)
        if start_date:
            try:
                start_date = (
                    datetime.strptime(start_date, "%Y-%m-%d")
                    .replace(tzinfo=timezone.utc)
                    .date()
                )
                queryset = queryset.filter(date__gte=start_date)
            except ValueError:
                pass

        end_date = self.request.query_params.get("end_date", None)
        if end_date:
            try:
                end_date = (
                    datetime.strptime(end_date, "%Y-%m-%d")
                    .replace(tzinfo=timezone.utc)
                    .date()
                )
                queryset = queryset.filter(date__lte=end_date)
            except ValueError:
                pass

        return queryset.order_by("-date", "stock__symbol")


class UserWatchlistView(generics.ListCreateAPIView):
    """
    List user's watchlist or add a stock to watchlist.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserWatchlistCreateSerializer
        return UserWatchlistSerializer

    def get_queryset(self):
        return (
            UserWatchlist.objects.filter(user=self.request.user)
            .select_related("stock")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        """Create watchlist entry and return full object with stock details."""
        instance = serializer.save()
        # Refresh from database to get related stock data
        instance.refresh_from_db()
        return instance

    def create(self, request, *args, **kwargs):
        """Override create to return full watchlist object with stock details."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = self.perform_create(serializer)

        # Use the full serializer to return complete data
        response_serializer = UserWatchlistSerializer(
            instance, context={"request": request}
        )
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class UserWatchlistDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a watchlist entry.
    """

    serializer_class = UserWatchlistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserWatchlist.objects.filter(user=self.request.user).select_related(
            "stock"
        )


class StockAlertListView(generics.ListCreateAPIView):
    """
    List user's stock alerts or create a new alert.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StockAlertCreateSerializer
        return StockAlertSerializer

    def get_queryset(self):
        queryset = StockAlert.objects.filter(user=self.request.user).select_related(
            "stock"
        )

        # Filter by active status
        is_active = self.request.query_params.get("is_active", None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # Filter by triggered status
        is_triggered = self.request.query_params.get("is_triggered", None)
        if is_triggered is not None:
            queryset = queryset.filter(is_triggered=is_triggered.lower() == "true")

        return queryset.order_by("-created_at")


class StockAlertDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a stock alert.
    """

    serializer_class = StockAlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return StockAlert.objects.filter(user=self.request.user).select_related("stock")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def stock_search(request):
    """
    Search for stocks by symbol or name.
    """
    query = request.query_params.get("q", "").strip()

    if not query or len(query) < 2:
        return Response(
            {"error": _("Search query must be at least 2 characters long.")},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Search in symbol and name fields
    stocks = Stock.objects.filter(
        Q(symbol__icontains=query) | Q(name__icontains=query), is_active=True
    ).order_by("symbol")[:20]  # Limit to 20 results

    serializer = StockSerializer(stocks, many=True)

    return Response(
        {"query": query, "count": len(serializer.data), "results": serializer.data}
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def market_summary(request):
    """
    Get market summary with top gainers, losers, and most active stocks.
    """
    # Get recent prices (last trading day)
    latest_date = StockPrice.objects.filter(interval="1d").order_by("-date").first()
    if not latest_date:
        return Response(
            {"error": _("No market data available.")}, status=status.HTTP_404_NOT_FOUND
        )

    latest_date = latest_date.date

    # Get all stocks with their latest prices
    latest_prices = (
        StockPrice.objects.filter(interval="1d", date=latest_date)
        .select_related("stock")
        .order_by("stock__symbol")
    )

    # Top gainers (by percentage)
    top_gainers = (
        latest_prices.filter(close_price__gt=0, open_price__gt=0)
        .extra(
            select={"change_percent": "((close_price - open_price) / open_price) * 100"}
        )
        .order_by("-change_percent")[:10]
    )

    # Top losers (by percentage)
    top_losers = (
        latest_prices.filter(close_price__gt=0, open_price__gt=0)
        .extra(
            select={"change_percent": "((close_price - open_price) / open_price) * 100"}
        )
        .order_by("change_percent")[:10]
    )

    # Most active (by volume)
    most_active = latest_prices.order_by("-volume")[:10]

    return Response(
        {
            "date": latest_date,
            "top_gainers": StockPriceListSerializer(top_gainers, many=True).data,
            "top_losers": StockPriceListSerializer(top_losers, many=True).data,
            "most_active": StockPriceListSerializer(most_active, many=True).data,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def user_dashboard(request):
    """
    Get user's dashboard data including watchlist and alerts summary.
    """
    user = request.user

    # Get user's watchlist with latest prices
    watchlist = UserWatchlist.objects.filter(user=user).select_related("stock")
    watchlist_data = []

    for item in watchlist:
        latest_price = item.stock.prices.filter(interval="1d").first()
        watchlist_item = {
            "id": item.id,
            "stock": {
                "symbol": item.stock.symbol,
                "name": item.stock.name,
            },
            "target_price": item.target_price,
            "latest_price": None,
        }

        if latest_price:
            watchlist_item["latest_price"] = {
                "close_price": latest_price.close_price,
                "date": latest_price.date,
                "price_change": latest_price.price_change,
                "price_change_percent": latest_price.price_change_percent,
            }

        watchlist_data.append(watchlist_item)

    # Get user's active alerts
    active_alerts = (
        StockAlert.objects.filter(user=user, is_active=True)
        .select_related("stock")
        .count()
    )

    # Get triggered alerts (last 7 days)
    week_ago = timezone.now().date() - timedelta(days=7)
    recent_triggered = StockAlert.objects.filter(
        user=user, is_triggered=True, triggered_at__date__gte=week_ago
    ).count()

    return Response(
        {
            "watchlist": watchlist_data,
            "alerts_summary": {
                "active_alerts": active_alerts,
                "recent_triggered": recent_triggered,
            },
        }
    )


class IntradayPriceView(APIView):
    """
    Get intraday price data with sub-minute intervals.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        # Validate input parameters
        serializer = RealTimeDataSerializer(
            data={
                "symbol": symbol,
                "interval": request.query_params.get("interval", "1m"),
                "start_time": request.query_params.get("start_time"),
                "end_time": request.query_params.get("end_time"),
                "limit": request.query_params.get("limit", 1000),
                "session_type": request.query_params.get("session_type", "all"),
            }
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        stock = validated_data["symbol"]  # This is now a Stock object from validation
        interval = validated_data["interval"]
        start_time = validated_data.get("start_time")
        end_time = validated_data.get("end_time")
        limit = validated_data["limit"]
        session_type = validated_data["session_type"]

        # Build query
        queryset = IntradayPrice.objects.filter(stock=stock, interval=interval)

        if start_time:
            queryset = queryset.filter(timestamp__gte=start_time)
        if end_time:
            queryset = queryset.filter(timestamp__lte=end_time)
        if session_type != "all":
            queryset = queryset.filter(session_type=session_type)

        # Order by timestamp descending and limit results
        prices = queryset.order_by("-timestamp")[:limit]

        # Serialize the data
        price_serializer = IntradayPriceListSerializer(prices, many=True)

        return Response(
            {
                "stock": {
                    "symbol": stock.symbol,
                    "name": stock.name,
                    "exchange": stock.exchange,
                },
                "interval": interval,
                "session_type": session_type,
                "count": len(price_serializer.data),
                "prices": price_serializer.data,
            }
        )


class StockTickDataView(APIView):
    """
    Get tick-by-tick price data for real-time analysis.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        # Validate input parameters
        serializer = TickDataSerializer(
            data={
                "symbol": symbol,
                "start_time": request.query_params.get("start_time"),
                "end_time": request.query_params.get("end_time"),
                "limit": request.query_params.get("limit", 5000),
                "trade_type": request.query_params.get("trade_type", "all"),
                "market_hours_only": request.query_params.get(
                    "market_hours_only", "true"
                ).lower()
                == "true",
            }
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        stock = validated_data["symbol"]  # This is now a Stock object from validation
        start_time = validated_data.get("start_time")
        end_time = validated_data.get("end_time")
        limit = validated_data["limit"]
        trade_type = validated_data["trade_type"]
        market_hours_only = validated_data["market_hours_only"]

        # Build query
        queryset = StockTick.objects.filter(stock=stock)

        if start_time:
            queryset = queryset.filter(timestamp__gte=start_time)
        if end_time:
            queryset = queryset.filter(timestamp__lte=end_time)
        if trade_type != "all":
            queryset = queryset.filter(trade_type=trade_type)
        if market_hours_only:
            queryset = queryset.filter(is_market_hours=True)

        # Order by timestamp descending and limit results
        ticks = queryset.order_by("-timestamp")[:limit]

        # Serialize the data
        tick_serializer = StockTickListSerializer(ticks, many=True)

        return Response(
            {
                "stock": {
                    "symbol": stock.symbol,
                    "name": stock.name,
                    "exchange": stock.exchange,
                },
                "filters": {
                    "trade_type": trade_type,
                    "market_hours_only": market_hours_only,
                },
                "count": len(tick_serializer.data),
                "ticks": tick_serializer.data,
            }
        )


class IntradayPriceListView(generics.ListAPIView):
    """
    List intraday prices with filtering options.
    """

    serializer_class = IntradayPriceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = IntradayPrice.objects.select_related("stock")

        # Filter by stock symbol
        symbol = self.request.query_params.get("symbol", None)
        if symbol:
            queryset = queryset.filter(stock__symbol__iexact=symbol)

        # Filter by interval
        interval = self.request.query_params.get("interval", None)
        if interval:
            queryset = queryset.filter(interval=interval)

        # Filter by session type
        session_type = self.request.query_params.get("session_type", None)
        if session_type:
            queryset = queryset.filter(session_type=session_type)

        # Filter by time range
        start_time = self.request.query_params.get("start_time", None)
        if start_time:
            try:
                start_time = datetime.fromisoformat(start_time)
                queryset = queryset.filter(timestamp__gte=start_time)
            except ValueError:
                pass

        end_time = self.request.query_params.get("end_time", None)
        if end_time:
            try:
                end_time = datetime.fromisoformat(end_time)
                queryset = queryset.filter(timestamp__lte=end_time)
            except ValueError:
                pass

        return queryset.order_by("-timestamp")


class StockTickListView(generics.ListAPIView):
    """
    List stock ticks with filtering options.
    """

    serializer_class = StockTickListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = StockTick.objects.select_related("stock")

        # Filter by stock symbol
        symbol = self.request.query_params.get("symbol", None)
        if symbol:
            queryset = queryset.filter(stock__symbol__iexact=symbol)

        # Filter by trade type
        trade_type = self.request.query_params.get("trade_type", None)
        if trade_type and trade_type != "all":
            queryset = queryset.filter(trade_type=trade_type)

        # Filter by market hours
        market_hours_only = self.request.query_params.get("market_hours_only", None)
        if market_hours_only is not None:
            queryset = queryset.filter(
                is_market_hours=market_hours_only.lower() == "true"
            )

        # Filter by time range
        start_time = self.request.query_params.get("start_time", None)
        if start_time:
            try:
                start_time = datetime.fromisoformat(start_time)
                queryset = queryset.filter(timestamp__gte=start_time)
            except ValueError:
                pass

        end_time = self.request.query_params.get("end_time", None)
        if end_time:
            try:
                end_time = datetime.fromisoformat(end_time)
                queryset = queryset.filter(timestamp__lte=end_time)
            except ValueError:
                pass

        return queryset.order_by("-timestamp")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def real_time_quote(request, symbol):
    """
    Get the most recent tick data for a stock (real-time quote).
    """
    try:
        stock = Stock.objects.get(symbol=symbol.upper(), is_active=True)
    except Stock.DoesNotExist:
        return Response(
            {"error": _('Stock with symbol "{}" not found.').format(symbol)},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Get the latest tick
    latest_tick = StockTick.objects.filter(stock=stock).order_by("-timestamp").first()

    # Get the latest intraday price (1-minute)
    latest_intraday = (
        IntradayPrice.objects.filter(stock=stock, interval="1m")
        .order_by("-timestamp")
        .first()
    )

    response_data = {
        "stock": {
            "symbol": stock.symbol,
            "name": stock.name,
            "exchange": stock.exchange,
        },
        "latest_tick": None,
        "latest_intraday": None,
    }

    if latest_tick:
        response_data["latest_tick"] = StockTickListSerializer(latest_tick).data

    if latest_intraday:
        response_data["latest_intraday"] = IntradayPriceListSerializer(
            latest_intraday
        ).data

    return Response(response_data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def market_depth(request, symbol):
    """
    Get market depth (Level 2) data showing bid/ask levels.
    """
    try:
        stock = Stock.objects.get(symbol=symbol.upper(), is_active=True)
    except Stock.DoesNotExist:
        return Response(
            {"error": _('Stock with symbol "{}" not found.').format(symbol)},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Get recent ticks with bid/ask data
    recent_ticks = StockTick.objects.filter(
        stock=stock, bid_price__isnull=False, ask_price__isnull=False
    ).order_by("-timestamp")[:50]

    # Aggregate bid/ask levels (simplified market depth)
    bid_levels = {}
    ask_levels = {}

    for tick in recent_ticks:
        if tick.bid_price and tick.bid_size:
            bid_key = str(tick.bid_price)
            if bid_key not in bid_levels:
                bid_levels[bid_key] = {"price": tick.bid_price, "size": 0}
            bid_levels[bid_key]["size"] += tick.bid_size

        if tick.ask_price and tick.ask_size:
            ask_key = str(tick.ask_price)
            if ask_key not in ask_levels:
                ask_levels[ask_key] = {"price": tick.ask_price, "size": 0}
            ask_levels[ask_key]["size"] += tick.ask_size

    # Sort and limit levels
    sorted_bids = sorted(bid_levels.values(), key=lambda x: x["price"], reverse=True)[
        :10
    ]
    sorted_asks = sorted(ask_levels.values(), key=lambda x: x["price"])[:10]

    return Response(
        {
            "stock": {
                "symbol": stock.symbol,
                "name": stock.name,
                "exchange": stock.exchange,
            },
            "bids": sorted_bids,
            "asks": sorted_asks,
            "spread": sorted_asks[0]["price"] - sorted_bids[0]["price"]
            if sorted_bids and sorted_asks
            else None,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def real_market_summary(request):
    """
    Get real market summary data from Alpha Vantage API.
    """
    try:
        # Get top gainers/losers from Alpha Vantage
        market_data = alpha_vantage_service.get_top_gainers_losers()

        if not market_data:
            # Fallback to database data if API fails
            latest_prices = (
                StockPrice.objects.filter(interval="1d")
                .select_related("stock")
                .order_by("-date")[:50]
            )

            # Create mock data structure
            market_data = {
                "last_updated": timezone.now().isoformat(),
                "top_gainers": [],
                "top_losers": [],
                "most_actively_traded": [],
            }

            # Sort by price change percentage
            sorted_prices = sorted(
                latest_prices, key=lambda x: x.price_change_percent, reverse=True
            )

            # Top gainers
            for price in sorted_prices[:10]:
                if price.price_change_percent > 0:
                    market_data["top_gainers"].append(
                        {
                            "ticker": price.stock.symbol,
                            "price": float(price.close_price),
                            "change_amount": float(price.price_change),
                            "change_percentage": str(price.price_change_percent),
                            "volume": price.volume,
                        }
                    )

            # Top losers
            for price in reversed(sorted_prices[-10:]):
                if price.price_change_percent < 0:
                    market_data["top_losers"].append(
                        {
                            "ticker": price.stock.symbol,
                            "price": float(price.close_price),
                            "change_amount": float(price.price_change),
                            "change_percentage": str(price.price_change_percent),
                            "volume": price.volume,
                        }
                    )

            # Most active (by volume)
            active_prices = sorted(latest_prices, key=lambda x: x.volume, reverse=True)[
                :10
            ]
            for price in active_prices:
                market_data["most_actively_traded"].append(
                    {
                        "ticker": price.stock.symbol,
                        "price": float(price.close_price),
                        "change_amount": float(price.price_change),
                        "change_percentage": str(price.price_change_percent),
                        "volume": price.volume,
                    }
                )

        return Response(market_data)

    except (ValueError, KeyError, AttributeError) as e:
        return Response(
            {"error": f"Failed to fetch market summary: {e!s}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def sync_stock_data(request):
    """
    Trigger manual sync of stock data from Alpha Vantage.
    """
    symbols = (
        request.GET.get("symbols", "").split(",") if request.GET.get("symbols") else []
    )

    if not symbols:
        # Default to popular stocks
        symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]

    synced_stocks = []
    errors = []

    for symbol in symbols[:5]:  # Limit to 5 to avoid API limits
        symbol = symbol.strip().upper()

        try:
            # Get or create stock
            stock, created = Stock.objects.get_or_create(
                symbol=symbol,
                defaults={"name": symbol, "exchange": "Unknown", "is_active": True},
            )

            # Fetch current quote
            quote_data = alpha_vantage_service.get_quote(symbol)

            if quote_data:
                # Update stock with latest data
                trading_day = (
                    datetime.strptime(quote_data["latest_trading_day"], "%Y-%m-%d")
                    .replace(tzinfo=timezone.utc)
                    .date()
                )

                change_percent = float(quote_data["change_percent"])

                _stock_price, price_created = StockPrice.objects.update_or_create(
                    stock=stock,
                    date=trading_day,
                    interval="1d",
                    defaults={
                        "open_price": quote_data["open_price"],
                        "high_price": quote_data["high_price"],
                        "low_price": quote_data["low_price"],
                        "close_price": quote_data["close_price"],
                        "volume": quote_data["volume"],
                        "price_change": quote_data["change"],
                        "price_change_percent": change_percent,
                    },
                )

                synced_stocks.append(
                    {
                        "symbol": symbol,
                        "price": float(quote_data["close_price"]),
                        "change": float(quote_data["change"]),
                        "change_percent": change_percent,
                        "created": created,
                        "price_updated": price_created,
                    }
                )
            else:
                errors.append(f"Failed to fetch data for {symbol}")

        except (ValueError, KeyError, AttributeError) as e:
            errors.append(f"Error processing {symbol}: {e!s}")

    return Response(
        {
            "synced_stocks": synced_stocks,
            "errors": errors,
            "message": f"Synced {len(synced_stocks)} stocks with {len(errors)} errors",
        }
    )


class PortfolioListView(generics.ListCreateAPIView):
    """
    List user's portfolio holdings or add a new stock purchase.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PortfolioCreateSerializer
        return PortfolioSerializer

    def get_queryset(self):
        return (
            Portfolio.objects.filter(user=self.request.user)
            .select_related("stock")
            .order_by("-purchase_date", "-created_at")
        )

    def perform_create(self, serializer):
        """Create portfolio entry and return full object with stock details."""
        instance = serializer.save()
        instance.refresh_from_db()
        return instance

    def create(self, request, *args, **kwargs):
        """Override create to return full portfolio object with stock details."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = self.perform_create(serializer)

        response_serializer = PortfolioSerializer(
            instance, context={"request": request}
        )
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class PortfolioDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a portfolio entry.
    """

    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user).select_related("stock")


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def add_funds(request):
    """
    Add funds to user's cash balance.
    """
    amount = request.data.get("amount")

    if not amount:
        return Response(
            {"error": _("Amount is required.")}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        amount = Decimal(str(amount))
        if amount <= 0:
            return Response(
                {"error": _("Amount must be greater than 0.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
    except (ValueError, TypeError):
        return Response(
            {"error": _("Invalid amount format.")}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user_profile = UserProfile.objects.get(user=request.user)
        user_profile.cash += amount
        user_profile.save()

        return Response(
            {
                "message": _("Funds added successfully."),
                "new_balance": float(user_profile.cash),
                "amount_added": float(amount),
            },
            status=status.HTTP_200_OK,
        )
    except UserProfile.DoesNotExist:
        return Response(
            {"error": _("User profile not found.")}, status=status.HTTP_404_NOT_FOUND
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def portfolio_summary(request):
    """
    Get user's portfolio summary with total value and statistics.
    """
    user = request.user

    # Get user profile for cash balance
    try:
        user_profile = UserProfile.objects.get(user=user)
        cash_balance = float(user_profile.cash)
    except UserProfile.DoesNotExist:
        cash_balance = 0.00

    # Get all portfolio holdings
    holdings = Portfolio.objects.filter(user=user).select_related("stock")

    # Calculate totals
    total_cost = Decimal("0.00")
    total_current_value = Decimal("0.00")
    holdings_data = []

    for holding in holdings:
        latest_price = holding.stock.latest_price
        current_value = holding.current_value
        total_cost += holding.total_cost
        total_current_value += current_value

        holdings_data.append(
            {
                "id": str(holding.id),
                "stock": {
                    "symbol": holding.stock.symbol,
                    "name": holding.stock.name,
                },
                "quantity": float(holding.quantity),
                "purchase_price": float(holding.purchase_price),
                "purchase_date": holding.purchase_date,
                "total_cost": float(holding.total_cost),
                "current_value": float(current_value),
                "gain_loss": float(holding.gain_loss),
                "gain_loss_percent": float(holding.gain_loss_percent),
                "current_price": float(latest_price.close_price)
                if latest_price
                else None,
            }
        )

    total_gain_loss = total_current_value - total_cost
    total_gain_loss_percent = (
        (total_gain_loss / total_cost * 100) if total_cost > 0 else Decimal("0.00")
    )

    # Total portfolio value = cash + stock value
    total_portfolio_value = Decimal(str(cash_balance)) + total_current_value

    return Response(
        {
            "cash_balance": cash_balance,
            "total_holdings": len(holdings_data),
            "total_cost": float(total_cost),
            "total_current_value": float(total_current_value),
            "total_gain_loss": float(total_gain_loss),
            "total_gain_loss_percent": float(total_gain_loss_percent),
            "total_portfolio_value": float(total_portfolio_value),
            "holdings": holdings_data,
        }
    )


class OrderListView(generics.ListCreateAPIView):
    """
    List user's orders or create a new order.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return OrderCreateSerializer
        return OrderSerializer

    def get_queryset(self):
        queryset = (
            Order.objects.filter(user=self.request.user)
            .select_related("stock")
            .order_by("-created_at")
        )

        # Filter by status
        status = self.request.query_params.get("status", None)
        if status:
            queryset = queryset.filter(status=status)

        # Filter by order type
        order_type = self.request.query_params.get("order_type", None)
        if order_type:
            queryset = queryset.filter(order_type=order_type)

        # Filter by transaction type
        transaction_type = self.request.query_params.get("transaction_type", None)
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        return queryset

    def perform_create(self, serializer):
        """Create order and return full object with stock details."""
        instance = serializer.save()
        instance.refresh_from_db()
        return instance

    def create(self, request, *args, **kwargs):
        """Override create to return full order object with stock details."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = self.perform_create(serializer)

        response_serializer = OrderSerializer(instance, context={"request": request})
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class OrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or cancel an order.
    """

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).select_related("stock")

    def update(self, request, *args, **kwargs):
        """Only allow cancelling orders (changing status to cancelled)."""
        instance = self.get_object()

        # Only allow cancelling waiting orders
        if instance.status != "waiting":
            return Response(
                {"error": _("Only waiting orders can be cancelled.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only allow status change to cancelled
        if request.data.get("status") == "cancelled":
            instance.status = "cancelled"
            instance.save()
            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        return Response(
            {"error": _("Only status change to cancelled is allowed.")},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def execute_orders(request):  # noqa: PLR0912, PLR0915
    """
    Execute pending orders (check target prices and execute if conditions are met).
    This should be called periodically (e.g., via Celery task).
    """
    user = request.user if request.user.is_authenticated else None

    # Get all waiting orders
    if user:
        orders = Order.objects.filter(user=user, status="waiting")
    else:
        orders = Order.objects.filter(status="waiting")

    executed_count = 0
    executed_orders = []
    failed_orders = []

    for order in orders:
        # Store original status

        # Try to execute
        executed = order.execute()

        # Refresh from DB to get updated status
        order.refresh_from_db()

        if executed:
            executed_count += 1
            executed_orders.append(
                {
                    "id": str(order.id),
                    "stock_symbol": order.stock.symbol,
                    "executed_price": float(order.executed_price),
                }
            )
        else:
            # Determine error reason
            error_reason = None
            if order.status == "insufficient_funds":
                if order.transaction_type == "buy":
                    try:
                        user_profile = UserProfile.objects.get(user=order.user)
                        latest_price = order.stock.latest_price
                        if latest_price:
                            total_cost = order.quantity * latest_price.close_price
                            error_reason = _(
                                "Insufficient funds. Required: ${total_cost:,.2f}, "
                                "Available: ${cash:,.2f}"
                            ) % {"total_cost": total_cost, "cash": user_profile.cash}
                        else:
                            error_reason = _(
                                "Insufficient funds. No price data available."
                            )
                    except UserProfile.DoesNotExist:
                        error_reason = _("Insufficient funds. User profile not found.")
                else:  # sell
                    try:
                        portfolio_entry = Portfolio.objects.get(
                            user=order.user, stock=order.stock
                        )
                        error_reason = _(
                            "Insufficient shares. Required: %(required)s, "
                            "Available: %(available)s"
                        ) % {
                            "required": order.quantity,
                            "available": portfolio_entry.quantity,
                        }
                    except Portfolio.DoesNotExist:
                        error_reason = _("No shares available to sell for this stock.")
            elif not order.can_execute:
                if order.order_type == "target":
                    latest_price = order.stock.latest_price
                    if latest_price:
                        if order.transaction_type == "buy":
                            error_reason = _(
                                "Target price not met. Current: $%(current)s, "
                                "Target: $%(target)s"
                            ) % {
                                "current": f"{latest_price.close_price:,.2f}",
                                "target": f"{order.target_price:,.2f}",
                            }
                        else:  # sell
                            error_reason = _(
                                "Target price not met. Current: $%(current)s, "
                                "Target: $%(target)s"
                            ) % {
                                "current": f"{latest_price.close_price:,.2f}",
                                "target": f"{order.target_price:,.2f}",
                            }
                    else:
                        error_reason = _(
                            "Target price order cannot execute - no price data available."
                        )
                else:
                    error_reason = _("Order cannot be executed - conditions not met.")
            else:
                latest_price = order.stock.latest_price
                if not latest_price:
                    error_reason = _(
                        "Cannot execute - no price data available for this stock."
                    )
                else:
                    error_reason = _("Order execution failed - unknown reason.")

            failed_orders.append(
                {
                    "id": str(order.id),
                    "stock_symbol": order.stock.symbol,
                    "transaction_type": order.transaction_type,
                    "order_type": order.order_type,
                    "quantity": float(order.quantity),
                    "status": order.status,
                    "error": error_reason,
                }
            )

    response_data = {
        "executed_count": executed_count,
        "executed_orders": executed_orders,
        "failed_count": len(failed_orders),
        "failed_orders": failed_orders,
    }

    if executed_count > 0 and len(failed_orders) == 0:
        response_data["message"] = _("Executed %(count)s order(s)") % {
            "count": executed_count
        }
    elif executed_count > 0 and len(failed_orders) > 0:
        response_data["message"] = _(
            "Executed %(executed)s order(s), %(failed)s order(s) failed"
        ) % {"executed": executed_count, "failed": len(failed_orders)}
    elif len(failed_orders) > 0:
        response_data["message"] = _("%(count)s order(s) failed to execute") % {
            "count": len(failed_orders)
        }
    else:
        response_data["message"] = _("No orders to execute")

    return Response(response_data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def order_summary(request):
    """
    Get user's order summary with statistics.
    """
    user = request.user

    # Get all orders
    orders = Order.objects.filter(user=user).select_related("stock")

    # Count by status
    status_counts = {
        "waiting": orders.filter(status="waiting").count(),
        "in_progress": orders.filter(status="in_progress").count(),
        "done": orders.filter(status="done").count(),
        "cancelled": orders.filter(status="cancelled").count(),
        "insufficient_funds": orders.filter(status="insufficient_funds").count(),
    }

    # Count by order type
    type_counts = {
        "market": orders.filter(order_type="market").count(),
        "target": orders.filter(order_type="target").count(),
    }

    # Count by transaction type
    transaction_counts = {
        "buy": orders.filter(transaction_type="buy").count(),
        "sell": orders.filter(transaction_type="sell").count(),
    }

    # Get waiting orders
    waiting_orders = orders.filter(status="waiting")[:10]
    waiting_data = OrderSerializer(
        waiting_orders, many=True, context={"request": request}
    ).data

    return Response(
        {
            "status_counts": status_counts,
            "type_counts": type_counts,
            "transaction_counts": transaction_counts,
            "total_orders": orders.count(),
            "waiting_orders": waiting_data,
        }
    )


# Trading Bot Endpoints


class TradingBotListView(generics.ListCreateAPIView):
    """List user's trading bots or create a new bot."""

    serializer_class = TradingBotConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TradingBotConfig.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        bot = serializer.save(user=self.request.user)
        # Create notification
        create_notification(
            user=self.request.user,
            notification_type="bot_created",
            title="Bot Created",
            message=f'Your trading bot "{bot.name}" has been created successfully.',
            related_object_type="bot",
            related_object_id=bot.id,
        )


class TradingBotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a trading bot."""

    serializer_class = TradingBotConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TradingBotConfig.objects.filter(user=self.request.user)

    def perform_update(self, serializer):
        bot = serializer.save()
        # Create notification
        create_notification(
            user=self.request.user,
            notification_type="bot_updated",
            title="Bot Updated",
            message=f'Your trading bot "{bot.name}" has been updated.',
            related_object_type="bot",
            related_object_id=bot.id,
        )

    def perform_destroy(self, instance):
        bot_name = instance.name
        instance.delete()
        # Create notification
        create_notification(
            user=self.request.user,
            notification_type="bot_deleted",
            title="Bot Deleted",
            message=f'Your trading bot "{bot_name}" has been deleted.',
        )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def activate_bot(request, pk):
    """Activate a trading bot."""
    try:
        bot = TradingBotConfig.objects.get(id=pk, user=request.user)
        bot.is_active = True
        bot.save()
        # Create notification
        create_notification(
            user=request.user,
            notification_type="bot_activated",
            title="Bot Activated",
            message=f'Your trading bot "{bot.name}" has been activated.',
            related_object_type="bot",
            related_object_id=bot.id,
        )
        serializer = TradingBotConfigSerializer(bot)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except TradingBotConfig.DoesNotExist:
        return Response({"error": "Bot not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def deactivate_bot(request, pk):
    """Deactivate a trading bot."""
    try:
        bot = TradingBotConfig.objects.get(id=pk, user=request.user)
        bot.is_active = False
        bot.save()
        # Create notification
        create_notification(
            user=request.user,
            notification_type="bot_deactivated",
            title="Bot Deactivated",
            message=f'Your trading bot "{bot.name}" has been deactivated.',
            related_object_type="bot",
            related_object_id=bot.id,
        )
        serializer = TradingBotConfigSerializer(bot)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except TradingBotConfig.DoesNotExist:
        return Response({"error": "Bot not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def execute_bot(request, pk):
    """Manually trigger bot execution."""
    try:
        bot_config = TradingBotConfig.objects.get(id=pk, user=request.user)

        if not bot_config.is_active:
            return Response(
                {"error": "Bot is not active"}, status=status.HTTP_400_BAD_REQUEST
            )

        from .bot_engine import TradingBot

        bot = TradingBot(bot_config)
        results = bot.run_analysis()

        # Create notification
        buy_count = len(results.get("buy_signals", []))
        sell_count = len(results.get("sell_signals", []))
        create_notification(
            user=request.user,
            notification_type="bot_executed",
            title="Bot Executed",
            message=f'Your trading bot "{bot_config.name}" executed: {buy_count} buy signals, {sell_count} sell signals.',
            related_object_type="bot",
            related_object_id=bot_config.id,
            metadata={"buy_signals": buy_count, "sell_signals": sell_count},
        )

        return Response(results, status=status.HTTP_200_OK)
    except TradingBotConfig.DoesNotExist:
        return Response({"error": "Bot not found"}, status=status.HTTP_404_NOT_FOUND)


class TradingBotExecutionListView(generics.ListAPIView):
    """List bot execution history."""

    serializer_class = TradingBotExecutionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        bot_id = self.kwargs.get("bot_id")
        return TradingBotExecution.objects.filter(
            bot_config_id=bot_id, bot_config__user=self.request.user
        ).select_related("stock", "bot_config", "executed_order")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def bot_performance(request, pk):
    """Get bot performance metrics."""
    try:
        bot_config = TradingBotConfig.objects.get(id=pk, user=request.user)

        # Get all executed orders
        orders = Order.objects.filter(
            bot_config=bot_config, status="done"
        ).select_related("stock")

        total_trades = orders.count()
        successful_trades = orders.filter(
            transaction_type="sell", executed_price__isnull=False
        ).count()

        # Calculate P&L (simplified)
        total_profit_loss = Decimal("0.00")
        profits = []
        losses = []

        for order in orders:
            if order.executed_price and order.executed_at:
                # Simplified P&L calculation
                # In reality, need to match buy/sell pairs
                pass

        win_rate = (
            (successful_trades / total_trades * 100)
            if total_trades > 0
            else Decimal("0.00")
        )

        performance_data = {
            "bot_id": str(bot_config.id),
            "bot_name": bot_config.name,
            "total_trades": total_trades,
            "successful_trades": successful_trades,
            "total_profit_loss": total_profit_loss,
            "win_rate": win_rate,
            "average_profit": sum(profits) / len(profits)
            if profits
            else Decimal("0.00"),
            "average_loss": sum(losses) / len(losses) if losses else Decimal("0.00"),
        }

        serializer = BotPerformanceSerializer(performance_data)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except TradingBotConfig.DoesNotExist:
        return Response({"error": "Bot not found"}, status=status.HTTP_404_NOT_FOUND)
