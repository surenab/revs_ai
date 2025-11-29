"""
API services for fetching real-time stock data from various sources.
"""
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import requests
import yfinance as yf
import pandas as pd
from django.conf import settings
from django.utils import timezone
from decimal import Decimal

logger = logging.getLogger(__name__)


class AlphaVantageService:
    """Service class for interacting with Alpha Vantage API."""

    def __init__(self):
        self.api_key = settings.ALPHA_VANTAGE_API_KEY
        self.base_url = settings.ALPHA_VANTAGE_BASE_URL
        self.session = requests.Session()

        if not self.api_key:
            logger.warning("Alpha Vantage API key not configured")

    def _make_request(self, params: Dict[str, Any]) -> Optional[Dict]:
        """Make a request to Alpha Vantage API with rate limiting."""
        if not self.api_key:
            logger.error("Alpha Vantage API key not configured")
            return None

        params['apikey'] = self.api_key

        try:
            response = self.session.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            # Check for API errors
            if 'Error Message' in data:
                logger.error(f"Alpha Vantage API error: {data['Error Message']}")
                return None

            if 'Note' in data:
                logger.warning(f"Alpha Vantage API note: {data['Note']}")
                # Rate limit hit, wait and retry once
                time.sleep(60)
                return None

            return data

        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            return None
        except ValueError as e:
            logger.error(f"JSON decode error: {e}")
            return None

    def get_quote(self, symbol: str) -> Optional[Dict]:
        """Get real-time quote for a symbol."""
        params = {
            'function': 'GLOBAL_QUOTE',
            'symbol': symbol
        }

        data = self._make_request(params)
        if not data or 'Global Quote' not in data:
            return None

        quote = data['Global Quote']

        try:
            return {
                'symbol': quote.get('01. symbol', symbol),
                'open_price': Decimal(quote.get('02. open', '0')),
                'high_price': Decimal(quote.get('03. high', '0')),
                'low_price': Decimal(quote.get('04. low', '0')),
                'close_price': Decimal(quote.get('05. price', '0')),
                'volume': int(quote.get('06. volume', '0')),
                'latest_trading_day': quote.get('07. latest trading day', ''),
                'previous_close': Decimal(quote.get('08. previous close', '0')),
                'change': Decimal(quote.get('09. change', '0')),
                'change_percent': quote.get('10. change percent', '0%').replace('%', '')
            }
        except (ValueError, TypeError) as e:
            logger.error(f"Error parsing quote data for {symbol}: {e}")
            return None

    def get_daily_data(self, symbol: str, outputsize: str = 'compact') -> Optional[List[Dict]]:
        """Get daily time series data for a symbol."""
        params = {
            'function': 'TIME_SERIES_DAILY',
            'symbol': symbol,
            'outputsize': outputsize
        }

        data = self._make_request(params)
        if not data or 'Time Series (Daily)' not in data:
            return None

        time_series = data['Time Series (Daily)']
        result = []

        for date_str, values in time_series.items():
            try:
                result.append({
                    'date': datetime.strptime(date_str, '%Y-%m-%d').date(),
                    'open_price': Decimal(values['1. open']),
                    'high_price': Decimal(values['2. high']),
                    'low_price': Decimal(values['3. low']),
                    'close_price': Decimal(values['4. close']),
                    'volume': int(values['5. volume'])
                })
            except (ValueError, KeyError) as e:
                logger.error(f"Error parsing daily data for {symbol} on {date_str}: {e}")
                continue

        return result

    def get_intraday_data(self, symbol: str, interval: str = '1min', outputsize: str = 'compact') -> Optional[List[Dict]]:
        """Get intraday time series data for a symbol."""
        params = {
            'function': 'TIME_SERIES_INTRADAY',
            'symbol': symbol,
            'interval': interval,
            'outputsize': outputsize
        }

        data = self._make_request(params)
        time_series_key = f'Time Series ({interval})'

        if not data or time_series_key not in data:
            return None

        time_series = data[time_series_key]
        result = []

        for timestamp_str, values in time_series.items():
            try:
                # Parse timestamp
                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                timestamp = timezone.make_aware(timestamp)

                result.append({
                    'timestamp': timestamp,
                    'interval': interval,
                    'open_price': Decimal(values['1. open']),
                    'high_price': Decimal(values['2. high']),
                    'low_price': Decimal(values['3. low']),
                    'close_price': Decimal(values['4. close']),
                    'volume': int(values['5. volume'])
                })
            except (ValueError, KeyError) as e:
                logger.error(f"Error parsing intraday data for {symbol} at {timestamp_str}: {e}")
                continue

        return result

    def search_symbols(self, keywords: str) -> Optional[List[Dict]]:
        """Search for symbols matching keywords."""
        params = {
            'function': 'SYMBOL_SEARCH',
            'keywords': keywords
        }

        data = self._make_request(params)
        if not data or 'bestMatches' not in data:
            return None

        result = []
        for match in data['bestMatches']:
            try:
                result.append({
                    'symbol': match.get('1. symbol', ''),
                    'name': match.get('2. name', ''),
                    'type': match.get('3. type', ''),
                    'region': match.get('4. region', ''),
                    'market_open': match.get('5. marketOpen', ''),
                    'market_close': match.get('6. marketClose', ''),
                    'timezone': match.get('7. timezone', ''),
                    'currency': match.get('8. currency', ''),
                    'match_score': float(match.get('9. matchScore', '0'))
                })
            except (ValueError, KeyError) as e:
                logger.error(f"Error parsing search result: {e}")
                continue

        return result

    def get_company_overview(self, symbol: str) -> Optional[Dict]:
        """Get company overview data."""
        params = {
            'function': 'OVERVIEW',
            'symbol': symbol
        }

        data = self._make_request(params)
        if not data or 'Symbol' not in data:
            return None

        try:
            return {
                'symbol': data.get('Symbol', ''),
                'name': data.get('Name', ''),
                'description': data.get('Description', ''),
                'exchange': data.get('Exchange', ''),
                'currency': data.get('Currency', ''),
                'country': data.get('Country', ''),
                'sector': data.get('Sector', ''),
                'industry': data.get('Industry', ''),
                'market_cap': data.get('MarketCapitalization', ''),
                'pe_ratio': data.get('PERatio', ''),
                'peg_ratio': data.get('PEGRatio', ''),
                'book_value': data.get('BookValue', ''),
                'dividend_per_share': data.get('DividendPerShare', ''),
                'dividend_yield': data.get('DividendYield', ''),
                'eps': data.get('EPS', ''),
                'revenue_per_share_ttm': data.get('RevenuePerShareTTM', ''),
                'profit_margin': data.get('ProfitMargin', ''),
                'operating_margin_ttm': data.get('OperatingMarginTTM', ''),
                'return_on_assets_ttm': data.get('ReturnOnAssetsTTM', ''),
                'return_on_equity_ttm': data.get('ReturnOnEquityTTM', ''),
                'revenue_ttm': data.get('RevenueTTM', ''),
                'gross_profit_ttm': data.get('GrossProfitTTM', ''),
                'diluted_eps_ttm': data.get('DilutedEPSTTM', ''),
                'quarterly_earnings_growth_yoy': data.get('QuarterlyEarningsGrowthYOY', ''),
                'quarterly_revenue_growth_yoy': data.get('QuarterlyRevenueGrowthYOY', ''),
                'analyst_target_price': data.get('AnalystTargetPrice', ''),
                'trailing_pe': data.get('TrailingPE', ''),
                'forward_pe': data.get('ForwardPE', ''),
                'price_to_sales_ratio_ttm': data.get('PriceToSalesRatioTTM', ''),
                'price_to_book_ratio': data.get('PriceToBookRatio', ''),
                'ev_to_revenue': data.get('EVToRevenue', ''),
                'ev_to_ebitda': data.get('EVToEBITDA', ''),
                'beta': data.get('Beta', ''),
                '52_week_high': data.get('52WeekHigh', ''),
                '52_week_low': data.get('52WeekLow', ''),
                '50_day_moving_average': data.get('50DayMovingAverage', ''),
                '200_day_moving_average': data.get('200DayMovingAverage', ''),
                'shares_outstanding': data.get('SharesOutstanding', ''),
                'dividend_date': data.get('DividendDate', ''),
                'ex_dividend_date': data.get('ExDividendDate', ''),
            }
        except (ValueError, KeyError) as e:
            logger.error(f"Error parsing company overview for {symbol}: {e}")
            return None

    def get_top_gainers_losers(self) -> Optional[Dict]:
        """Get top gainers, losers, and most active stocks."""
        params = {
            'function': 'TOP_GAINERS_LOSERS'
        }

        data = self._make_request(params)
        if not data:
            return None

        try:
            result = {
                'metadata': data.get('metadata', {}),
                'last_updated': data.get('last_updated', ''),
                'top_gainers': [],
                'top_losers': [],
                'most_actively_traded': []
            }

            # Process top gainers
            for item in data.get('top_gainers', []):
                result['top_gainers'].append({
                    'ticker': item.get('ticker', ''),
                    'price': Decimal(item.get('price', '0')),
                    'change_amount': Decimal(item.get('change_amount', '0')),
                    'change_percentage': item.get('change_percentage', '0%').replace('%', ''),
                    'volume': int(item.get('volume', '0'))
                })

            # Process top losers
            for item in data.get('top_losers', []):
                result['top_losers'].append({
                    'ticker': item.get('ticker', ''),
                    'price': Decimal(item.get('price', '0')),
                    'change_amount': Decimal(item.get('change_amount', '0')),
                    'change_percentage': item.get('change_percentage', '0%').replace('%', ''),
                    'volume': int(item.get('volume', '0'))
                })

            # Process most actively traded
            for item in data.get('most_actively_traded', []):
                result['most_actively_traded'].append({
                    'ticker': item.get('ticker', ''),
                    'price': Decimal(item.get('price', '0')),
                    'change_amount': Decimal(item.get('change_amount', '0')),
                    'change_percentage': item.get('change_percentage', '0%').replace('%', ''),
                    'volume': int(item.get('volume', '0'))
                })

            return result

        except (ValueError, KeyError) as e:
            logger.error(f"Error parsing top gainers/losers data: {e}")
            return None


