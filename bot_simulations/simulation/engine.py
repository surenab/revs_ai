"""
Simulation engine for orchestrating multi-bot trading simulations.
"""

import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

from bot_simulations.models import (
    BotSimulationConfig,
    BotSimulationDay,
    BotSimulationRun,
)
from stocks.models import Stock, StockTick, TradingBotConfig

from .data_splitter import DataSplitter
from .day_executor import DayExecutor
from .parameter_generator import (
    INDICATOR_GROUPS,
    PATTERN_GROUPS,
    ParameterGenerator,
)

logger = logging.getLogger(__name__)


class SimulationEngine:
    """Main engine for orchestrating trading bot simulations."""

    def __init__(self, simulation_run: BotSimulationRun, max_workers: int = 1):
        """
        Initialize simulation engine.

        Args:
            simulation_run: BotSimulationRun instance
            max_workers: Number of parallel threads for bot execution (default: 1 for sequential)
        """
        self.simulation_run = simulation_run
        # DataSplitter is not used when execution dates are provided, but keep for backward compatibility
        self.data_splitter = DataSplitter(0.8)
        self.max_workers = max_workers

    def run(self) -> dict[str, Any]:
        """
        Run the complete simulation.

        Returns:
            Dictionary with simulation results
        """
        logger.info(f"Starting simulation run: {self.simulation_run.name}")

        try:
            # Update status
            self.simulation_run.status = "running"
            self.simulation_run.started_at = timezone.now()
            self.simulation_run.save()

            # Step 1: Prepare data for simulation
            logger.info("Preparing historical and execution data...")
            stocks_list = list(self.simulation_run.stocks.all())
            logger.info(
                f"Processing {len(stocks_list)} stock(s): {[s.symbol for s in stocks_list]}"
            )
            split_result = self._split_data()
            logger.info(
                f"Data preparation completed: "
                f"Historical context: {split_result['historical_points']} points (up to {split_result['execution_start']}), "
                f"Execution period: {split_result['execution_points']} points ({split_result['execution_start']} to {split_result['execution_end']})"
            )

            # Step 2: Generate bot configurations
            logger.info("Generating bot configurations...")
            try:
                bot_configs = self._generate_bot_configs()
            except Exception as e:
                error_type = type(e).__name__
                error_details = str(e)
                full_error_message = f"Failed to generate bot configurations - {error_type}: {error_details}"
                logger.exception(f"Error generating bot configs: {full_error_message}")
                self.simulation_run.status = "failed"
                self.simulation_run.error_message = full_error_message
                self.simulation_run.save()
                raise

            # Step 3: Execute simulations for each bot
            logger.info(f"Executing simulations for {len(bot_configs)} bots...")
            results = self._execute_simulations(bot_configs, split_result)

            # Check if simulation was paused or cancelled
            self.simulation_run.refresh_from_db()
            if self.simulation_run.status in ["paused", "cancelled"]:
                return {
                    "status": self.simulation_run.status,
                    "message": f"Simulation was {self.simulation_run.status}",
                }

            # Step 4: Update simulation run
            self.simulation_run.status = "completed"
            self.simulation_run.completed_at = timezone.now()
            self.simulation_run.progress = Decimal("100.00")
            self.simulation_run.save()

            logger.info(f"Simulation completed: {self.simulation_run.name}")

            return {
                "status": "completed",
                "total_bots": len(bot_configs),
                "results": results,
            }

        except Exception as e:
            error_type = type(e).__name__
            error_details = str(e)
            full_error_message = f"{error_type}: {error_details}"

            logger.exception(f"Simulation failed: {full_error_message}")
            self.simulation_run.status = "failed"
            self.simulation_run.error_message = full_error_message
            self.simulation_run.save()
            raise

    def _split_data(self) -> dict[str, Any]:
        """Prepare tick data: historical context (before execution) and execution period data."""
        from datetime import date as date_type

        stocks = list(self.simulation_run.stocks.all())

        # Get execution dates
        execution_start = self.simulation_run.execution_start_date
        execution_end = self.simulation_run.execution_end_date

        if not execution_start or not execution_end:
            msg = "execution_start_date and execution_end_date must be provided"
            raise ValueError(msg)

        # Historical data: All data before execution_start_date (for bot analysis context)
        # Execution data: Data from execution_start_date to execution_end_date (when bot executes trades)
        historical_data = {}
        execution_data = {}

        for stock in stocks:
            # Get historical data (before execution period - for bot analysis context)
            historical_query = StockTick.objects.filter(
                stock=stock, timestamp__date__lt=execution_start
            ).order_by("timestamp")
            historical_ticks = list(historical_query)

            # Get execution data (during execution period - when bot executes trades)
            execution_query = StockTick.objects.filter(
                stock=stock,
                timestamp__date__gte=execution_start,
                timestamp__date__lte=execution_end,
            ).order_by("timestamp")
            execution_ticks = list(execution_query)

            # Convert to dict format
            from bot_simulations.simulation.data_splitter import DataSplitter

            splitter = DataSplitter(0.8)  # Dummy ratio, not used
            historical_data[stock.symbol] = [
                splitter._tick_to_dict(tick) for tick in historical_ticks
            ]
            execution_data[stock.symbol] = [
                splitter._tick_to_dict(tick) for tick in execution_ticks
            ]

        # Get date ranges for historical data
        all_historical_dates = set()
        for stock_data in historical_data.values():
            for tick in stock_data:
                if tick.get("date"):
                    all_historical_dates.add(date_type.fromisoformat(tick["date"]))

        historical_start = min(all_historical_dates) if all_historical_dates else None
        historical_end = max(all_historical_dates) if all_historical_dates else None

        # Calculate totals
        total_points = sum(len(ticks) for ticks in historical_data.values()) + sum(
            len(ticks) for ticks in execution_data.values()
        )
        historical_points = sum(len(ticks) for ticks in historical_data.values())
        execution_points = sum(len(ticks) for ticks in execution_data.values())

        split_result = {
            "historical_data": historical_data,
            "execution_data": execution_data,
            # Keep old keys for backward compatibility with existing code
            "training_data": historical_data,
            "validation_data": execution_data,
            "historical_start": historical_start,
            "historical_end": historical_end or (execution_start - timedelta(days=1))
            if historical_end
            else execution_start,
            "execution_start": execution_start,
            "execution_end": execution_end,
            # Keep old keys for backward compatibility
            "training_start": historical_start or execution_start,
            "training_end": historical_end or (execution_start - timedelta(days=1))
            if historical_end
            else execution_start,
            "validation_start": execution_start,
            "validation_end": execution_end,
            "total_points": total_points,
            "historical_points": historical_points,
            "execution_points": execution_points,
            # Keep old keys for backward compatibility
            "training_points": historical_points,
            "validation_points": execution_points,
            "split_ratio": 0.0,  # Not used when execution dates are provided
        }

        # Update simulation run with split info
        self.simulation_run.total_data_points = split_result["total_points"]

        self.simulation_run.save()

        return split_result

    def _generate_bot_configs(self) -> list[dict[str, Any]]:
        """Generate bot configurations using parameter generator."""
        stocks = [
            {"id": str(stock.id), "symbol": stock.symbol}
            for stock in self.simulation_run.stocks.all()
        ]

        config_ranges = (
            self.simulation_run.config_ranges or ParameterGenerator.get_default_ranges()
        )

        generator = ParameterGenerator(config_ranges)
        # Get boolean flags - they might be lists for grid search
        use_social_analysis = config_ranges.get("use_social_analysis", False)
        use_news_analysis = config_ranges.get("use_news_analysis", False)

        bot_configs = generator.generate_configs(
            stocks=stocks,
            use_social_analysis=use_social_analysis,
            use_news_analysis=use_news_analysis,
        )

        # Update total bots
        self.simulation_run.total_bots = len(bot_configs)
        self.simulation_run.save()

        # Check if we should clear existing configs (for fresh runs or retries)
        # Only keep configs if we're resuming a paused simulation
        if self.simulation_run.status != "paused":
            # Delete existing configs to avoid conflicts
            existing_count = BotSimulationConfig.objects.filter(
                simulation_run=self.simulation_run
            ).count()
            if existing_count > 0:
                BotSimulationConfig.objects.filter(
                    simulation_run=self.simulation_run
                ).delete()

        # Create BotSimulationConfig records (use update_or_create for safety)
        created_configs = []
        for config_data in bot_configs:
            try:
                # Use update_or_create to handle both creation and updates atomically
                sim_config, _created = BotSimulationConfig.objects.update_or_create(
                    simulation_run=self.simulation_run,
                    bot_index=config_data["bot_index"],
                    defaults={
                        "config_json": config_data["config_json"],
                        "use_social_analysis": config_data["use_social_analysis"],
                        "use_news_analysis": config_data["use_news_analysis"],
                    },
                )

                # Assign stocks (clear existing first to avoid duplicates)
                sim_config.assigned_stocks.clear()
                for stock_dict in config_data["assigned_stocks"]:
                    try:
                        stock = Stock.objects.get(id=stock_dict["id"])
                        sim_config.assigned_stocks.add(stock)
                    except Stock.DoesNotExist:
                        logger.warning(f"Stock {stock_dict.get('symbol')} not found")

                created_configs.append(sim_config)
            except IntegrityError as e:
                # This should rarely happen with update_or_create, but handle it just in case
                error_msg = (
                    f"IntegrityError creating bot config {config_data['bot_index']}: {e}. "
                    f"This may indicate a race condition or data corruption."
                )
                logger.exception(error_msg)
                # Try one more time with a direct get and update
                try:
                    sim_config = BotSimulationConfig.objects.get(
                        simulation_run=self.simulation_run,
                        bot_index=config_data["bot_index"],
                    )
                    # Update it
                    sim_config.config_json = config_data["config_json"]
                    sim_config.use_social_analysis = config_data["use_social_analysis"]
                    sim_config.use_news_analysis = config_data["use_news_analysis"]
                    sim_config.save()

                    # Assign stocks
                    sim_config.assigned_stocks.clear()
                    for stock_dict in config_data["assigned_stocks"]:
                        try:
                            stock = Stock.objects.get(id=stock_dict["id"])
                            sim_config.assigned_stocks.add(stock)
                        except Stock.DoesNotExist:
                            logger.warning(
                                f"Stock {stock_dict.get('symbol')} not found"
                            )

                    created_configs.append(sim_config)
                except BotSimulationConfig.DoesNotExist:
                    # If we still can't get it, this is a serious issue
                    logger.exception(
                        f"Could not recover bot config {config_data['bot_index']} after IntegrityError"
                    )
                    self.simulation_run.status = "failed"
                    self.simulation_run.error_message = error_msg
                    self.simulation_run.save()
                    raise
            except Exception as e:
                # Handle other unexpected errors
                error_msg = f"Unexpected error creating bot config {config_data['bot_index']}: {e}"
                logger.exception(error_msg)
                # Set status to failed before raising
                self.simulation_run.status = "failed"
                self.simulation_run.error_message = error_msg
                self.simulation_run.save()
                raise

        # Verify all configs were created
        if len(created_configs) != len(bot_configs):
            error_msg = (
                f"Failed to create all bot configs. Expected {len(bot_configs)}, "
                f"but only created {len(created_configs)}."
            )
            logger.error(error_msg)
            self.simulation_run.status = "failed"
            self.simulation_run.error_message = error_msg
            self.simulation_run.save()
            raise RuntimeError(error_msg)

        return created_configs

    def _execute_simulations(
        self, bot_configs: list[BotSimulationConfig], split_result: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """
        Execute simulations for all bot configurations in parallel batches.

        Args:
            bot_configs: List of BotSimulationConfig instances
            split_result: Data split result from _split_data()

        Returns:
            List of execution results
        """
        try:
            from celery import group

            from bot_simulations.tasks import execute_single_bot_simulation

            use_celery = True
        except ImportError:
            logger.warning("Celery not available, falling back to sequential execution")
            use_celery = False

        # TODO: Remove this after testing
        use_celery = False

        total_bots = len(bot_configs)
        batch_size = 10  # Configurable batch size for parallel execution
        results = []

        logger.info(f"Executing {total_bots} bots in parallel batches of {batch_size}")

        # Split bots into batches
        for batch_start in range(0, total_bots, batch_size):
            batch_end = min(batch_start + batch_size, total_bots)
            batch_configs = bot_configs[batch_start:batch_end]

            # Check for pause/stop signals
            self.simulation_run.refresh_from_db()
            if self.simulation_run.status == "paused":
                return {"status": "paused", "bots_completed": batch_start}
            if self.simulation_run.status == "cancelled":
                return {"status": "cancelled", "bots_completed": batch_start}

            # Create Celery task group for parallel execution
            if use_celery:
                try:
                    task_group = group(
                        execute_single_bot_simulation.s(
                            str(self.simulation_run.id), str(bot_config.id)
                        )
                        for bot_config in batch_configs
                    )

                    # Execute batch in parallel
                    job = task_group.apply_async()
                    batch_results = job.get()  # Wait for all tasks in batch to complete
                except (
                    ConnectionError,
                    TimeoutError,
                    OSError,
                    RuntimeError,
                ) as celery_error:
                    # Celery connection errors (Redis not running, network issues, etc.)
                    logger.warning(
                        f"Celery execution failed: {celery_error}, falling back to sequential"
                    )
                    use_celery = False
                    batch_results = None
            else:
                batch_results = None

            if not use_celery or batch_results is None:
                # Fall back to sequential or threaded execution for this batch
                from bot_simulations.tasks import (
                    _execute_single_bot_simulation_internal,
                )

                if self.max_workers > 1:
                    # Use ThreadPoolExecutor for parallel execution
                    from concurrent.futures import ThreadPoolExecutor, as_completed

                    from django.db import connections

                    logger.info(f"Executing batch with {self.max_workers} thread(s)")

                    def execute_bot(bot_sim_config):
                        """Execute a single bot simulation in a thread."""
                        try:
                            # Close any existing database connections in this thread
                            connections.close_all()
                            result = _execute_single_bot_simulation_internal(
                                str(self.simulation_run.id),
                                str(bot_sim_config.id),
                                task_instance=None,
                            )
                            return bot_sim_config, result
                        except Exception as bot_error:
                            logger.exception(
                                f"Error executing bot {bot_sim_config.bot_index}: {bot_error}"
                            )
                            return bot_sim_config, None

                    # Execute batch in parallel using ThreadPoolExecutor
                    with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                        future_to_bot = {
                            executor.submit(execute_bot, bot_sim_config): bot_sim_config
                            for bot_sim_config in batch_configs
                        }

                        for future in as_completed(future_to_bot):
                            bot_sim_config, result = future.result()
                            if result and result.get("status") == "completed":
                                results.append(result)
                                completed_count = len(results)
                                # Update progress (with thread-safe save)
                                with transaction.atomic():
                                    self.simulation_run.refresh_from_db()
                                    self.simulation_run.bots_completed = completed_count
                                    self.simulation_run.progress = Decimal(
                                        str((completed_count / total_bots) * 100)
                                    )
                                    self.simulation_run.save()
                else:
                    # Sequential execution
                    logger.info("Executing batch sequentially")
                    for bot_sim_config in batch_configs:
                        try:
                            result = _execute_single_bot_simulation_internal(
                                str(self.simulation_run.id),
                                str(bot_sim_config.id),
                                task_instance=None,
                            )
                            if result and result.get("status") == "completed":
                                results.append(result)
                                completed_count = len(results)
                                self.simulation_run.bots_completed = completed_count
                                self.simulation_run.progress = Decimal(
                                    str((completed_count / total_bots) * 100)
                                )
                                self.simulation_run.save()
                        except Exception as bot_error:
                            logger.exception(
                                f"Error executing bot {bot_sim_config.bot_index}: {bot_error}"
                            )
                            continue
            else:
                # Process results from parallel execution
                for result in batch_results:
                    if result and result.get("status") == "completed":
                        results.append(result)
                        # Update simulation run progress
                        completed_count = len(results)
                        self.simulation_run.bots_completed = completed_count
                        self.simulation_run.progress = Decimal(
                            str((completed_count / total_bots) * 100)
                        )
                        self.simulation_run.save()
                    elif result and result.get("status") == "error":
                        logger.error(
                            f"Bot {result.get('bot_config_id')} failed: {result.get('message')}"
                        )
                        # Update error message
                        error_msg = f"Bot {result.get('bot_config_id')}: {result.get('message')}"
                        if self.simulation_run.error_message:
                            self.simulation_run.error_message += f"\n{error_msg}"
                        else:
                            self.simulation_run.error_message = error_msg
                        self.simulation_run.save()

        logger.info(f"Completed execution of {len(results)}/{total_bots} bots")
        return results

    def _execute_simulations_sequential(
        self, bot_configs: list[BotSimulationConfig], split_result: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Execute simulations sequentially (fallback method)."""
        results = []
        total_bots = len(bot_configs)

        for idx, bot_sim_config in enumerate(bot_configs):
            # Check for pause/stop signals
            self.simulation_run.refresh_from_db()
            if self.simulation_run.status == "paused":
                return {"status": "paused", "bots_completed": idx}
            if self.simulation_run.status == "cancelled":
                return {"status": "cancelled", "bots_completed": idx}

            try:
                # Track bot execution start time
                bot_start_time = timezone.now()

                # Create temporary TradingBotConfig
                bot_config = self._create_temp_bot_config(bot_sim_config)

                # Get assigned stocks for this bot
                assigned_stocks = list(bot_sim_config.assigned_stocks.all())
                if not assigned_stocks:
                    logger.warning(
                        f"No stocks assigned to bot {bot_sim_config.bot_index}"
                    )
                    continue

                # Get execution period from simulation run
                execution_start_date = self.simulation_run.execution_start_date
                execution_end_date = self.simulation_run.execution_end_date

                if not execution_start_date or not execution_end_date:
                    # Fallback to execution period if execution dates not set
                    execution_start_date = split_result["execution_start"]
                    execution_end_date = split_result["execution_end"]
                    logger.warning(
                        f"Execution dates not set, using execution period: {execution_start_date} to {execution_end_date}"
                    )

                # Combine historical + execution data so bot can see full history for analysis
                # Historical data is used for analysis context, execution data for actual trading
                combined_historical_data = {}
                for stock in assigned_stocks:
                    symbol = stock.symbol
                    historical_ticks = split_result["historical_data"].get(symbol, [])
                    execution_ticks = split_result["execution_data"].get(symbol, [])
                    # Combine all ticks, sorted by timestamp
                    all_ticks = historical_ticks + execution_ticks
                    # Sort by timestamp
                    all_ticks.sort(key=lambda t: t.get("timestamp", ""))
                    combined_historical_data[symbol] = all_ticks

                # Determine initial state based on simulation type
                initial_cash = Decimal(str(self.simulation_run.initial_fund))
                initial_portfolio = None
                if self.simulation_run.simulation_type == "portfolio":
                    # Convert initial_portfolio dict to Decimal values
                    initial_portfolio = {
                        symbol: Decimal(str(quantity))
                        for symbol, quantity in self.simulation_run.initial_portfolio.items()
                    }

                daily_executor = DayExecutor(
                    bot_config=bot_config,
                    price_data=combined_historical_data,  # Full historical data for analysis
                    initial_cash=initial_cash,
                    initial_portfolio=initial_portfolio,  # For portfolio-based simulations
                    training_mode=False,  # Execute trades
                    historical_start_date=split_result[
                        "historical_start"
                    ],  # Bot can use all data from here
                    testing_start_date=execution_start_date,  # Start executing trades from here
                    daily_execution_mode=True,  # Each day starts fresh
                    bot_sim_config=bot_sim_config,  # For progress tracking and tick storage
                )

                execution_result = daily_executor.execute_daily(
                    execution_start_date=execution_start_date,
                    execution_end_date=execution_end_date,
                )

                # Store daily results
                daily_results = execution_result.get("daily_results", [])
                self._store_daily_results(
                    bot_sim_config, daily_results, phase="execution"
                )

                self._calculate_and_store_result(bot_sim_config, execution_result, None)

                # Log final summary
                from bot_simulations.models import BotSimulationResult

                try:
                    final_result = BotSimulationResult.objects.get(
                        simulation_config=bot_sim_config
                    )
                    logger.info(
                        f"  Bot {bot_sim_config.bot_index} final results: "
                        f"Profit=${float(final_result.total_profit):.2f}, "
                        f"Trades={final_result.total_trades}, "
                        f"Win Rate={float(final_result.win_rate):.1f}%, "
                        f"Final Value=${float(final_result.final_portfolio_value):.2f}"
                    )
                except BotSimulationResult.DoesNotExist:
                    logger.warning(
                        f"  Bot {bot_sim_config.bot_index}: Final result not found"
                    )

                results.append(
                    {
                        "bot_index": bot_sim_config.bot_index,
                        "execution_result": execution_result,
                    }
                )

                # Clean up temporary bot config
                bot_config.delete()

                # Calculate bot execution time
                bot_end_time = timezone.now()
                bot_execution_time = (bot_end_time - bot_start_time).total_seconds()

                logger.info(
                    f"Bot {bot_sim_config.bot_index} completed in {bot_execution_time:.2f} seconds "
                    f"({idx + 1}/{total_bots} bots done, {((idx + 1) / total_bots * 100):.1f}% complete)"
                )

                # Update progress and execution times
                self.simulation_run.bots_completed = idx + 1
                self.simulation_run.progress = Decimal(
                    str((idx + 1) / total_bots * 100)
                )
                # Store execution time for this bot
                execution_times = self.simulation_run.bot_execution_times or []
                execution_times.append(bot_execution_time)
                # Keep only last 50 execution times to avoid memory issues
                if len(execution_times) > 50:
                    execution_times = execution_times[-50:]
                self.simulation_run.bot_execution_times = execution_times
                self.simulation_run.save()

            except Exception as e:
                error_msg = f"Error executing bot {bot_sim_config.bot_index}: {e!s}"
                logger.exception(error_msg)
                # Track the error but continue with other bots
                # Update error message to include bot failure info
                if self.simulation_run.error_message:
                    self.simulation_run.error_message += f"\n{error_msg}"
                else:
                    self.simulation_run.error_message = error_msg
                self.simulation_run.save()
                continue

        return results

    def _create_temp_bot_config(
        self, bot_sim_config: BotSimulationConfig
    ) -> TradingBotConfig:
        """Create a temporary TradingBotConfig from simulation config."""
        config_json = bot_sim_config.config_json

        # Get enabled indicators/patterns from config_json (set by parameter generator)
        # If not in config_json, try to get from simulation run's config_ranges
        enabled_indicators = config_json.get("enabled_indicators")
        if not enabled_indicators:
            # Try to get indicator groups from config_json
            indicator_groups = config_json.get("indicator_groups")
            if indicator_groups:
                enabled_indicators = self._get_indicators_from_groups(indicator_groups)

        if not enabled_indicators:
            # Enable ALL indicators with reasonable configurations for simulations
            enabled_indicators = {
                # Moving Averages
                "sma": {"period": 20},
                "ema": {"period": 20},
                "wma": {"period": 20},
                "dema": {"period": 20},
                "tema": {"period": 20},
                "tma": {"period": 20},
                "hma": {"period": 20},
                "mcginley": {"period": 14},
                "vwap_ma": {"period": 20},
                # Bands & Channels
                "bollinger": {"period": 20},
                "keltner": {"period": 20, "multiplier": 2.0},
                "donchian": {"period": 20},
                "fractal": {"period": 5},
                # Oscillators
                "rsi": {"period": 14},
                "adx": {"period": 14},
                "cci": {"period": 20},
                "mfi": {"period": 14},
                "macd": {"fast_period": 12, "slow_period": 26, "signal_period": 9},
                "williams_r": {"period": 14},
                "momentum": {"period": 10},
                "proc": {"period": 12},
                "stochastic": {"k_period": 14, "d_period": 3},
                # Trend Indicators
                "psar": {"acceleration": 0.02, "maximum": 0.20},
                "supertrend": {"period": 10, "multiplier": 3.0},
                "alligator": {"jaw_period": 13, "teeth_period": 8, "lips_period": 5},
                "ichimoku": {
                    "tenkan_period": 9,
                    "kijun_period": 26,
                    "senkou_b_period": 52,
                },
                # Volatility
                "atr": {"period": 14},
                "atr_trailing": {"period": 14, "multiplier": 2.0},
                # Volume
                "vwap": {},
                "obv": {},
                # Other
                "linear_regression": {"period": 14},
                "pivot_points": {},
            }

        enabled_patterns = config_json.get("enabled_patterns")
        if not enabled_patterns:
            # Try to get pattern groups from config_json
            pattern_groups = config_json.get("pattern_groups")
            if pattern_groups:
                enabled_patterns = self._get_patterns_from_groups(pattern_groups)

        if not enabled_patterns:
            # Enable ALL patterns with reasonable confidence thresholds
            enabled_patterns = {
                # Candlestick Patterns
                "three_white_soldiers": {"min_confidence": 0.5},
                "morning_doji_star": {"min_confidence": 0.5},
                "morning_star": {"min_confidence": 0.5},
                "abandoned_baby": {"min_confidence": 0.5},
                "conceal_baby_swallow": {"min_confidence": 0.5},
                "stick_sandwich": {"min_confidence": 0.5},
                "kicking": {"min_confidence": 0.5},
                "engulfing": {"min_confidence": 0.5},
                "bullish_engulfing": {"min_confidence": 0.5},
                "bearish_engulfing": {"min_confidence": 0.5},
                "homing_pigeon": {"min_confidence": 0.5},
                "advance_block": {"min_confidence": 0.5},
                "tri_star": {"min_confidence": 0.5},
                "spinning_top": {"min_confidence": 0.5},
                # Chart Patterns
                "head_and_shoulders": {"min_confidence": 0.5},
                "double_top": {"min_confidence": 0.5},
                "double_bottom": {"min_confidence": 0.5},
                "flag": {"min_confidence": 0.5},
                "pennant": {"min_confidence": 0.5},
                "wedge": {"min_confidence": 0.5},
                "rising_wedge": {"min_confidence": 0.5},
                "falling_wedge": {"min_confidence": 0.5},
                # Regime Detection Patterns
                "trending_regime": {"min_confidence": 0.5},
                "ranging_regime": {"min_confidence": 0.5},
                "volatile_regime": {"min_confidence": 0.5},
                "regime_transition": {"min_confidence": 0.5},
            }

        enabled_ml_models = config_json.get("enabled_ml_models", [])

        # Initialize cash from budget_cash
        budget_cash = Decimal("10000.00")
        initial_cash = Decimal(str(self.simulation_run.initial_fund))

        # Create and save a temporary bot config (will be cleaned up later)
        bot_config = TradingBotConfig.objects.create(
            user=self.simulation_run.user,
            name=f"Sim_{self.simulation_run.name}_Bot_{bot_sim_config.bot_index}",
            is_active=False,  # Not active, just for simulation
            budget_type="cash",
            budget_cash=budget_cash,
            cash_balance=initial_cash,  # Initialize cash balance from initial fund
            initial_cash=initial_cash,  # Track initial cash allocation
            risk_per_trade=Decimal("2.00"),
            signal_aggregation_method=config_json.get(
                "signal_aggregation_method", "weighted_average"
            ),
            signal_weights=config_json.get("signal_weights", {}),
            ml_model_weights=config_json.get("ml_model_weights", {}),
            risk_score_threshold=Decimal(
                str(config_json.get("risk_score_threshold", 80))
            ),
            risk_adjustment_factor=Decimal(
                str(config_json.get("risk_adjustment_factor", 0.4))
            ),
            risk_based_position_scaling=config_json.get(
                "risk_based_position_scaling", True
            ),
            period_days=config_json.get("period_days", 14),
            stop_loss_percent=Decimal(str(config_json.get("stop_loss_percent", 0)))
            if config_json.get("stop_loss_percent")
            else None,
            take_profit_percent=Decimal(str(config_json.get("take_profit_percent", 0)))
            if config_json.get("take_profit_percent")
            else None,
            # Signal persistence configuration
            signal_persistence_type=config_json.get("signal_persistence_type"),
            signal_persistence_value=config_json.get("signal_persistence_value"),
            # Social and News Analysis - enabled if configured in simulation
            enable_social_analysis=bot_sim_config.use_social_analysis,
            enable_news_analysis=bot_sim_config.use_news_analysis,
            # Indicators, Patterns, and ML Models
            enabled_indicators=enabled_indicators,
            enabled_patterns=enabled_patterns,
            enabled_ml_models=enabled_ml_models,
        )

        # Assign stocks
        assigned_stocks = list(bot_sim_config.assigned_stocks.all())
        bot_config.assigned_stocks.set(assigned_stocks)

        return bot_config

    def _convert_tick_results_to_daily(
        self, tick_results: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Convert tick-by-tick results to daily aggregated results."""
        from collections import defaultdict
        from datetime import date as date_type

        daily_aggregated = defaultdict(
            lambda: {
                "date": None,
                "decisions": {},
                "actual_prices": {},
                "performance_metrics": {
                    "cash": 0.0,
                    "portfolio_value": 0.0,
                    "total_value": 0.0,
                    "daily_profit": 0.0,
                    "trades_today": 0,
                    "total_trade_profit": 0.0,
                },
                "signal_contributions": {},
            }
        )

        for tick_result in tick_results:
            tick_date_str = tick_result.get("date")
            if not tick_date_str:
                continue

            tick_date = (
                date_type.fromisoformat(tick_date_str)
                if isinstance(tick_date_str, str)
                else tick_date_str
            )

            day_key = tick_date.isoformat()
            day_data = daily_aggregated[day_key]

            if day_data["date"] is None:
                day_data["date"] = tick_date_str

            stock_symbol = tick_result.get("stock_symbol")
            decision = tick_result.get("decision", {})
            price = tick_result.get("price", 0.0)

            # Aggregate decisions and prices
            if stock_symbol:
                day_data["decisions"][stock_symbol] = decision
                day_data["actual_prices"][stock_symbol] = price

            # Aggregate performance metrics
            day_data["performance_metrics"]["cash"] = tick_result.get("cash", 0.0)
            day_data["performance_metrics"]["portfolio_value"] = tick_result.get(
                "portfolio_value", 0.0
            )
            day_data["performance_metrics"]["total_value"] = tick_result.get(
                "cash", 0.0
            ) + tick_result.get("portfolio_value", 0.0)

            if tick_result.get("trade_executed"):
                day_data["performance_metrics"]["trades_today"] += 1
                day_data["performance_metrics"]["total_trade_profit"] += (
                    tick_result.get("trade_profit", 0.0)
                )

        # Convert to list and calculate daily profit
        daily_results = []
        previous_total_value = 10000.0  # Initial cash

        for day_key in sorted(daily_aggregated.keys()):
            day_data = daily_aggregated[day_key]
            current_total_value = day_data["performance_metrics"]["total_value"]
            day_data["performance_metrics"]["daily_profit"] = (
                current_total_value - previous_total_value
            )
            previous_total_value = current_total_value

            daily_results.append(day_data)

        return daily_results

    def _store_daily_results(
        self,
        bot_sim_config: BotSimulationConfig,
        daily_results: list[dict[str, Any]],
        phase: str = "testing",
    ):
        """Store daily results in database."""
        from datetime import date as date_type

        for day_result in daily_results:
            # Convert date string to date object if needed
            day_date = day_result.get("date")
            if isinstance(day_date, str):
                day_date = date_type.fromisoformat(day_date)

            # Store phase information in performance_metrics
            performance_metrics = day_result.get("performance_metrics", {})
            performance_metrics["phase"] = phase

            BotSimulationDay.objects.update_or_create(
                simulation_config=bot_sim_config,
                date=day_date,
                defaults={
                    "decisions": day_result.get("decisions", {}),
                    "actual_prices": day_result.get("actual_prices", {}),
                    "performance_metrics": performance_metrics,
                    "signal_contributions": day_result.get("signal_contributions", {}),
                },
            )

    def _calculate_and_store_result(
        self,
        bot_sim_config: BotSimulationConfig,
        execution_result: dict[str, Any],
        training_result: dict[str, Any] | None = None,
    ):
        """Calculate and store final simulation result based on daily execution."""
        from bot_simulations.models import BotSimulationResult

        from .signal_analyzer import SignalProductivityAnalyzer

        # Use execution results for final metrics (this is the actual performance)
        daily_results = execution_result.get("daily_results", [])

        if not daily_results:
            logger.warning(
                f"No execution results for bot {bot_sim_config.bot_index}, using defaults"
            )
            daily_results = []

        # Calculate metrics from daily execution results
        total_trades = sum(
            day.get("performance_metrics", {}).get("trades_today", 0)
            for day in daily_results
        )

        # Total profit is the sum of all daily profits
        total_profit = Decimal("0.00")
        for day in daily_results:
            daily_profit = Decimal(
                str(day.get("performance_metrics", {}).get("daily_profit", 0))
            )
            total_profit += daily_profit

        # Get final day metrics
        final_result = daily_results[-1] if daily_results else {}
        final_metrics = final_result.get("performance_metrics", {})
        final_cash = Decimal(str(final_metrics.get("cash", Decimal("10000.00"))))
        final_portfolio_value = Decimal(str(final_metrics.get("portfolio_value", 0)))

        # Calculate win rate from profitable days
        profitable_days = sum(
            1
            for day in daily_results
            if day.get("performance_metrics", {}).get("daily_profit", 0) > 0
        )
        total_days = len(daily_results)
        win_rate = (
            (profitable_days / total_days * 100) if total_days > 0 else Decimal("0.00")
        )

        # Calculate winning vs losing trades (count actual trades, not days)
        winning_trades = 0
        losing_trades = 0
        for day in daily_results:
            daily_profit = day.get("performance_metrics", {}).get("daily_profit", 0)
            trades_today = day.get("performance_metrics", {}).get("trades_today", 0)
            if trades_today > 0:
                if daily_profit > 0:
                    winning_trades += trades_today
                else:
                    losing_trades += trades_today

        # Analyze signal productivity (from execution results)
        analyzer = SignalProductivityAnalyzer(bot_sim_config)
        signal_analysis = analyzer.analyze()

        # Calculate additional metrics
        average_profit = (
            Decimal(str(total_profit / total_trades))
            if total_trades > 0
            else Decimal("0.00")
        )

        # Calculate max drawdown (simplified - track peak and trough)
        initial_cash = Decimal("10000.00")
        peak_value = initial_cash
        max_drawdown = Decimal("0.00")
        cumulative_value = initial_cash
        for day in daily_results:
            daily_profit = Decimal(
                str(day.get("performance_metrics", {}).get("daily_profit", 0))
            )
            cumulative_value += daily_profit
            peak_value = max(peak_value, cumulative_value)
            drawdown = peak_value - cumulative_value
            max_drawdown = max(max_drawdown, drawdown)

        # Create or update result
        BotSimulationResult.objects.update_or_create(
            simulation_config=bot_sim_config,
            defaults={
                "total_profit": Decimal(str(total_profit)),
                "total_trades": total_trades,
                "winning_trades": winning_trades,
                "losing_trades": losing_trades,
                "win_rate": Decimal(str(win_rate)),
                "average_profit": average_profit,
                "max_drawdown": max_drawdown,
                "final_cash": final_cash,
                "final_portfolio_value": final_portfolio_value,
                "signal_productivity": signal_analysis.get("signal_productivity", {}),
            },
        )

    @staticmethod
    def _get_indicators_from_groups(group_names: list[str]) -> dict[str, dict]:
        """
        Get enabled indicators from selected groups.

        Args:
            group_names: List of indicator group names

        Returns:
            Dictionary of enabled indicators with their configurations
        """
        enabled_indicators = {}
        for group_name in group_names:
            if group_name in INDICATOR_GROUPS:
                enabled_indicators.update(INDICATOR_GROUPS[group_name])
        return enabled_indicators

    @staticmethod
    def _get_patterns_from_groups(group_names: list[str]) -> dict[str, dict]:
        """
        Get enabled patterns from selected groups.

        Args:
            group_names: List of pattern group names

        Returns:
            Dictionary of enabled patterns with their configurations
        """
        enabled_patterns = {}
        for group_name in group_names:
            if group_name in PATTERN_GROUPS:
                enabled_patterns.update(PATTERN_GROUPS[group_name])
        return enabled_patterns
