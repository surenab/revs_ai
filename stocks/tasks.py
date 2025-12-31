"""
Celery tasks for background stock data processing.
"""

import logging
import time
from datetime import datetime
from datetime import time as dt_time
from decimal import Decimal

import pytz
from celery import shared_task
from django.core.management import call_command
from django.db import transaction
from django.utils import timezone

from .bot_engine import TradingBot
from .models import (
    IntradayPrice,
    Stock,
    StockPrice,
    StockTick,
    TradingBotConfig,
)
from .services import yahoo_finance_service

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_daily_intraday_data(self, symbols=None, interval="5m", force=False):
    """
    Celery task to sync daily intraday data for all active stocks.

    Args:
        symbols: Optional list of symbols to sync. If None, syncs all active stocks.
        interval: Time interval for intraday data (default: '5m')
        force: Force update even if data already exists for today

    Returns:
        Dict with sync results
    """
    try:
        logger.info("Starting daily intraday sync task - interval: %s", interval)

        # Use the management command for the actual sync
        cmd_args = ["--interval", interval, "--batch-size", "10", "--delay", "0.5"]

        if symbols:
            cmd_args.extend(["--symbols", ",".join(symbols)])

        if force:
            cmd_args.append("--force")

        # Call the management command
        call_command("sync_daily_intraday", *cmd_args)

        logger.info("Daily intraday sync task completed successfully")
        return {
            "status": "success",
            "message": "Daily intraday sync completed",
            "timestamp": timezone.now().isoformat(),
        }

    except Exception as exc:
        logger.exception("Daily intraday sync task failed")

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info("Retrying task in %s seconds...", self.default_retry_delay)
            raise self.retry(exc=exc) from exc

        # If we've exceeded max retries, log the failure
        logger.exception(
            "Daily intraday sync task failed after %s retries", self.max_retries
        )
        return {
            "status": "error",
            "message": str(exc),
            "timestamp": timezone.now().isoformat(),
        }


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_single_stock_intraday(self, symbol, interval="1m", period="1d"):
    """
    Celery task to sync intraday data for a single stock.

    Args:
        symbol: Stock symbol to sync
        interval: Time interval for intraday data
        period: Data period to fetch

    Returns:
        Dict with sync results
    """
    try:
        logger.info("Starting intraday sync for %s", symbol)

        # Get the stock object
        try:
            stock = Stock.objects.get(symbol=symbol, is_active=True)
        except Stock.DoesNotExist:
            logger.exception("Stock %s not found or not active", symbol)
            return {
                "status": "error",
                "message": f"Stock {symbol} not found or not active",
                "symbol": symbol,
            }

        # Fetch intraday data
        data = yahoo_finance_service.get_intraday_data(
            symbol=symbol, interval=interval, period=period
        )

        if not data or not data.get("data"):
            logger.warning("No intraday data received for %s", symbol)
            return {
                "status": "warning",
                "message": f"No data received for {symbol}",
                "symbol": symbol,
            }

        # Save the data
        _save_intraday_data(stock, data, interval)

        logger.info(
            "Successfully synced %s data points for %s", len(data["data"]), symbol
        )
        return {
            "status": "success",
            "message": f"Synced {len(data['data'])} data points",
            "symbol": symbol,
            "data_points": len(data["data"]),
        }

    except Exception as exc:
        logger.exception("Intraday sync failed for %s", symbol)

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(
                "Retrying %s sync in %s seconds...", symbol, self.default_retry_delay
            )
            raise self.retry(exc=exc) from exc

        return {"status": "error", "message": str(exc), "symbol": symbol}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def execute_trading_bots(self, stock_symbol: str | None = None):
    """
    Celery task to execute trading bots for price updates.

    Args:
        stock_symbol: Optional specific stock symbol to process (if None, processes all)

    Returns:
        Dict with execution results
    """
    try:
        logger.info("Starting trading bot execution task")

        # Get all active bots
        active_bots = TradingBotConfig.objects.filter(is_active=True)

        if not active_bots.exists():
            logger.info("No active bots found")
            return {
                "status": "success",
                "message": "No active bots to execute",
                "bots_processed": 0,
            }

        results = {
            "status": "success",
            "bots_processed": 0,
            "trades_executed": 0,
            "errors": [],
        }

        # Process each active bot
        for bot_config in active_bots:
            try:
                # If stock_symbol is provided, only process if stock is in bot's assigned stocks
                if stock_symbol:
                    stock = Stock.objects.filter(symbol=stock_symbol).first()
                    if not stock or stock not in bot_config.assigned_stocks.all():
                        continue

                bot = TradingBot(bot_config)

                # Run analysis
                if stock_symbol:
                    stock = Stock.objects.get(symbol=stock_symbol)
                    analysis = bot.analyze_stock(stock)

                    # Execute trade if signal detected
                    if analysis["action"] in ["buy", "sell"]:
                        order = bot.execute_trade(stock, analysis["action"], analysis)
                        if order:
                            results["trades_executed"] += 1
                else:
                    # Analyze all assigned stocks
                    bot_results = bot.run_analysis()

                    # Execute trades for buy/sell signals
                    for buy_signal in bot_results.get("buy_signals", []):
                        try:
                            stock = Stock.objects.get(symbol=buy_signal["stock"])
                            analysis = bot.analyze_stock(stock)
                            if analysis["action"] == "buy":
                                order = bot.execute_trade(stock, "buy", analysis)
                                if order:
                                    results["trades_executed"] += 1
                        except Exception as e:
                            logger.exception(
                                f"Error executing buy trade for {buy_signal['stock']}"
                            )
                            results["errors"].append(
                                f"Buy trade error for {buy_signal['stock']}: {e!s}"
                            )

                    for sell_signal in bot_results.get("sell_signals", []):
                        try:
                            stock = Stock.objects.get(symbol=sell_signal["stock"])
                            analysis = bot.analyze_stock(stock)
                            if analysis["action"] == "sell":
                                order = bot.execute_trade(stock, "sell", analysis)
                                if order:
                                    results["trades_executed"] += 1
                        except Exception as e:
                            logger.exception(
                                f"Error executing sell trade for {sell_signal['stock']}"
                            )
                            results["errors"].append(
                                f"Sell trade error for {sell_signal['stock']}: {e!s}"
                            )

                results["bots_processed"] += 1

            except Exception as exc:
                logger.exception(f"Error processing bot {bot_config.name}")
                results["errors"].append(f"Bot {bot_config.name}: {exc!s}")
                continue

        logger.info(
            f"Trading bot execution completed: {results['bots_processed']} bots processed, "
            f"{results['trades_executed']} trades executed"
        )

        return results

    except Exception as exc:
        logger.exception("Trading bot execution task failed")

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task in {self.default_retry_delay} seconds...")
            raise self.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": str(exc),
            "timestamp": timezone.now().isoformat(),
        }


