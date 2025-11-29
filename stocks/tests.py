from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Stock, StockAlert, StockPrice, UserWatchlist

User = get_user_model()


class StockModelTest(TestCase):
    """Test cases for Stock model."""

    def setUp(self):
        self.stock = Stock.objects.create(
            symbol="AAPL",
            name="Apple Inc.",
            exchange="NASDAQ",
            sector="Technology",
            industry="Consumer Electronics",
            market_cap=2500000000000,
            description="Apple Inc. designs and manufactures consumer electronics.",
        )

    def test_stock_creation(self):
        """Test stock model creation."""
        assert self.stock.symbol == "AAPL"
        assert self.stock.name == "Apple Inc."
        assert self.stock.exchange == "NASDAQ"
        assert self.stock.is_active

    def test_stock_str_representation(self):
        """Test stock string representation."""
        expected = "AAPL - Apple Inc."
        assert str(self.stock) == expected


class StockPriceModelTest(TestCase):
    """Test cases for StockPrice model."""

    def setUp(self):
        self.stock = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ"
        )
        self.stock_price = StockPrice.objects.create(
            stock=self.stock,
            date=date.today(),
            open_price=Decimal("150.00"),
            high_price=Decimal("155.00"),
            low_price=Decimal("149.00"),
            close_price=Decimal("153.00"),
            volume=1000000,
            interval="1d",
        )

    def test_stock_price_creation(self):
        """Test stock price model creation."""
        assert self.stock_price.stock == self.stock
        assert self.stock_price.open_price == Decimal("150.00")
        assert self.stock_price.close_price == Decimal("153.00")

    def test_price_change_calculation(self):
        """Test price change calculation."""
        expected_change = Decimal("3.00")  # 153.00 - 150.00
        assert self.stock_price.price_change == expected_change

    def test_price_change_percent_calculation(self):
        """Test price change percentage calculation."""
        expected_percent = Decimal("2.00")  # (3.00 / 150.00) * 100
        assert self.stock_price.price_change_percent == expected_percent

    def test_stock_price_str_representation(self):
        """Test stock price string representation."""
        expected = f"AAPL - {date.today()} (1d)"
        assert str(self.stock_price) == expected


class UserWatchlistModelTest(TestCase):
    """Test cases for UserWatchlist model."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.stock = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ"
        )
        self.watchlist = UserWatchlist.objects.create(
            user=self.user,
            stock=self.stock,
            target_price=Decimal("160.00"),
            notes="Waiting for earnings report",
        )

    def test_watchlist_creation(self):
        """Test watchlist model creation."""
        assert self.watchlist.user == self.user
        assert self.watchlist.stock == self.stock
        assert self.watchlist.target_price == Decimal("160.00")

    def test_watchlist_str_representation(self):
        """Test watchlist string representation."""
        expected = "test@example.com - AAPL"
        assert str(self.watchlist) == expected


class StockAlertModelTest(TestCase):
    """Test cases for StockAlert model."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.stock = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ"
        )
        self.alert = StockAlert.objects.create(
            user=self.user,
            stock=self.stock,
            alert_type="above",
            threshold_value=Decimal("160.00"),
        )

    def test_alert_creation(self):
        """Test alert model creation."""
        assert self.alert.user == self.user
        assert self.alert.stock == self.stock
        assert self.alert.alert_type == "above"
        assert self.alert.is_active
        assert not self.alert.is_triggered

    def test_alert_str_representation(self):
        """Test alert string representation."""
        expected = "test@example.com - AAPL above 160.00"
        assert str(self.alert) == expected