class YahooFinanceService:
    """Service class for interacting with Yahoo Finance API via yfinance."""

    def __init__(self):
        self.session = requests.Session()

    def get_intraday_data(self, symbol: str, interval: str = "5m", period: str = "1d") -> Optional[Dict]:
        """
        Fetch intraday data for a stock symbol.

        Args:
            symbol: Stock symbol (e.g., 'AAPL')
            interval: Data interval ('1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h')
            period: Data period ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max')

        Returns:
            Dictionary containing intraday price data or None if error
        """
        try:
            ticker = yf.Ticker(symbol)

            # Get intraday data
            hist = ticker.history(period=period, interval=interval)

            if hist.empty:
                logger.warning(f"No intraday data found for symbol: {symbol}")
                return None

            # Convert to dictionary format
            data = []
            for timestamp, row in hist.iterrows():
                data.append({
                    'datetime': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume']) if pd.notna(row['Volume']) else 0
                })

            return {
                'symbol': symbol,
                'interval': interval,
                'data': data,
                'last_updated': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error fetching intraday data for {symbol}: {e}")
            return None

    def get_current_price(self, symbol: str) -> Optional[Dict]:
        """
        Get current/latest price for a stock symbol.

        Args:
            symbol: Stock symbol (e.g., 'AAPL')

        Returns:
            Dictionary containing current price data or None if error
        """
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            if not info:
                logger.warning(f"No info found for symbol: {symbol}")
                return None

            # Get the most recent price data
            hist = ticker.history(period="1d", interval="1m")
            if hist.empty:
                logger.warning(f"No recent price data found for symbol: {symbol}")
                return None

            latest = hist.iloc[-1]

            return {
                'symbol': symbol,
                'price': float(latest['Close']),
                'open': float(latest['Open']),
                'high': float(latest['High']),
                'low': float(latest['Low']),
                'volume': int(latest['Volume']) if pd.notna(latest['Volume']) else 0,
                'timestamp': hist.index[-1].strftime('%Y-%m-%d %H:%M:%S'),
                'previous_close': float(info.get('previousClose', 0)),
                'change': float(latest['Close']) - float(info.get('previousClose', 0)),
                'change_percent': ((float(latest['Close']) - float(info.get('previousClose', 0))) / float(info.get('previousClose', 1))) * 100
            }

        except Exception as e:
            logger.error(f"Error fetching current price for {symbol}: {e}")
            return None

    def get_stock_info(self, symbol: str) -> Optional[Dict]:
        """
        Get basic stock information.

        Args:
            symbol: Stock symbol (e.g., 'AAPL')

        Returns:
            Dictionary containing stock info or None if error
        """
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            if not info:
                return None

            return {
                'symbol': symbol,
                'name': info.get('longName', ''),
                'sector': info.get('sector', ''),
                'industry': info.get('industry', ''),
                'exchange': info.get('exchange', ''),
                'market_cap': info.get('marketCap'),
                'description': info.get('longBusinessSummary', ''),
                'currency': info.get('currency', 'USD')
            }

        except Exception as e:
            logger.error(f"Error fetching stock info for {symbol}: {e}")
            return None

    def get_multiple_current_prices(self, symbols: List[str]) -> Dict[str, Optional[Dict]]:
        """
        Get current prices for multiple symbols efficiently.

        Args:
            symbols: List of stock symbols

        Returns:
            Dictionary mapping symbols to their price data
        """
        results = {}

        try:
            # Use yfinance's download function for batch processing
            data = yf.download(symbols, period="1d", interval="1m", group_by='ticker', progress=False)

            for symbol in symbols:
                try:
                    if len(symbols) == 1:
                        symbol_data = data
                    else:
                        symbol_data = data[symbol]

                    if symbol_data.empty:
                        results[symbol] = None
                        continue

                    latest = symbol_data.iloc[-1]

                    # Get additional info for change calculation
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    previous_close = float(info.get('previousClose', 0))

                    results[symbol] = {
                        'symbol': symbol,
                        'price': float(latest['Close']),
                        'open': float(latest['Open']),
                        'high': float(latest['High']),
                        'low': float(latest['Low']),
                        'volume': int(latest['Volume']) if pd.notna(latest['Volume']) else 0,
                        'timestamp': symbol_data.index[-1].strftime('%Y-%m-%d %H:%M:%S'),
                        'previous_close': previous_close,
                        'change': float(latest['Close']) - previous_close,
                        'change_percent': ((float(latest['Close']) - previous_close) / previous_close) * 100 if previous_close > 0 else 0
                    }

                except Exception as e:
                    logger.error(f"Error processing data for {symbol}: {e}")
                    results[symbol] = None

        except Exception as e:
            logger.error(f"Error fetching multiple prices: {e}")
            # Fallback to individual requests
            for symbol in symbols:
                results[symbol] = self.get_current_price(symbol)

        return results

    def get_multiple_current_quotes(self, symbols: List[str]) -> Dict[str, Optional[Dict]]:
        """
        Get current quotes with bid/ask data for multiple symbols efficiently.
        Optimized for tick data recording.

        Args:
            symbols: List of stock symbols

        Returns:
            Dictionary mapping symbols to their quote data
        """
        results = {}

        try:
            # Use yfinance's download function for batch processing
            # Suppress FutureWarning about auto_adjust
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=FutureWarning)
                data = yf.download(symbols, period="1d", interval="1m", group_by='ticker', progress=False, auto_adjust=True)

            # Get ticker info for bid/ask data (limited to avoid too many individual calls)
            ticker_infos = {}
            for symbol in symbols[:20]:  # Limit to first 20 to avoid rate limiting
                try:
                    ticker = yf.Ticker(symbol)
                    ticker_infos[symbol] = ticker.info
                except Exception as e:
                    logger.warning(f"Could not get ticker info for {symbol}: {e}")
                    ticker_infos[symbol] = {}

            for symbol in symbols:
                try:
                    # Handle case where symbol might not be in downloaded data
                    if len(symbols) == 1:
                        symbol_data = data
                    else:
                        # Check if symbol exists in the multi-index DataFrame
                        if hasattr(data.columns, 'levels') and len(data.columns.levels) > 0:
                            # Multi-index DataFrame (grouped by ticker)
                            if symbol not in data.columns.levels[0]:
                                logger.debug(f"Symbol {symbol} not found in downloaded data, possibly delisted")
                                results[symbol] = None
                                continue
                            symbol_data = data[symbol]
                        elif symbol in data.columns:
                            # Simple column-based access
                            symbol_data = data[symbol]
                        else:
                            # Symbol not found
                            logger.debug(f"Symbol {symbol} not found in downloaded data, possibly delisted")
                            results[symbol] = None
                            continue

                    if symbol_data.empty or len(symbol_data) == 0:
                        logger.debug(f"Empty data for {symbol}")
                        results[symbol] = None
                        continue

                    latest = symbol_data.iloc[-1]
                    info = ticker_infos.get(symbol, {})

                    # Handle NaN values properly
                    # latest is a pandas Series from DataFrame, access by column name
                    try:
                        close_price = latest['Close']
                    except (KeyError, IndexError):
                        try:
                            close_price = latest.get('Close', None)
                        except:
                            close_price = None

                    try:
                        volume = latest['Volume']
                    except (KeyError, IndexError):
                        try:
                            volume = latest.get('Volume', 0)
                        except:
                            volume = 0

                    # Skip if essential data is NaN or invalid
                    if pd.isna(close_price) or close_price <= 0:
                        logger.debug(f"Invalid close price for {symbol}: {close_price}, skipping")
                        results[symbol] = None
                        continue

                    # Validate timestamp
                    try:
                        timestamp_str = symbol_data.index[-1].strftime('%Y-%m-%d %H:%M:%S')
                    except (AttributeError, IndexError):
                        timestamp_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                    results[symbol] = {
                        'symbol': symbol,
                        'price': float(close_price),
                        'volume': int(volume) if pd.notna(volume) and volume > 0 else 0,
                        'bid': info.get('bid') if info.get('bid') else None,
                        'ask': info.get('ask') if info.get('ask') else None,
                        'bid_size': info.get('bidSize') if info.get('bidSize') else None,
                        'ask_size': info.get('askSize') if info.get('askSize') else None,
                        'timestamp': timestamp_str
                    }

                except KeyError as e:
                    # Symbol column not found in multi-index DataFrame
                    logger.debug(f"Symbol {symbol} not found in data structure: {e}")
                    results[symbol] = None
                except (AttributeError, IndexError) as e:
                    logger.debug(f"Error accessing data for {symbol}: {e}")
                    results[symbol] = None
                except Exception as e:
                    logger.error(f"Error processing quote data for {symbol}: {e}")
                    results[symbol] = None

        except Exception as e:
            logger.error(f"Error fetching multiple quotes: {e}")
            # Fallback to individual requests for smaller batches
            for symbol in symbols:
                try:
                    results[symbol] = self.get_current_quote(symbol)
                except Exception as fallback_error:
                    logger.error(f"Fallback failed for {symbol}: {fallback_error}")
                    results[symbol] = None

        return results

    def get_current_quote(self, symbol: str) -> Optional[Dict]:
        """
        Get current quote with bid/ask data for tick recording.

        Args:
            symbol: Stock symbol (e.g., 'AAPL')

        Returns:
            Dictionary containing current quote data or None if error
        """
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            if not info:
                logger.warning(f"No info found for symbol: {symbol}")
                return None

            # Get the most recent price data
            hist = ticker.history(period="1d", interval="1m")
            if hist.empty:
                logger.warning(f"No recent price data found for symbol: {symbol}")
                return None

            latest = hist.iloc[-1]

            return {
                'symbol': symbol,
                'price': float(latest['Close']),
                'volume': int(latest['Volume']) if pd.notna(latest['Volume']) else 0,
                'bid': info.get('bid', None),
                'ask': info.get('ask', None),
                'bid_size': info.get('bidSize', None),
                'ask_size': info.get('askSize', None),
                'timestamp': hist.index[-1].strftime('%Y-%m-%d %H:%M:%S')
            }

        except Exception as e:
            logger.error(f"Error fetching current quote for {symbol}: {e}")
            return None

    def get_daily_price(self, symbol: str, period: str = "1d") -> Optional[List[Dict]]:
        """
        Get daily price data for a symbol.

        Args:
            symbol: Stock symbol (e.g., 'AAPL')
            period: Data period ('1d', '5d', '1mo', etc.)

        Returns:
            List of daily price data or None if error
        """
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period, interval="1d")

            if hist.empty:
                logger.warning(f"No daily price data found for symbol: {symbol}")
                return None

            # Convert to list of dictionaries
            data = []
            for timestamp, row in hist.iterrows():
                data.append({
                    'date': timestamp.strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'adj_close': float(row['Close']),  # Yahoo Finance doesn't separate adjusted close in history
                    'volume': int(row['Volume']) if pd.notna(row['Volume']) else 0
                })

            return data

        except Exception as e:
            logger.error(f"Error fetching daily price for {symbol}: {e}")
            return None


# Singleton instances
alpha_vantage_service = AlphaVantageService()
yahoo_finance_service = YahooFinanceService()