def _save_intraday_data(stock, data, interval):
    """Helper function to save intraday data to the database."""
    try:
        with transaction.atomic():
            # Delete existing data for today to avoid duplicates
            today = timezone.now().date()
            IntradayPrice.objects.filter(
                stock=stock, interval=interval, timestamp__date=today
            ).delete()

            # Create new intraday price records
            intraday_prices = []
            for point in data["data"]:
                # Parse datetime
                dt = timezone.make_aware(
                    datetime.strptime(point["datetime"], "%Y-%m-%d %H:%M:%S")  # noqa: DTZ007
                )

                intraday_prices.append(
                    IntradayPrice(
                        stock=stock,
                        timestamp=dt,
                        interval=interval,
                        open_price=point["open"],
                        high_price=point["high"],
                        low_price=point["low"],
                        close_price=point["close"],
                        volume=point["volume"],
                        session_type="regular",  # Default to regular market hours
                    )
                )

            # Bulk create for efficiency
            if intraday_prices:
                IntradayPrice.objects.bulk_create(intraday_prices, batch_size=1000)
                logger.info(
                    "Saved %s intraday price records for %s",
                    len(intraday_prices),
                    stock.symbol,
                )

    except Exception:
        logger.exception("Error saving intraday data for %s", stock.symbol)
        raise