class StockAPITest(APITestCase):
    """Test cases for Stock API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        # Create test stocks
        self.stock1 = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ", sector="Technology"
        )
        self.stock2 = Stock.objects.create(
            symbol="GOOGL", name="Alphabet Inc.", exchange="NASDAQ", sector="Technology"
        )

        # Create test stock prices
        StockPrice.objects.create(
            stock=self.stock1,
            date=date.today(),
            open_price=Decimal("150.00"),
            high_price=Decimal("155.00"),
            low_price=Decimal("149.00"),
            close_price=Decimal("153.00"),
            volume=1000000,
            interval="1d",
        )

    def test_stock_list_authenticated(self):
        """Test stock list endpoint with authentication."""
        url = reverse("stocks:stock-list")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 2

    def test_stock_list_unauthenticated(self):
        """Test stock list endpoint without authentication."""
        self.client.credentials()  # Remove authentication
        url = reverse("stocks:stock-list")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_stock_detail(self):
        """Test stock detail endpoint."""
        url = reverse("stocks:stock-detail", kwargs={"symbol": "AAPL"})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["symbol"] == "AAPL"
        assert response.data["name"] == "Apple Inc."

    def test_stock_search(self):
        """Test stock search endpoint."""
        url = reverse("stocks:stock-search")
        response = self.client.get(url, {"q": "Apple"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["symbol"] == "AAPL"

    def test_stock_search_short_query(self):
        """Test stock search with short query."""
        url = reverse("stocks:stock-search")
        response = self.client.get(url, {"q": "A"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_stock_timeseries(self):
        """Test stock time series endpoint."""
        url = reverse("stocks:stock-timeseries", kwargs={"symbol": "AAPL"})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["stock"]["symbol"] == "AAPL"
        assert len(response.data["prices"]) == 1

    def test_stock_timeseries_invalid_symbol(self):
        """Test stock time series with invalid symbol."""
        url = reverse("stocks:stock-timeseries", kwargs={"symbol": "INVALID"})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class WatchlistAPITest(APITestCase):
    """Test cases for Watchlist API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.stock = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ"
        )

    def test_create_watchlist_entry(self):
        """Test creating a watchlist entry."""
        url = reverse("stocks:watchlist-list")
        data = {
            "stock_symbol": "AAPL",
            "target_price": "160.00",
            "notes": "Waiting for earnings",
        }
        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_201_CREATED
        assert UserWatchlist.objects.count() == 1

    def test_create_watchlist_invalid_symbol(self):
        """Test creating watchlist with invalid symbol."""
        url = reverse("stocks:watchlist-list")
        data = {"stock_symbol": "INVALID", "target_price": "160.00"}
        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_watchlist(self):
        """Test listing user's watchlist."""
        UserWatchlist.objects.create(
            user=self.user, stock=self.stock, target_price=Decimal("160.00")
        )

        url = reverse("stocks:watchlist-list")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1

    def test_update_watchlist_entry(self):
        """Test updating a watchlist entry."""
        watchlist = UserWatchlist.objects.create(
            user=self.user, stock=self.stock, target_price=Decimal("160.00")
        )

        url = reverse("stocks:watchlist-detail", kwargs={"pk": watchlist.pk})
        data = {"target_price": "170.00"}
        response = self.client.patch(url, data)

        assert response.status_code == status.HTTP_200_OK
        watchlist.refresh_from_db()
        assert watchlist.target_price == Decimal("170.00")

    def test_delete_watchlist_entry(self):
        """Test deleting a watchlist entry."""
        watchlist = UserWatchlist.objects.create(
            user=self.user, stock=self.stock, target_price=Decimal("160.00")
        )

        url = reverse("stocks:watchlist-detail", kwargs={"pk": watchlist.pk})
        response = self.client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert UserWatchlist.objects.count() == 0


class StockAlertAPITest(APITestCase):
    """Test cases for Stock Alert API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.stock = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ"
        )

    def test_create_stock_alert(self):
        """Test creating a stock alert."""
        url = reverse("stocks:alert-list")
        data = {
            "stock_symbol": "AAPL",
            "alert_type": "above",
            "threshold_value": "160.00",
        }
        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_201_CREATED
        assert StockAlert.objects.count() == 1

    def test_create_alert_invalid_threshold(self):
        """Test creating alert with invalid threshold."""
        url = reverse("stocks:alert-list")
        data = {
            "stock_symbol": "AAPL",
            "alert_type": "above",
            "threshold_value": "-10.00",
        }
        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_stock_alerts(self):
        """Test listing user's stock alerts."""
        StockAlert.objects.create(
            user=self.user,
            stock=self.stock,
            alert_type="above",
            threshold_value=Decimal("160.00"),
        )

        url = reverse("stocks:alert-list")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1

    def test_filter_alerts_by_status(self):
        """Test filtering alerts by active status."""
        StockAlert.objects.create(
            user=self.user,
            stock=self.stock,
            alert_type="above",
            threshold_value=Decimal("160.00"),
            is_active=True,
        )
        StockAlert.objects.create(
            user=self.user,
            stock=self.stock,
            alert_type="below",
            threshold_value=Decimal("140.00"),
            is_active=False,
        )

        url = reverse("stocks:alert-list")
        response = self.client.get(url, {"is_active": "true"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1


class DashboardAPITest(APITestCase):
    """Test cases for Dashboard API endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.stock = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ"
        )

        # Create watchlist entry
        UserWatchlist.objects.create(
            user=self.user, stock=self.stock, target_price=Decimal("160.00")
        )

        # Create stock alert
        StockAlert.objects.create(
            user=self.user,
            stock=self.stock,
            alert_type="above",
            threshold_value=Decimal("160.00"),
        )

    def test_user_dashboard(self):
        """Test user dashboard endpoint."""
        url = reverse("stocks:user-dashboard")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["watchlist"]) == 1
        assert response.data["alerts_summary"]["active_alerts"] == 1


class MarketSummaryAPITest(APITestCase):
    """Test cases for Market Summary API endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        # Create test stocks with prices
        stock1 = Stock.objects.create(
            symbol="AAPL", name="Apple Inc.", exchange="NASDAQ"
        )
        stock2 = Stock.objects.create(
            symbol="GOOGL", name="Alphabet Inc.", exchange="NASDAQ"
        )

        today = date.today()

        # Create price data for market summary
        StockPrice.objects.create(
            stock=stock1,
            date=today,
            open_price=Decimal("150.00"),
            high_price=Decimal("155.00"),
            low_price=Decimal("149.00"),
            close_price=Decimal("153.00"),
            volume=1000000,
            interval="1d",
        )
        StockPrice.objects.create(
            stock=stock2,
            date=today,
            open_price=Decimal("2500.00"),
            high_price=Decimal("2550.00"),
            low_price=Decimal("2480.00"),
            close_price=Decimal("2520.00"),
            volume=500000,
            interval="1d",
        )

    def test_market_summary(self):
        """Test market summary endpoint."""
        url = reverse("stocks:market-summary")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "top_gainers" in response.data
        assert "top_losers" in response.data
        assert "most_active" in response.data
        assert "date" in response.data
