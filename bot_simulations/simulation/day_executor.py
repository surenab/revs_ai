"""
Day-by-day executor for trading simulation.
"""

import logging
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.utils import timezone

from bot_simulations.models import BotSimulationConfig, BotSimulationTick
from stocks.models import Stock, TradingBotConfig

from .simulation_bot import SimulationBot

logger = logging.getLogger(__name__)


class DayExecutor:
    """Executes day-by-day trading simulation for bot configurations."""

    def __init__(
        self,
        bot_config: TradingBotConfig,
        price_data: dict[str, list[dict]],
        initial_cash: Decimal = Decimal("10000.00"),
        initial_portfolio: dict[str, Decimal] | None = None,
        training_mode: bool = False,
        historical_start_date: date | None = None,
        testing_start_date: date | None = None,
        daily_execution_mode: bool = False,
        bot_sim_config: BotSimulationConfig | None = None,
    ):
        """
        Initialize day executor.

        Args:
            bot_config: TradingBotConfig instance
            price_data: Dictionary mapping stock symbols to tick data lists (can include full history)
            initial_cash: Starting cash balance (for fund-based simulations)
            initial_portfolio: Initial portfolio positions {symbol: quantity} (for portfolio-based simulations)
            training_mode: If True, only analyze patterns/indicators without executing trades
            historical_start_date: Start date for historical data (bot can use all data from here)
            testing_start_date: Start date for testing (only execute trades from here)
            daily_execution_mode: If True, each day starts fresh with initial cash
            bot_sim_config: BotSimulationConfig instance for progress tracking and tick storage
        """
        self.bot_config = bot_config
        self.price_data = price_data
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.portfolio: dict[
            str, dict[str, Any]
        ] = {}  # {symbol: {quantity, avg_price, total_cost, ...}}
        self.trades: list[dict[str, Any]] = []
        self.daily_results: list[dict[str, Any]] = []
        self.training_mode = training_mode
        self.historical_start_date = historical_start_date
        self.testing_start_date = testing_start_date
        self.daily_execution_mode = daily_execution_mode
        self.bot_sim_config = bot_sim_config
        self.cumulative_profit = Decimal(
            "0.00"
        )  # Track cumulative profit across all ticks

        # Initialize portfolio if provided (portfolio-based simulation)
        if initial_portfolio:
            self._initialize_portfolio(initial_portfolio, price_data)

    def execute_all_days(self, start_date: date, end_date: date) -> dict[str, Any]:
        """
        Execute simulation for all days in the date range.

        Args:
            start_date: Start date for simulation
            end_date: End date for simulation

        Returns:
            Dictionary with execution results
        """
        # Get unique dates from price data
        all_dates = set()
        for stock_data in self.price_data.values():
            for tick in stock_data:
                if tick.get("date"):
                    all_dates.add(date.fromisoformat(tick["date"]))

        # Filter dates in range and sort
        dates_in_range = sorted([d for d in all_dates if start_date <= d <= end_date])

        phase_type = "Training" if self.training_mode else "Testing"
        logger.info(
            f"{phase_type} phase: Executing simulation for {len(dates_in_range)} days "
            f"({start_date} to {end_date})"
        )

        for day_idx, day_date in enumerate(dates_in_range):
            try:
                if (
                    (day_idx + 1) % 10 == 0
                    or day_idx == 0
                    or day_idx == len(dates_in_range) - 1
                ):
                    logger.debug(
                        f"  Processing day {day_idx + 1}/{len(dates_in_range)}: {day_date}"
                    )
                day_result = self.execute_day(day_date)
                self.daily_results.append(day_result)

                # Log summary every 10 days or on last day
                if (day_idx + 1) % 10 == 0 or day_idx == len(dates_in_range) - 1:
                    daily_profit = day_result.get("performance_metrics", {}).get(
                        "daily_profit", 0
                    )
                    trades_today = day_result.get("performance_metrics", {}).get(
                        "trades_today", 0
                    )
                    total_value = day_result.get("performance_metrics", {}).get(
                        "total_value", 0
                    )
                    logger.debug(
                        f"    Day {day_date}: Profit=${daily_profit:.2f}, Trades={trades_today}, "
                        f"Total Value=${total_value:.2f}"
                    )
            except Exception as e:
                logger.exception(f"Error executing day {day_date}: {e}")
                continue

        return {
            "total_days": len(dates_in_range),
            "days_executed": len(self.daily_results),
            "final_cash": float(self.cash),
            "final_portfolio_value": self._calculate_portfolio_value(day_date),
            "total_trades": len(self.trades),
            "daily_results": self.daily_results,
        }

    def execute_day(self, day_date: date) -> dict[str, Any]:
        """
        Execute simulation for a single day.

        Args:
            day_date: Date to execute

        Returns:
            Dictionary with day execution results
        """
        # Get price data up to this day
        price_data_by_stock = self._get_price_data_up_to_date(day_date)

        # Get current prices for this day
        current_prices = self._get_current_prices(day_date)

        # Run bot analysis for each assigned stock
        decisions = {}
        signal_contributions = {}

        # Create simulation bot with aggregated price data up to current day
        # Convert price_data_by_stock to the format SimulationBot expects
        aggregated_historical_data = {}
        for stock_symbol, daily_candles in price_data_by_stock.items():
            # Convert to format with 'date' as string for easy filtering
            aggregated_historical_data[stock_symbol] = [
                {
                    **candle,
                    "date": candle.get("date")
                    if isinstance(candle.get("date"), str)
                    else candle.get("date").isoformat()
                    if hasattr(candle.get("date"), "isoformat")
                    else str(candle.get("date")),
                }
                for candle in daily_candles
            ]

        bot = SimulationBot(
            self.bot_config,
            aggregated_historical_data,
            day_date.isoformat(),
        )

        # Get assigned stocks - handle both DB relation and cached list
        if hasattr(self.bot_config, "_assigned_stocks_cache"):
            assigned_stocks = self.bot_config._assigned_stocks_cache
        else:
            assigned_stocks = list(self.bot_config.assigned_stocks.all())

        for stock in assigned_stocks:
            stock_symbol = stock.symbol if hasattr(stock, "symbol") else stock
            try:
                if isinstance(stock, Stock):
                    stock_obj = stock
                else:
                    stock_obj = Stock.objects.get(symbol=stock_symbol)
                price_data = price_data_by_stock.get(stock_symbol, [])

                if not price_data:
                    logger.debug(
                        f"    {stock_symbol}: No price data available, skipping"
                    )
                    decisions[stock_symbol] = {
                        "action": "skip",
                        "reason": "No price data",
                    }
                    continue

                # Run analysis (for daily execution, use current time)
                logger.debug(
                    f"    {stock_symbol}: Running analysis (price data: {len(price_data)} candles)"
                )
                # For daily execution, use day date at noon as timestamp
                from datetime import datetime as dt

                analysis_timestamp = dt.combine(
                    day_date, dt.min.time().replace(hour=12)
                )
                analysis = bot.analyze_stock(stock_obj, timestamp=analysis_timestamp)

                decision = {
                    "action": analysis.get("action", "skip"),
                    "reason": analysis.get("reason", ""),
                    "confidence": float(
                        analysis.get("aggregated_signal", {}).get("confidence", 0.0)
                    ),
                    "risk_score": float(analysis.get("risk_score", 0.0))
                    if analysis.get("risk_score")
                    else None,
                    "position_size": analysis.get("position_size"),
                }

                decisions[stock_symbol] = decision

                # Extract signal contributions
                aggregated_signal = analysis.get("aggregated_signal", {})
                indicators = analysis.get("indicators", {})
                patterns = analysis.get("patterns", [])
                ml_signals = analysis.get("ml_signals", [])

                signal_contributions[stock_symbol] = {
                    "ml_signals": ml_signals,
                    "indicator_signals": len(indicators),
                    "pattern_signals": len(patterns),
                    "social_signals": analysis.get("social_signals"),
                    "news_signals": analysis.get("news_signals"),
                    "aggregated_confidence": aggregated_signal.get("confidence", 0.0),
                    "action_scores": aggregated_signal.get("action_scores", {}),
                }

                # Log decision details
                action = decision.get("action", "skip")
                confidence = decision.get("confidence", 0.0)
                logger.debug(
                    f"    {stock_symbol}: Decision={action}, Confidence={confidence:.2f}, "
                    f"Indicators={len(indicators)}, Patterns={len(patterns)}, ML Signals={len(ml_signals)}"
                )

                # Execute trade if needed (only in testing mode, not training mode)
                if not self.training_mode and decision["action"] in ["buy", "sell"]:
                    price = current_prices.get(stock_symbol)
                    logger.info(
                        f"    {stock_symbol}: Executing {action.upper()} at ${price:.2f} "
                        f"(confidence: {confidence:.2f})"
                    )
                    self._execute_trade(stock_symbol, decision, price)

            except Exception as e:
                logger.exception(f"Error processing {stock_symbol} on {day_date}: {e}")
                decisions[stock_symbol] = {"action": "error", "reason": str(e)}

        # Calculate daily performance
        portfolio_value = self._calculate_portfolio_value(day_date)
        daily_profit = (self.cash + portfolio_value) - self.initial_cash

        return {
            "date": day_date.isoformat(),
            "decisions": decisions,
            "actual_prices": current_prices,
            "signal_contributions": signal_contributions,
            "performance_metrics": {
                "cash": float(self.cash),
                "portfolio_value": float(portfolio_value),
                "total_value": float(self.cash + portfolio_value),
                "daily_profit": float(daily_profit),
                "trades_today": len(
                    [t for t in self.trades if t["date"] == day_date.isoformat()]
                ),
            },
        }

    def _get_price_data_up_to_date(self, current_date: date) -> dict[str, list[dict]]:
        """Get aggregated price data up to current date."""
        price_data_by_stock = {}

        for stock_symbol, tick_data in self.price_data.items():
            # Filter ticks up to current date
            ticks_up_to_date = [
                tick
                for tick in tick_data
                if tick.get("date")
                and (
                    date.fromisoformat(tick["date"])
                    if isinstance(tick["date"], str)
                    else tick["date"]
                )
                <= current_date
            ]

            if not ticks_up_to_date:
                continue

            # Aggregate to daily candles
            daily_candles = self._aggregate_to_daily(ticks_up_to_date, stock_symbol)
            price_data_by_stock[stock_symbol] = daily_candles

        return price_data_by_stock

    def _aggregate_to_daily(self, tick_data: list[dict], symbol: str) -> list[dict]:
        """Aggregate tick data to daily OHLCV candles."""
        candles = defaultdict(
            lambda: {
                "open": None,
                "high": None,
                "low": None,
                "close": None,
                "volume": 0,
                "date": None,
            }
        )

        for tick in tick_data:
            if not tick.get("date") or not tick.get("price"):
                continue

            tick_date = tick["date"]
            price = tick["price"]

            candle = candles[tick_date]

            if candle["open"] is None:
                candle["open"] = price
                candle["date"] = tick_date

            if candle["high"] is None or price > candle["high"]:
                candle["high"] = price
            if candle["low"] is None or price < candle["low"]:
                candle["low"] = price

            candle["close"] = price
            candle["volume"] += tick.get("volume", 0)

        # Convert to expected format
        return [
            {
                "symbol": symbol,
                "open_price": Decimal(str(candle["open"])),
                "high_price": Decimal(str(candle["high"])),
                "low_price": Decimal(str(candle["low"])),
                "close_price": Decimal(str(candle["close"])),
                "volume": candle["volume"],
                "date": candle["date"],
                "_data_source": "tick",
            }
            for candle_key in sorted(candles.keys())
            for candle in [candles[candle_key]]
            if candle["open"] is not None
        ]

    def _get_current_prices(self, day_date: date) -> dict[str, float]:
        """Get current prices for all stocks on given date."""
        prices = {}

        for stock_symbol, tick_data in self.price_data.items():
            # Get last tick for this date
            day_ticks = [
                tick for tick in tick_data if tick.get("date") == day_date.isoformat()
            ]

            if day_ticks:
                # Use last tick of the day
                last_tick = sorted(day_ticks, key=lambda t: t.get("timestamp", ""))[-1]
                prices[stock_symbol] = last_tick.get("price", 0.0)

        return prices

    def _execute_trade(
        self, stock_symbol: str, decision: dict[str, Any], current_price: float | None
    ):
        """Execute a trade based on decision."""
        if not current_price:
            logger.warning(
                f"    {stock_symbol}: Cannot execute trade - no current price"
            )
            return

        current_price_decimal = Decimal(str(current_price))
        action = decision["action"]
        position_size = decision.get("position_size")

        logger.debug(
            f"    {stock_symbol}: Trade details - Action: {action}, "
            f"Price: ${current_price:.2f}, Position Size: {position_size}"
        )

        if action == "buy" and position_size:
            # Check if we have enough cash
            cost = current_price_decimal * Decimal(str(position_size))
            if self.cash >= cost:
                self.cash -= cost
                if stock_symbol not in self.portfolio:
                    self.portfolio[stock_symbol] = {
                        "quantity": Decimal(0),
                        "avg_price": Decimal(0),
                        "total_cost": Decimal(0),
                    }

                # Update portfolio
                portfolio = self.portfolio[stock_symbol]
                total_quantity = portfolio["quantity"] + Decimal(str(position_size))
                total_cost = portfolio["total_cost"] + cost
                portfolio["quantity"] = total_quantity
                portfolio["total_cost"] = total_cost
                portfolio["avg_price"] = (
                    total_cost / total_quantity if total_quantity > 0 else Decimal(0)
                )

                logger.info(
                    f"    {stock_symbol}: BUY executed - {position_size} shares @ ${current_price:.2f} = ${cost:.2f}, "
                    f"Cash remaining: ${self.cash:.2f}, Portfolio: {float(total_quantity):.2f} shares @ ${float(portfolio['avg_price']):.2f} avg"
                )

                self.trades.append(
                    {
                        "date": timezone.now().date().isoformat(),
                        "stock": stock_symbol,
                        "action": "buy",
                        "quantity": float(position_size),
                        "price": float(current_price),
                        "cost": float(cost),
                    }
                )
            else:
                logger.warning(
                    f"    {stock_symbol}: BUY failed - Insufficient cash. Need ${cost:.2f}, have ${self.cash:.2f}"
                )

        elif action == "sell":
            # Check if we have position
            if stock_symbol in self.portfolio:
                portfolio = self.portfolio[stock_symbol]
                quantity_to_sell = portfolio["quantity"]  # Sell all
                if quantity_to_sell > 0:
                    revenue = current_price_decimal * quantity_to_sell
                    avg_price = portfolio["avg_price"]
                    profit = revenue - (avg_price * quantity_to_sell)
                    profit_pct = (
                        ((current_price_decimal - avg_price) / avg_price * 100)
                        if avg_price > 0
                        else 0
                    )

                    logger.info(
                        f"    {stock_symbol}: SELL executed - {float(quantity_to_sell):.2f} shares @ ${current_price:.2f} = ${revenue:.2f}, "
                        f"Avg cost: ${avg_price:.2f}, Profit: ${profit:.2f} ({profit_pct:.2f}%), "
                        f"Cash after: ${(self.cash + revenue):.2f}"
                    )

                    self.cash += revenue

                    self.trades.append(
                        {
                            "date": timezone.now().date().isoformat(),
                            "stock": stock_symbol,
                            "action": "sell",
                            "quantity": float(quantity_to_sell),
                            "price": float(current_price),
                            "revenue": float(revenue),
                            "profit": float(profit),
                        }
                    )

                    # Remove from portfolio
                    del self.portfolio[stock_symbol]
            else:
                logger.warning(f"    {stock_symbol}: SELL failed - No position to sell")

    def _initialize_portfolio(
        self, initial_portfolio: dict[str, Decimal], price_data: dict[str, list[dict]]
    ):
        """
        Initialize portfolio with existing positions.
        Uses the first available price for each stock to calculate initial portfolio value.

        Args:
            initial_portfolio: Dictionary mapping stock symbols to quantities
            price_data: Price data to get initial prices from
        """
        from stocks.models import Stock

        for stock_symbol, quantity in initial_portfolio.items():
            if quantity <= 0:
                continue

            # Get initial price from price data (use first available price)
            initial_price = None
            if price_data.get(stock_symbol):
                # Sort by timestamp and get first price
                sorted_ticks = sorted(
                    price_data[stock_symbol],
                    key=lambda x: x.get("timestamp", ""),
                )
                if sorted_ticks:
                    initial_price = Decimal(str(sorted_ticks[0].get("price", 0)))

            # If no price data, try to get from Stock model
            if initial_price is None or initial_price == 0:
                try:
                    stock = Stock.objects.get(symbol=stock_symbol)
                    # Try to get latest price from tick data
                    from stocks.models import StockTick

                    latest_tick = (
                        StockTick.objects.filter(stock=stock)
                        .order_by("-timestamp")
                        .first()
                    )
                    if latest_tick:
                        initial_price = Decimal(str(latest_tick.price))
                    else:
                        logger.warning(
                            f"No price data found for {stock_symbol}, using quantity only"
                        )
                        initial_price = Decimal("0.00")
                except Stock.DoesNotExist:
                    logger.warning(
                        f"Stock {stock_symbol} not found, skipping portfolio initialization"
                    )
                    continue

            # Initialize portfolio position
            total_cost = quantity * initial_price
            self.portfolio[stock_symbol] = {
                "quantity": Decimal(str(quantity)),
                "avg_price": initial_price,
                "total_cost": total_cost,
            }

            logger.info(
                f"Initialized portfolio position: {stock_symbol} - {quantity} shares @ ${initial_price:.2f} = ${total_cost:.2f}"
            )

    def _calculate_portfolio_value(self, current_date: date) -> Decimal:
        """Calculate current portfolio value."""
        total_value = Decimal(0)

        current_prices = self._get_current_prices(current_date)

        for stock_symbol, portfolio in self.portfolio.items():
            current_price = current_prices.get(stock_symbol, Decimal(0))
            if current_price:
                total_value += portfolio["quantity"] * Decimal(str(current_price))

        return total_value

    def execute_ticks(
        self, testing_start_date: date, testing_end_date: date
    ) -> dict[str, Any]:
        """
        Execute simulation tick-by-tick for testing phase.
        Bot has access to all historical data from historical_start_date to current tick.
        Only executes trades during testing period.

        Args:
            testing_start_date: Start date for testing (when to start executing trades)
            testing_end_date: End date for testing

        Returns:
            Dictionary with execution results
        """

        # Get all ticks in testing period, sorted by timestamp
        all_testing_ticks = []
        for stock_symbol, tick_data in self.price_data.items():
            for tick in tick_data:
                tick_date_str = tick.get("date")
                if not tick_date_str:
                    continue

                tick_date = (
                    date.fromisoformat(tick_date_str)
                    if isinstance(tick_date_str, str)
                    else tick_date_str
                )

                # Only include ticks in testing period
                if testing_start_date <= tick_date <= testing_end_date:
                    all_testing_ticks.append(
                        {
                            "stock_symbol": stock_symbol,
                            "tick": tick,
                            "date": tick_date,
                            "timestamp": tick.get("timestamp", ""),
                        }
                    )

        # Sort all ticks by timestamp
        all_testing_ticks.sort(key=lambda x: (x["date"].isoformat(), x["timestamp"]))

        logger.info(
            f"Testing phase: Processing {len(all_testing_ticks)} ticks "
            f"({testing_start_date} to {testing_end_date})"
        )

        tick_results = []
        processed_count = 0

        for tick_idx, tick_info in enumerate(all_testing_ticks):
            stock_symbol = tick_info["stock_symbol"]
            tick = tick_info["tick"]
            tick_date = tick_info["date"]
            current_price = tick.get("price")

            if not current_price:
                continue

            try:
                # Get all historical data up to this tick (including training data)
                historical_data = self._get_historical_data_up_to_tick(
                    stock_symbol, tick_date, tick_info["timestamp"]
                )

                # Create bot with historical data
                aggregated_historical_data = self._aggregate_ticks_to_daily(
                    historical_data
                )

                bot = SimulationBot(
                    self.bot_config,
                    {stock_symbol: aggregated_historical_data},
                    tick_date.isoformat(),
                )

                # Get stock object
                if hasattr(self.bot_config, "_assigned_stocks_cache"):
                    assigned_stocks = self.bot_config._assigned_stocks_cache
                else:
                    assigned_stocks = list(self.bot_config.assigned_stocks.all())

                stock_obj = next(
                    (s for s in assigned_stocks if s.symbol == stock_symbol), None
                )
                if not stock_obj:
                    continue

                # Parse tick timestamp for persistence tracking
                tick_timestamp_str = tick.get("timestamp", "")
                try:
                    if isinstance(tick_timestamp_str, str):
                        tick_timestamp = datetime.fromisoformat(tick_timestamp_str)
                    else:
                        tick_timestamp = tick_timestamp_str
                except (ValueError, TypeError, AttributeError):
                    # Fallback to tick date at noon if timestamp parsing fails
                    tick_timestamp = datetime.combine(
                        tick_date, datetime.min.time().replace(hour=12)
                    )

                # Run analysis on this tick with timestamp for persistence tracking
                analysis = bot.analyze_stock(stock_obj, timestamp=tick_timestamp)

                decision = {
                    "action": analysis.get("action", "skip"),
                    "reason": analysis.get("reason", ""),
                    "confidence": float(
                        analysis.get("aggregated_signal", {}).get("confidence", 0.0)
                    ),
                    "risk_score": float(analysis.get("risk_score", 0.0))
                    if analysis.get("risk_score")
                    else None,
                    "position_size": analysis.get("position_size"),
                }

                # Execute trade if needed
                trade_executed = False
                trade_profit = 0.0
                next_tick_price = None
                position_before = float(
                    self.portfolio.get(stock_symbol, {}).get("quantity", Decimal(0))
                )

                if decision["action"] in ["buy", "sell"]:
                    # Execute trade at current tick price
                    float(self.cash)
                    shares_before = position_before
                    self._execute_trade(stock_symbol, decision, current_price)
                    trade_executed = True

                    # Get next tick price to calculate profit/loss
                    if tick_idx + 1 < len(all_testing_ticks):
                        next_tick_info = all_testing_ticks[tick_idx + 1]
                        if next_tick_info["stock_symbol"] == stock_symbol:
                            next_tick_price = next_tick_info["tick"].get("price")

                            # Calculate profit/loss based on next tick price
                            if (
                                decision["action"] == "buy"
                                and next_tick_price
                                and shares_before == 0
                            ):
                                # Bought, check if next price is higher (profit) or lower (loss)
                                shares_bought = decision.get("position_size", 0)
                                if shares_bought > 0:
                                    price_change = next_tick_price - current_price
                                    trade_profit = price_change * shares_bought
                                    logger.debug(
                                        f"    {stock_symbol}: BUY profit calculation - "
                                        f"Bought @ ${current_price:.2f}, Next tick @ ${next_tick_price:.2f}, "
                                        f"Profit: ${trade_profit:.2f}"
                                    )
                            elif (
                                decision["action"] == "sell"
                                and next_tick_price
                                and shares_before > 0
                            ):
                                # Sold, check if next price is lower (good - we avoided loss) or higher (bad - we sold too early)
                                shares_sold = shares_before
                                price_change = (
                                    current_price - next_tick_price
                                )  # Positive if price went down (good)
                                trade_profit = price_change * shares_sold
                                logger.debug(
                                    f"    {stock_symbol}: SELL profit calculation - "
                                    f"Sold @ ${current_price:.2f}, Next tick @ ${next_tick_price:.2f}, "
                                    f"Profit: ${trade_profit:.2f}"
                                )

                # Store tick result
                tick_result = {
                    "timestamp": tick_info["timestamp"],
                    "date": tick_date.isoformat(),
                    "stock_symbol": stock_symbol,
                    "price": current_price,
                    "next_tick_price": next_tick_price,
                    "decision": decision,
                    "trade_executed": trade_executed,
                    "trade_profit": trade_profit,
                    "cash": float(self.cash),
                    "portfolio_value": float(
                        self._calculate_portfolio_value_at_price(
                            stock_symbol, current_price
                        )
                    ),
                }
                tick_results.append(tick_result)

                processed_count += 1
                if processed_count % 100 == 0:
                    logger.info(
                        f"  Processed {processed_count}/{len(all_testing_ticks)} ticks "
                        f"({processed_count / len(all_testing_ticks) * 100:.1f}%)"
                    )

            except Exception as e:
                logger.exception(
                    f"Error processing tick {tick_info['timestamp']} for {stock_symbol}: {e}"
                )
                continue

        # Calculate final portfolio value
        final_portfolio_value = self._calculate_portfolio_value(testing_end_date)

        return {
            "total_ticks": len(all_testing_ticks),
            "ticks_processed": processed_count,
            "final_cash": float(self.cash),
            "final_portfolio_value": float(final_portfolio_value),
            "total_trades": len(self.trades),
            "tick_results": tick_results,
        }

    def _get_historical_data_up_to_tick(
        self, stock_symbol: str, current_date: date, current_timestamp: str
    ) -> list[dict]:
        """Get all historical tick data up to and including current tick."""
        stock_ticks = self.price_data.get(stock_symbol, [])

        historical_ticks = []
        for tick in stock_ticks:
            tick_date_str = tick.get("date")
            if not tick_date_str:
                continue

            tick_date = (
                date.fromisoformat(tick_date_str)
                if isinstance(tick_date_str, str)
                else tick_date_str
            )

            tick_timestamp = tick.get("timestamp", "")

            # Include all ticks up to current tick
            # If same date, compare timestamps
            if tick_date < current_date or (
                tick_date == current_date and tick_timestamp <= current_timestamp
            ):
                historical_ticks.append(tick)

        return historical_ticks

    def _aggregate_ticks_to_daily(self, tick_data: list[dict]) -> list[dict]:
        """Aggregate tick data to daily OHLCV candles."""
        if not tick_data:
            return []

        candles = defaultdict(
            lambda: {
                "open": None,
                "high": None,
                "low": None,
                "close": None,
                "volume": 0,
                "date": None,
            }
        )

        for tick in tick_data:
            if not tick.get("date") or not tick.get("price"):
                continue

            tick_date = tick["date"]
            price = tick["price"]

            candle = candles[tick_date]

            if candle["open"] is None:
                candle["open"] = price
                candle["date"] = tick_date

            if candle["high"] is None or price > candle["high"]:
                candle["high"] = price
            if candle["low"] is None or price < candle["low"]:
                candle["low"] = price

            candle["close"] = price
            candle["volume"] += tick.get("volume", 0)

        # Convert to expected format
        stock_symbol = tick_data[0].get("stock_symbol", "") if tick_data else ""
        return [
            {
                "symbol": stock_symbol,
                "open_price": Decimal(str(candle["open"])),
                "high_price": Decimal(str(candle["high"])),
                "low_price": Decimal(str(candle["low"])),
                "close_price": Decimal(str(candle["close"])),
                "volume": candle["volume"],
                "date": candle["date"],
                "_data_source": "tick",
            }
            for candle_key in sorted(candles.keys())
            for candle in [candles[candle_key]]
            if candle["open"] is not None
        ]

    def _calculate_portfolio_value_at_price(
        self, stock_symbol: str, price: float
    ) -> Decimal:
        """Calculate portfolio value for a specific stock at given price."""
        if stock_symbol in self.portfolio:
            portfolio = self.portfolio[stock_symbol]
            return portfolio["quantity"] * Decimal(str(price))
        return Decimal(0)

    def execute_daily(
        self, execution_start_date: date, execution_end_date: date
    ) -> dict[str, Any]:
        """
        Execute simulation day-by-day where each day starts fresh with initial cash.
        Bot does NOT run before execution_start_date.
        For each day:
        - Reset to initial cash at start of day
        - Execute all ticks for that day (if any)
        - Calculate profit = (end of day total assets) - (start of day initial fund)
        - Store daily result (even if no tick data exists)

        Args:
            execution_start_date: Start date when bot should begin executing
            execution_end_date: End date when bot should stop executing

        Returns:
            Dictionary with execution results
        """
        from datetime import timedelta

        # Generate ALL dates in execution period (including weekends/holidays)
        dates_in_range = []
        current_date = execution_start_date
        while current_date <= execution_end_date:
            dates_in_range.append(current_date)
            current_date += timedelta(days=1)

        logger.info(
            f"Daily execution mode: Processing {len(dates_in_range)} days "
            f"({execution_start_date} to {execution_end_date})"
        )

        daily_results = []
        total_trades = 0
        all_processed_ticks = []  # Store all ticks for cumulative context

        for day_idx, day_date in enumerate(dates_in_range):
            try:
                # Update bot config progress
                if self.bot_sim_config:
                    self.bot_sim_config.current_date = day_date
                    self.bot_sim_config.current_tick_index = 0
                    progress = Decimal(str((day_idx / len(dates_in_range)) * 100))
                    self.bot_sim_config.progress_percentage = progress
                    self.bot_sim_config.status = "running"
                    self.bot_sim_config.save()

                logger.debug(
                    f"  Processing day {day_idx + 1}/{len(dates_in_range)}: {day_date}"
                )

                # Reset to initial cash at start of each day (for daily profit calculation)
                day_start_cash = self.initial_cash
                self.cash = day_start_cash
                self.portfolio = {}
                day_trades = []
                len(self.trades)  # Track trades before this day

                # Get all ticks for this day, sorted by timestamp
                day_ticks = []
                for stock_symbol, tick_data in self.price_data.items():
                    for tick in tick_data:
                        tick_date_str = tick.get("date")
                        if not tick_date_str:
                            continue
                        tick_date = (
                            date.fromisoformat(tick_date_str)
                            if isinstance(tick_date_str, str)
                            else tick_date_str
                        )
                        if tick_date == day_date:
                            day_ticks.append(
                                {
                                    "stock_symbol": stock_symbol,
                                    "tick": tick,
                                    "timestamp": tick.get("timestamp", ""),
                                }
                            )

                # Sort ticks by timestamp
                day_ticks.sort(key=lambda x: x["timestamp"])

                # Execute each tick for this day (if any ticks exist)
                decisions = {}
                signal_contributions = {}
                current_prices = {}
                day_tick_results = []  # Store tick results for this day

                if not day_ticks:
                    # No tick data for this day - still create a result with zero trades
                    logger.debug(f"    Day {day_date}: No tick data available")
                else:
                    logger.debug(
                        f"    Day {day_date}: Processing {len(day_ticks)} tick(s)"
                    )

                for tick_idx, tick_info in enumerate(day_ticks):
                    stock_symbol = tick_info["stock_symbol"]
                    tick = tick_info["tick"]
                    current_price = tick.get("price")

                    if not current_price:
                        continue

                    # Update bot config tick index
                    if self.bot_sim_config:
                        self.bot_sim_config.current_tick_index = tick_idx
                        self.bot_sim_config.save()

                    try:
                        # Get all historical data up to this tick
                        # This includes: training data + all previous days' ticks + all ticks up to current in this day
                        historical_data = self._get_historical_data_up_to_tick(
                            stock_symbol, day_date, tick_info["timestamp"]
                        )
                        # Also include all previously processed ticks from earlier days for cumulative context
                        # This ensures period data grows as simulation progresses
                        for prev_tick_result in all_processed_ticks:
                            if prev_tick_result.get("stock_symbol") == stock_symbol:
                                # Add previous tick to historical data for cumulative analysis
                                prev_tick = prev_tick_result.get("tick_data", {})
                                if prev_tick:
                                    historical_data.append(prev_tick)

                        # Create bot with historical data (aggregated to daily candles for analysis)
                        aggregated_historical_data = self._aggregate_ticks_to_daily(
                            historical_data
                        )

                        bot = SimulationBot(
                            self.bot_config,
                            {stock_symbol: aggregated_historical_data},
                            day_date.isoformat(),
                        )

                        # Get stock object
                        if hasattr(self.bot_config, "_assigned_stocks_cache"):
                            assigned_stocks = self.bot_config._assigned_stocks_cache
                        else:
                            assigned_stocks = list(
                                self.bot_config.assigned_stocks.all()
                            )

                        stock_obj = next(
                            (s for s in assigned_stocks if s.symbol == stock_symbol),
                            None,
                        )
                        if not stock_obj:
                            continue

                        # Parse tick timestamp for persistence tracking
                        tick_timestamp_str = tick_info.get("timestamp", "")
                        try:
                            if isinstance(tick_timestamp_str, str):
                                tick_timestamp = datetime.fromisoformat(
                                    tick_timestamp_str
                                )
                            else:
                                tick_timestamp = tick_timestamp_str
                        except (ValueError, TypeError, AttributeError):
                            # Fallback to day date at noon if timestamp parsing fails
                            tick_timestamp = datetime.combine(
                                day_date, datetime.min.time().replace(hour=12)
                            )

                        # Run full analysis on this tick with timestamp for persistence tracking
                        analysis = bot.analyze_stock(
                            stock_obj, timestamp=tick_timestamp
                        )

                        decision = {
                            "action": analysis.get("action", "skip"),
                            "reason": analysis.get("reason", ""),
                            "confidence": float(
                                analysis.get("aggregated_signal", {}).get(
                                    "confidence", 0.0
                                )
                            ),
                            "risk_score": float(analysis.get("risk_score", 0.0))
                            if analysis.get("risk_score")
                            else None,
                            "position_size": analysis.get("position_size"),
                        }

                        decisions[stock_symbol] = decision
                        current_prices[stock_symbol] = current_price

                        # Extract signal contributions for this tick
                        aggregated_signal = analysis.get("aggregated_signal", {})
                        indicators = analysis.get("indicators", {})
                        patterns = analysis.get("patterns", [])
                        ml_signals = analysis.get("ml_signals", [])

                        # Get indicator signals (convert indicators to signals)
                        # Use the bot instance that was already created to convert indicators to signals
                        # We need historical price data for proper signal conversion
                        indicator_signals_list = bot._convert_indicators_to_signals(
                            indicators,
                            aggregated_historical_data,  # Use aggregated historical data for signal conversion
                        )

                        # Convert signals to dicts for JSON serialization
                        indicator_signals_dicts = []
                        for signal in indicator_signals_list:
                            if hasattr(signal, "to_dict"):
                                indicator_signals_dicts.append(signal.to_dict())
                            elif isinstance(signal, dict):
                                indicator_signals_dicts.append(signal)
                            else:
                                # Fallback: create dict from signal object
                                indicator_signals_dicts.append(
                                    {
                                        "source": getattr(signal, "source", "unknown"),
                                        "action": getattr(signal, "action", "hold"),
                                        "confidence": getattr(
                                            signal, "confidence", 0.0
                                        ),
                                        "strength": getattr(signal, "strength", 0.0),
                                        "metadata": getattr(signal, "metadata", {}),
                                    }
                                )

                        tick_signal_contributions = {
                            "ml_signals": ml_signals,
                            "indicator_signals": len(indicator_signals_list),
                            "indicator_signals_list": indicator_signals_dicts,  # Store actual signals as dicts
                            "pattern_signals": len(patterns),
                            "social_signals": analysis.get("social_signals"),
                            "news_signals": analysis.get("news_signals"),
                            "aggregated_confidence": aggregated_signal.get(
                                "confidence", 0.0
                            ),
                            "action_scores": aggregated_signal.get("action_scores", {}),
                            "indicators": indicators,
                            "patterns": patterns,
                        }

                        # Store signal contributions (latest per stock for daily summary)
                        signal_contributions[stock_symbol] = tick_signal_contributions

                        # Track portfolio state before trade
                        portfolio_value_before = self._calculate_portfolio_value(
                            day_date
                        )
                        cash_before = self.cash

                        # Execute trade if needed
                        trade_executed = False
                        trade_details = {}
                        if decision["action"] in ["buy", "sell"]:
                            trades_before_tick = len(self.trades)
                            self._execute_trade(stock_symbol, decision, current_price)
                            if len(self.trades) > trades_before_tick:
                                trade_executed = True
                                trade = self.trades[-1].copy()
                                trade["date"] = day_date.isoformat()
                                day_trades.append(trade)
                                self.trades[-1] = trade
                                total_trades += 1
                                trade_details = {
                                    "action": trade.get("action"),
                                    "quantity": trade.get("quantity"),
                                    "price": trade.get("price"),
                                    "cost": trade.get("cost", trade.get("revenue", 0)),
                                }

                        # Calculate portfolio state after trade
                        portfolio_value_after = self._calculate_portfolio_value(
                            day_date
                        )
                        portfolio_state = {
                            "cash": float(self.cash),
                            "portfolio_value": float(portfolio_value_after),
                            "total_value": float(self.cash + portfolio_value_after),
                            "positions": {
                                symbol: {
                                    "quantity": float(pos["quantity"]),
                                    "avg_price": float(pos["avg_price"]),
                                }
                                for symbol, pos in self.portfolio.items()
                            },
                        }

                        # Calculate tick profit (change in total value)
                        tick_profit = (self.cash + portfolio_value_after) - (
                            cash_before + portfolio_value_before
                        )
                        self.cumulative_profit += Decimal(str(tick_profit))

                        # Parse tick timestamp
                        tick_timestamp_str = tick_info.get("timestamp", "")
                        try:
                            if isinstance(tick_timestamp_str, str):
                                tick_timestamp = datetime.fromisoformat(
                                    tick_timestamp_str
                                )
                            else:
                                tick_timestamp = tick_timestamp_str
                        except (ValueError, TypeError, AttributeError):
                            # Fallback to day date at noon if timestamp parsing fails
                            tick_timestamp = datetime.combine(
                                day_date, datetime.min.time().replace(hour=12)
                            )

                        # Store tick result in database
                        if self.bot_sim_config:
                            BotSimulationTick.objects.create(
                                simulation_config=self.bot_sim_config,
                                date=day_date,
                                tick_timestamp=tick_timestamp,
                                stock_symbol=stock_symbol,
                                tick_price=Decimal(str(current_price)),
                                decision=decision,
                                signal_contributions=tick_signal_contributions,
                                portfolio_state=portfolio_state,
                                cumulative_profit=self.cumulative_profit,
                                trade_executed=trade_executed,
                                trade_details=trade_details,
                            )

                        # Store tick result for cumulative context
                        day_tick_results.append(
                            {
                                "stock_symbol": stock_symbol,
                                "tick_data": tick,
                                "decision": decision,
                                "portfolio_state": portfolio_state,
                            }
                        )

                    except Exception as e:
                        logger.exception(
                            f"Error processing tick {tick_info['timestamp']} for {stock_symbol}: {e}"
                        )
                        continue

                # Add day's ticks to all processed ticks for cumulative context
                all_processed_ticks.extend(day_tick_results)

                # Calculate end of day values
                end_of_day_portfolio_value = self._calculate_portfolio_value(day_date)
                end_of_day_total_assets = self.cash + end_of_day_portfolio_value

                # Calculate daily profit = (end of day total assets) - (start of day initial fund)
                daily_profit = end_of_day_total_assets - day_start_cash

                # Store daily result
                day_result = {
                    "date": day_date.isoformat(),
                    "decisions": decisions,
                    "actual_prices": current_prices,
                    "signal_contributions": signal_contributions,
                    "performance_metrics": {
                        "cash": float(self.cash),
                        "portfolio_value": float(end_of_day_portfolio_value),
                        "total_value": float(end_of_day_total_assets),
                        "daily_profit": float(daily_profit),
                        "trades_today": len(day_trades),
                        "initial_cash": float(day_start_cash),
                        "cumulative_profit": float(self.cumulative_profit),
                    },
                }
                daily_results.append(day_result)

                # Log summary for each day
                logger.info(
                    f"    Day {day_date}: Profit=${daily_profit:.2f}, "
                    f"Trades={len(day_trades)}, "
                    f"Total Value=${end_of_day_total_assets:.2f}, "
                    f"Cumulative Profit=${self.cumulative_profit:.2f}"
                )

            except Exception as e:
                logger.exception(f"Error executing day {day_date}: {e}")
                continue

        return {
            "total_days": len(dates_in_range),
            "days_executed": len(daily_results),
            "total_trades": total_trades,
            "daily_results": daily_results,
        }