@shared_task(bind=True, max_retries=3, default_retry_delay=600)
def sync_historical_data(self, symbols=None, period="1y", interval="1d", force=False):
    """
    Celery task to sync historical stock data for all active stocks.

    Args:
        symbols: Optional list of symbols to sync. If None, syncs all active stocks.
        period: Period of historical data to fetch (default: '1y')
        interval: Data interval (default: '1d' for daily)
        force: Force update even if historical data already exists

    Returns:
        Dict with sync results
    """
    try:
        logger.info(
            f"Starting historical data sync task - period: {period}, interval: {interval}"
        )

        # Use the management command for the actual sync
        cmd_args = [
            "--period",
            period,
            "--interval",
            interval,
            "--batch-size",
            "5",
            "--delay",
            "1.0",
        ]

        if symbols:
            cmd_args.extend(["--symbols", ",".join(symbols)])

        if force:
            cmd_args.append("--force")

        # Call the management command
        call_command("sync_historical_data", *cmd_args)

        logger.info("Historical data sync task completed successfully")
        return {
            "status": "success",
            "message": "Historical data sync completed",
            "period": period,
            "interval": interval,
            "timestamp": timezone.now().isoformat(),
        }

    except Exception as exc:
        logger.exception("Historical data sync task failed")

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info("Retrying task in %s seconds...", self.default_retry_delay)
            raise self.retry(exc=exc) from exc

        # If we've exceeded max retries, log the failure
        logger.exception(
            f"Historical data sync task failed after {self.max_retries} retries"
        )
        return {
            "status": "error",
            "message": str(exc),
            "timestamp": timezone.now().isoformat(),
        }


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def start_market_tick_recording(self):
    """
    Start recording tick price changes for all active stocks during market hours.
    This task runs at market open and continuously records tick data until market close.
    """
    try:
        logger.info("Starting market tick recording task")

        # Check if market is open
        if not is_market_open():
            logger.warning("Market is not open, skipping tick recording")
            return {
                "status": "skipped",
                "message": "Market is not open",
                "timestamp": timezone.now().isoformat(),
            }

        # Get all active stocks
        active_stocks = Stock.objects.filter(is_active=True)
        symbols = [stock.symbol for stock in active_stocks]

        if not symbols:
            logger.warning("No active stocks found for tick recording")
            return {
                "status": "skipped",
                "message": "No active stocks found",
                "timestamp": timezone.now().isoformat(),
            }

        logger.info(f"Starting tick recording for {len(symbols)} stocks")

        # Schedule the continuous tick recording task
        # record_tick_data.delay(symbols)   # noqa: ERA001
        record_tick_data(symbols)

        return {
            "status": "success",
            "message": f"Started tick recording for {len(symbols)} stocks",
            "symbols_count": len(symbols),
            "timestamp": timezone.now().isoformat(),
        }

    except Exception as exc:
        logger.exception("Error starting market tick recording")

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info("Retrying task in %s seconds...", self.default_retry_delay)
            raise self.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": str(exc),
            "timestamp": timezone.now().isoformat(),
        }


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def record_tick_data(self, symbols):
    """
    Continuously record tick data for given symbols during market hours.
    This task runs every 30 seconds during market hours.
    """
    try:
        # Check if market is still open
        if not is_market_open():
            logger.info("Market closed, stopping tick recording")
            return {
                "status": "completed",
                "message": "Market closed, tick recording stopped",
                "timestamp": timezone.now().isoformat(),
            }

        logger.info(f"Recording tick data for {len(symbols)} symbols")

        successful_updates = 0
        failed_updates = 0

        # Process symbols in batches to avoid overwhelming the API
        batch_size = 10
        for i in range(0, len(symbols), batch_size):
            batch_symbols = symbols[i : i + batch_size]

            for symbol in batch_symbols:
                try:
                    # Get current quote data
                    quote_data = yahoo_finance_service.get_current_quote(symbol)

                    if quote_data:
                        # Get the stock object
                        stock = Stock.objects.get(symbol=symbol, is_active=True)

                        # Create tick record
                        StockTick.objects.create(
                            stock=stock,
                            price=quote_data.get("price", 0),
                            volume=quote_data.get("volume", 0),
                            bid_price=quote_data.get("bid", None),
                            ask_price=quote_data.get("ask", None),
                            bid_size=quote_data.get("bid_size", None),
                            ask_size=quote_data.get("ask_size", None),
                            timestamp=timezone.now(),
                            is_market_hours=True,
                        )
                        successful_updates += 1
                    else:
                        failed_updates += 1

                except Stock.DoesNotExist:
                    logger.warning("Stock %s not found in database", symbol)
                    failed_updates += 1
                except Exception:
                    logger.exception("Error recording tick for %s", symbol)
                    failed_updates += 1

            # Small delay between batches
            time.sleep(0.1)

        # Schedule next tick recording if market is still open
        if is_market_open():
            # Schedule next run in 30 seconds
            record_tick_data.apply_async(args=[symbols], countdown=30)

        return {
            "status": "success",
            "successful_updates": successful_updates,
            "failed_updates": failed_updates,
            "next_run_scheduled": is_market_open(),
            "timestamp": timezone.now().isoformat(),
        }

    except Exception as exc:
        logger.exception("Error in tick recording")

        # Retry the task if we haven't exceeded max retries and market is still open
        if self.request.retries < self.max_retries and is_market_open():
            logger.info(
                "Retrying tick recording in %s seconds...", self.default_retry_delay
            )
            raise self.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": str(exc),
            "timestamp": timezone.now().isoformat(),
        }


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_daily_stock_prices(self):
    """
    Sync daily stock prices for all active stocks at market close.
    This task runs after market close to get the final daily prices.
    """
    try:
        logger.info("Starting daily stock prices sync at market close")

        # Get all active stocks
        active_stocks = Stock.objects.filter(is_active=True)

        if not active_stocks.exists():
            logger.warning("No active stocks found for daily price sync")
            return {
                "status": "skipped",
                "message": "No active stocks found",
                "timestamp": timezone.now().isoformat(),
            }

        successful_updates = 0
        failed_updates = 0
        today = timezone.now().date()

        # Process stocks in batches
        batch_size = 10
        stocks_list = list(active_stocks)

        for i in range(0, len(stocks_list), batch_size):
            batch_stocks = stocks_list[i : i + batch_size]

            for stock in batch_stocks:
                try:
                    # Get daily price data for today
                    price_data = yahoo_finance_service.get_daily_price(
                        stock.symbol, period="1d"
                    )

                    if price_data and len(price_data) > 0:
                        latest_price = price_data[-1]  # Get the most recent price

                        # Create or update StockPrice record for today
                        _stock_price, created = StockPrice.objects.update_or_create(
                            stock=stock,
                            date=today,
                            interval="1d",
                            defaults={
                                "open_price": latest_price.get("open", 0),
                                "high_price": latest_price.get("high", 0),
                                "low_price": latest_price.get("low", 0),
                                "close_price": latest_price.get("close", 0),
                                "adjusted_close": latest_price.get("adj_close", None),
                                "volume": latest_price.get("volume", 0),
                            },
                        )

                        successful_updates += 1
                        action = "Created" if created else "Updated"
                        logger.info("%s daily price for %s", action, stock.symbol)

                    else:
                        logger.warning("No price data found for %s", stock.symbol)
                        failed_updates += 1

                except Exception:
                    logger.exception("Error syncing daily price for %s", stock.symbol)
                    failed_updates += 1

            # Small delay between batches to respect API limits
            time.sleep(1.0)

        logger.info(
            "Daily price sync completed: %s successful, %s failed",
            successful_updates,
            failed_updates,
        )

        return {
            "status": "success",
            "successful_updates": successful_updates,
            "failed_updates": failed_updates,
            "total_stocks": len(stocks_list),
            "date": today.isoformat(),
            "timestamp": timezone.now().isoformat(),
        }

    except Exception as exc:
        logger.exception("Error in daily stock prices sync")

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(
                "Retrying daily price sync in %s seconds...", self.default_retry_delay
            )
            raise self.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": str(exc),
            "timestamp": timezone.now().isoformat(),
        }


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_daily_intraday_prices(self):
    """
    Sync intraday prices for the current trading day after market close.
    This task runs after market close to capture detailed intraday data for the day.
    """
    try:
        logger.info("Starting daily intraday prices sync after market close")

        # Get all active stocks
        active_stocks = Stock.objects.filter(is_active=True)

        if not active_stocks.exists():
            logger.warning("No active stocks found for daily intraday sync")
            return {
                "status": "skipped",
                "message": "No active stocks found",
                "timestamp": timezone.now().isoformat(),
            }

        successful_updates = 0
        failed_updates = 0
        total_records_created = 0

        # Process stocks in batches
        batch_size = 5  # Smaller batch size for intraday data
        stocks_list = list(active_stocks)

        for i in range(0, len(stocks_list), batch_size):
            batch_stocks = stocks_list[i : i + batch_size]

            for stock in batch_stocks:
                try:
                    # Get intraday data for the current day (1-minute intervals)
                    intraday_data = yahoo_finance_service.get_intraday_data(
                        stock.symbol, interval="1m", period="1d"
                    )

                    if intraday_data and intraday_data.get("data"):
                        records_created = 0

                        for price_point in intraday_data["data"]:
                            try:
                                # Parse the datetime
                                timestamp = timezone.make_aware(
                                    datetime.strptime(  # noqa: DTZ007
                                        price_point["datetime"], "%Y-%m-%d %H:%M:%S"
                                    )
                                )

                                # Create or update IntradayPrice record
                                _intraday_price, created = (
                                    IntradayPrice.objects.update_or_create(
                                        stock=stock,
                                        timestamp=timestamp,
                                        interval="1m",
                                        defaults={
                                            "open_price": price_point["open"],
                                            "high_price": price_point["high"],
                                            "low_price": price_point["low"],
                                            "close_price": price_point["close"],
                                            "volume": price_point["volume"],
                                            "session_type": "regular",  # Assume regular session for now
                                            "trade_count": 0,  # Yahoo doesn't provide this
                                        },
                                    )
                                )

                                if created:
                                    records_created += 1

                            except Exception:
                                logger.exception(
                                    "Error processing intraday point for %s",
                                    stock.symbol,
                                )
                                continue

                        successful_updates += 1
                        total_records_created += records_created
                        logger.info(
                            "Synced %s intraday records for %s",
                            records_created,
                            stock.symbol,
                        )

                    else:
                        logger.warning("No intraday data found for %s", stock.symbol)
                        failed_updates += 1

                except Exception:
                    logger.exception("Error syncing intraday data for %s", stock.symbol)
                    failed_updates += 1

            # Delay between batches to respect API limits
            time.sleep(2.0)  # Longer delay for intraday data

        logger.info(
            "Daily intraday sync completed: %s stocks successful, %s failed, %s total records created",
            successful_updates,
            failed_updates,
            total_records_created,
        )

        return {
            "status": "success",
            "successful_updates": successful_updates,
            "failed_updates": failed_updates,
            "total_stocks": len(stocks_list),
            "total_records_created": total_records_created,
            "timestamp": timezone.now().isoformat(),
        }

    except Exception as exc:
        logger.exception("Error in daily intraday prices sync")

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(
                "Retrying daily intraday sync in %s seconds...",
                self.default_retry_delay,
            )
            raise self.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": str(exc),
            "timestamp": timezone.now().isoformat(),
        }


def is_market_open():
    """
    Check if the US stock market is currently open.
    Market hours: 9:30 AM - 4:00 PM EST, Monday-Friday
    """
    try:
        # Get current time in Eastern timezone
        eastern = pytz.timezone("America/New_York")
        now = timezone.now().astimezone(eastern)

        # Check if it's a weekday (Monday=0, Sunday=6)
        if now.weekday() > 4:  # Saturday=5, Sunday=6
            return False

        # Check if it's within market hours (9:30 AM - 4:00 PM EST)
        market_open = dt_time(9, 30)  # 9:30 AM
        market_close = dt_time(16, 0)  # 4:00 PM
        current_time = now.time()

        is_open = market_open <= current_time <= market_close
    except Exception:
        logger.exception("Error checking market hours")
        return False
    else:
        return is_open


@shared_task(bind=True, max_retries=3, default_retry_delay=600)
def run_bot_simulation(self, simulation_run_id: str):
    """
    Celery task to run bot simulation.

    Args:
        simulation_run_id: UUID of BotSimulationRun instance

    Returns:
        Dict with execution results
    """
    from bot_simulations.models import BotSimulationRun
    from bot_simulations.simulation.data_splitter import DataSplitter
    from bot_simulations.simulation.engine import SimulationEngine
    from bot_simulations.simulation.signal_analyzer import SignalProductivityAnalyzer
    from bot_simulations.simulation.validator import ValidationComparator

    try:
        logger.info(f"Starting bot simulation task: {simulation_run_id}")

        # Get simulation run
        try:
            simulation_run = BotSimulationRun.objects.get(id=simulation_run_id)
        except BotSimulationRun.DoesNotExist:
            logger.exception("Simulation run not found")
            return {
                "status": "error",
                "message": f"Simulation run {simulation_run_id} not found",
            }

        # Check if already running or completed
        if simulation_run.status in ["running", "completed"]:
            logger.warning(
                f"Simulation {simulation_run_id} already {simulation_run.status}"
            )
            return {
                "status": simulation_run.status,
                "message": f"Simulation already {simulation_run.status}",
            }

        # Create simulation engine
        engine = SimulationEngine(simulation_run)

        # Run simulation
        result = engine.run()

        # After simulation, run validation and signal analysis
        if result.get("status") == "completed":
            logger.info("Running validation and signal analysis...")

            # Get validation data
            data_splitter = DataSplitter(float(simulation_run.data_split_ratio))
            stocks = list(simulation_run.stocks.all())
            split_result = data_splitter.split_data(stocks)

            # Run validation and analysis for each bot
            for bot_config in simulation_run.bot_configs.all():
                try:
                    # Validation comparison
                    validator = ValidationComparator(
                        bot_config, split_result["validation_data"]
                    )
                    validator.compare()

                    # Signal productivity analysis
                    analyzer = SignalProductivityAnalyzer(bot_config)
                    signal_result = analyzer.analyze()

                    # Store results (will be created by engine or here)
                    from bot_simulations.models import BotSimulationResult

                    result_obj, created = BotSimulationResult.objects.get_or_create(
                        simulation_config=bot_config,
                        defaults={
                            "total_profit": Decimal("0.00"),
                            "total_trades": 0,
                            "win_rate": Decimal("0.00"),
                            "signal_productivity": signal_result.get(
                                "signal_productivity", {}
                            ),
                        },
                    )

                    if not created:
                        result_obj.signal_productivity = signal_result.get(
                            "signal_productivity", {}
                        )
                        result_obj.save()

                except Exception:
                    logger.exception("Error analyzing bot")
                    continue

        logger.info(f"Bot simulation task completed: {simulation_run_id}")
        return {
            "status": "success",
            "simulation_run_id": simulation_run_id,
            "result": result,
        }

    except Exception as exc:
        logger.exception(f"Bot simulation task failed: {simulation_run_id}")

        # Update simulation run status
        try:
            simulation_run = BotSimulationRun.objects.get(id=simulation_run_id)
            simulation_run.status = "failed"
            simulation_run.error_message = str(exc)
            simulation_run.save()
        except (ValueError, TypeError, AttributeError) as save_error:
            logger.warning("Failed to save error message", exc_info=save_error)

        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task in {self.default_retry_delay} seconds...")
            raise self.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": str(exc),
            "simulation_run_id": simulation_run_id,
        }
