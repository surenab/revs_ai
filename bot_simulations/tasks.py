"""
Celery tasks for bot simulation functionality.
"""

import logging

from celery import shared_task
from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def run_bot_simulation(simulation_run_id: str, max_workers: int = 1):
    """
    Run bot simulation (can be called directly or via Celery).

    Args:
        simulation_run_id: UUID of BotSimulationRun instance
        max_workers: Number of parallel threads for bot execution (default: 1 for sequential)

    Returns:
        Dict with execution results
    """
    return _run_bot_simulation_internal(simulation_run_id, max_workers=max_workers)


@shared_task(bind=True, max_retries=3, default_retry_delay=600)
def run_bot_simulation_task(self, simulation_run_id: str):
    """
    Celery task wrapper for run_bot_simulation.

    Args:
        self: Celery task instance (bind=True)
        simulation_run_id: UUID of BotSimulationRun instance

    Returns:
        Dict with execution results
    """
    return _run_bot_simulation_internal(simulation_run_id, task_instance=self)


def _run_bot_simulation_internal(
    simulation_run_id: str, task_instance=None, max_workers: int = 1
):
    """
    Celery task to run bot simulation.

    Args:
        simulation_run_id: UUID of BotSimulationRun instance
        task_instance: Optional Celery task instance (for retries)
        max_workers: Number of parallel threads for bot execution (default: 1 for sequential)

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
            logger.exception(f"Simulation run {simulation_run_id} not found")
            return {
                "status": "error",
                "message": f"Simulation run {simulation_run_id} not found",
            }

        # Check if cancelled or paused
        if simulation_run.status == "cancelled":
            logger.warning(f"Simulation {simulation_run_id} is cancelled")
            return {
                "status": "cancelled",
                "message": "Simulation was cancelled",
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

        # Update status to running
        with transaction.atomic():
            simulation_run.status = "running"
            if not simulation_run.started_at:
                simulation_run.started_at = timezone.now()
            simulation_run.save()

        # Create simulation engine
        engine = SimulationEngine(simulation_run, max_workers=max_workers)

        # Run simulation (with pause/stop checking)
        result = engine.run()

        # Check if simulation was paused or cancelled during execution
        simulation_run.refresh_from_db()
        if simulation_run.status == "paused":
            logger.info(f"Simulation {simulation_run_id} was paused")
            return {
                "status": "paused",
                "message": "Simulation was paused",
            }
        if simulation_run.status == "cancelled":
            logger.info(f"Simulation {simulation_run_id} was cancelled")
            return {
                "status": "cancelled",
                "message": "Simulation was cancelled",
            }

        # After simulation, run validation and signal analysis
        if result.get("status") == "completed":
            logger.info(
                f"Simulation {simulation_run_id} completed, running validation..."
            )

            try:
                # Get execution data (validation data is now the execution period data)
                from stocks.models import StockTick

                stocks = list(simulation_run.stocks.all())
                validation_data = {}

                if (
                    simulation_run.execution_start_date
                    and simulation_run.execution_end_date
                ):
                    for stock in stocks:
                        execution_ticks = StockTick.objects.filter(
                            stock=stock,
                            timestamp__date__gte=simulation_run.execution_start_date,
                            timestamp__date__lte=simulation_run.execution_end_date,
                        ).order_by("timestamp")

                        from bot_simulations.simulation.data_splitter import (
                            DataSplitter,
                        )

                        splitter = DataSplitter(0.8)  # Dummy ratio, not used
                        validation_data[stock.symbol] = [
                            splitter._tick_to_dict(tick) for tick in execution_ticks
                        ]

                # Check if validation data exists and is not empty
                if not validation_data or not any(validation_data.values()):
                    logger.warning(
                        f"No execution data available for simulation {simulation_run_id}. "
                        f"Skipping validation phase."
                    )
                    validation_data = {}

                # Run validation and analysis for each bot config
                validation_results = []
                signal_results = []

                for bot_config in simulation_run.bot_configs.all():
                    try:
                        # Validation comparison (only if validation data exists)
                        if validation_data:
                            validator = ValidationComparator(
                                bot_config, validation_data
                            )
                            validation_result = validator.compare()
                            validation_results.append(
                                {
                                    "bot_index": bot_config.bot_index,
                                    "result": validation_result,
                                }
                            )
                        else:
                            logger.warning(
                                f"Skipping validation for bot {bot_config.bot_index} - no validation data"
                            )
                            validation_results.append(
                                {
                                    "bot_index": bot_config.bot_index,
                                    "result": {"error": "No validation data available"},
                                }
                            )

                        # Signal productivity analysis
                        analyzer = SignalProductivityAnalyzer(bot_config)
                        signal_result = analyzer.analyze()
                        signal_results.append(
                            {"bot_index": bot_config.bot_index, "result": signal_result}
                        )

                        # Update BotSimulationResult with signal productivity data
                        from bot_simulations.models import BotSimulationResult

                        BotSimulationResult.objects.filter(
                            simulation_config=bot_config
                        ).update(
                            signal_productivity=signal_result.get(
                                "signal_productivity", {}
                            )
                        )
                        logger.info(
                            f"Updated signal productivity for bot {bot_config.bot_index}"
                        )
                    except Exception as e:
                        logger.exception(
                            f"Error analyzing bot {bot_config.bot_index}: {e}"
                        )
                        continue

                # Update simulation run with final status
                with transaction.atomic():
                    simulation_run.status = "completed"
                    simulation_run.completed_at = timezone.now()
                    simulation_run.save()

                logger.info(f"Simulation {simulation_run_id} completed successfully")
                return {
                    "status": "completed",
                    "message": "Simulation completed successfully",
                    "validation": validation_results,
                    "signal_analysis": signal_results,
                }
            except Exception as validation_error:
                # If validation fails, mark simulation as failed
                error_type = type(validation_error).__name__
                error_details = str(validation_error)
                full_error_message = (
                    f"Validation phase failed - {error_type}: {error_details}"
                )

                logger.exception(
                    f"Validation failed for simulation {simulation_run_id}: {full_error_message}"
                )
                with transaction.atomic():
                    simulation_run.status = "failed"
                    simulation_run.error_message = full_error_message
                    simulation_run.save()

                return {
                    "status": "failed",
                    "message": full_error_message,
                }
        else:
            # Simulation failed
            with transaction.atomic():
                simulation_run.status = "failed"
                simulation_run.error_message = result.get("error", "Unknown error")
                simulation_run.save()

            logger.error(
                f"Simulation {simulation_run_id} failed: {result.get('error')}"
            )
            return {
                "status": "failed",
                "message": result.get("error", "Simulation failed"),
            }

    except Exception as exc:
        error_type = type(exc).__name__
        error_details = str(exc)
        full_error_message = f"Task execution failed - {error_type}: {error_details}"

        logger.exception(
            f"Bot simulation task failed: {simulation_run_id} - {full_error_message}"
        )

        # Update simulation run status to failed
        try:
            from bot_simulations.models import BotSimulationRun

            simulation_run = BotSimulationRun.objects.get(id=simulation_run_id)
            with transaction.atomic():
                simulation_run.status = "failed"
                simulation_run.error_message = full_error_message
                simulation_run.save()
        except (
            BotSimulationRun.DoesNotExist,
            DatabaseError,
            IntegrityError,
        ) as save_error:
            logger.warning(f"Failed to save simulation run error status: {save_error}")

        # Retry the task if we haven't exceeded max retries (only for Celery task)
        if task_instance and hasattr(task_instance, "request"):
            max_retries = getattr(task_instance, "max_retries", 3)
            default_retry_delay = getattr(task_instance, "default_retry_delay", 600)
            if task_instance.request.retries < max_retries:
                logger.info(f"Retrying task in {default_retry_delay} seconds...")
                raise task_instance.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": str(exc),
        }


def _execute_single_bot_simulation_internal(
    simulation_run_id: str, bot_config_id: str, task_instance=None
):
    """
    Internal function to execute simulation for a single bot configuration.
    Can be called directly or via Celery task.

    Args:
        simulation_run_id: UUID of BotSimulationRun instance
        bot_config_id: UUID of BotSimulationConfig instance
        task_instance: Optional Celery task instance (for retries)

    Returns:
        Dict with execution results for this bot
    """
    from decimal import Decimal

    from bot_simulations.models import BotSimulationConfig, BotSimulationRun
    from bot_simulations.simulation.data_splitter import DataSplitter
    from bot_simulations.simulation.day_executor import DayExecutor
    from stocks.models import TradingBotConfig

    try:
        logger.info(
            f"Starting bot simulation: {bot_config_id} for run {simulation_run_id}"
        )

        # Get simulation run and bot config
        try:
            simulation_run = BotSimulationRun.objects.get(id=simulation_run_id)
            bot_sim_config = BotSimulationConfig.objects.get(id=bot_config_id)
        except (BotSimulationRun.DoesNotExist, BotSimulationConfig.DoesNotExist) as e:
            logger.exception(f"Simulation run or bot config not found: {e}")
            return {
                "status": "error",
                "message": f"Simulation run or bot config not found: {e}",
                "bot_config_id": bot_config_id,
            }

        # Check if simulation was cancelled or paused
        simulation_run.refresh_from_db()
        if simulation_run.status in ["cancelled", "paused"]:
            logger.warning(f"Simulation {simulation_run_id} is {simulation_run.status}")
            return {
                "status": simulation_run.status,
                "message": f"Simulation was {simulation_run.status}",
                "bot_config_id": bot_config_id,
            }

        # Update bot config status
        with transaction.atomic():
            bot_sim_config.status = "running"
            bot_sim_config.save()

        # Create temporary TradingBotConfig
        config_json = bot_sim_config.config_json

        # Get enabled indicators/patterns from config_json (set by parameter generator)
        # If not in config_json, try to get from simulation run's config_ranges
        enabled_indicators = config_json.get("enabled_indicators")
        if not enabled_indicators:
            # Try to get indicator groups from simulation run's config_ranges
            indicator_groups = config_json.get("indicator_groups")
            if indicator_groups:
                from bot_simulations.simulation.parameter_generator import (
                    ParameterGenerator,
                )

                generator = ParameterGenerator(simulation_run.config_ranges)
                enabled_indicators = generator._get_indicators_from_groups(
                    indicator_groups
                )

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
            # Try to get pattern groups from config_json and reconstruct patterns
            pattern_groups = config_json.get("pattern_groups")
            if pattern_groups:
                from bot_simulations.simulation.parameter_generator import (
                    PATTERN_GROUPS,
                )

                enabled_patterns = {}
                for group_name in pattern_groups:
                    if group_name in PATTERN_GROUPS:
                        enabled_patterns.update(PATTERN_GROUPS[group_name])

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
        initial_cash = Decimal(str(simulation_run.initial_fund))

        bot_config = TradingBotConfig.objects.create(
            user=simulation_run.user,
            name=f"Sim_{simulation_run.name}_Bot_{bot_sim_config.bot_index}",
            is_active=False,
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

        if not assigned_stocks:
            logger.warning(f"No stocks assigned to bot {bot_sim_config.bot_index}")
            bot_config.delete()
            with transaction.atomic():
                bot_sim_config.status = "failed"
                bot_sim_config.save()
            return {
                "status": "error",
                "message": "No stocks assigned",
                "bot_config_id": bot_config_id,
            }

        # Get execution period
        execution_start_date = simulation_run.execution_start_date
        execution_end_date = simulation_run.execution_end_date

        if not execution_start_date or not execution_end_date:
            logger.error("Execution dates not set")
            bot_config.delete()
            with transaction.atomic():
                bot_sim_config.status = "failed"
                bot_sim_config.save()
            return {
                "status": "error",
                "message": "Execution dates not set",
                "bot_config_id": bot_config_id,
            }

        # Prepare data splitter to get historical data
        data_splitter = DataSplitter(0.8)
        list(simulation_run.stocks.all())

        # Get training data (before execution period)
        training_data = {}
        validation_data = {}
        for stock in assigned_stocks:
            from datetime import date as date_type

            from stocks.models import StockTick

            # Training data (before execution period)
            training_query = StockTick.objects.filter(
                stock=stock, timestamp__date__lt=execution_start_date
            ).order_by("timestamp")
            training_ticks = list(training_query)
            training_data[stock.symbol] = [
                data_splitter._tick_to_dict(tick) for tick in training_ticks
            ]

            # Validation/execution data (during execution period)
            validation_query = StockTick.objects.filter(
                stock=stock,
                timestamp__date__gte=execution_start_date,
                timestamp__date__lte=execution_end_date,
            ).order_by("timestamp")
            validation_ticks = list(validation_query)
            validation_data[stock.symbol] = [
                data_splitter._tick_to_dict(tick) for tick in validation_ticks
            ]

        # Combine training + validation data for full historical context
        combined_historical_data = {}
        for stock in assigned_stocks:
            symbol = stock.symbol
            training_ticks = training_data.get(symbol, [])
            validation_ticks = validation_data.get(symbol, [])
            all_ticks = training_ticks + validation_ticks
            all_ticks.sort(key=lambda t: t.get("timestamp", ""))
            combined_historical_data[symbol] = all_ticks

        # Get date ranges
        all_training_dates = set()
        for stock_data in training_data.values():
            for tick in stock_data:
                if tick.get("date"):
                    all_training_dates.add(date_type.fromisoformat(tick["date"]))

        training_start = (
            min(all_training_dates) if all_training_dates else execution_start_date
        )

        # Determine initial state based on simulation type
        initial_cash = Decimal(str(simulation_run.initial_fund))
        initial_portfolio = None
        if simulation_run.simulation_type == "portfolio":
            # Convert initial_portfolio dict to Decimal values
            initial_portfolio = {
                symbol: Decimal(str(quantity))
                for symbol, quantity in simulation_run.initial_portfolio.items()
            }

        # Create day executor
        daily_executor = DayExecutor(
            bot_config=bot_config,
            price_data=combined_historical_data,
            initial_cash=initial_cash,
            initial_portfolio=initial_portfolio,  # For portfolio-based simulations
            training_mode=False,
            historical_start_date=training_start,
            testing_start_date=execution_start_date,
            daily_execution_mode=True,
            bot_sim_config=bot_sim_config,
        )

        # Execute all days
        execution_result = daily_executor.execute_daily(
            execution_start_date=execution_start_date,
            execution_end_date=execution_end_date,
        )

        # Store daily results
        from bot_simulations.simulation.engine import SimulationEngine

        engine = SimulationEngine(simulation_run)
        daily_results = execution_result.get("daily_results", [])
        engine._store_daily_results(bot_sim_config, daily_results, phase="execution")

        # Calculate and store final result
        engine._calculate_and_store_result(bot_sim_config, execution_result, None)

        # Update bot config status
        with transaction.atomic():
            bot_sim_config.status = "completed"
            bot_sim_config.progress_percentage = Decimal("100.00")
            bot_sim_config.save()

        # Clean up temporary bot config
        bot_config.delete()

        logger.info(f"Bot {bot_sim_config.bot_index} completed successfully")
        return {
            "status": "completed",
            "bot_config_id": bot_config_id,
            "bot_index": bot_sim_config.bot_index,
            "execution_result": execution_result,
        }

    except Exception as exc:
        error_type = type(exc).__name__
        error_details = str(exc)
        full_error_message = f"Bot execution failed - {error_type}: {error_details}"

        logger.exception(
            f"Bot simulation failed: {bot_config_id} - {full_error_message}"
        )

        # Update bot config status to failed
        try:
            from bot_simulations.models import BotSimulationConfig

            bot_sim_config = BotSimulationConfig.objects.get(id=bot_config_id)
            with transaction.atomic():
                bot_sim_config.status = "failed"
                bot_sim_config.save()
        except (
            BotSimulationConfig.DoesNotExist,
            DatabaseError,
            IntegrityError,
        ) as save_error:
            logger.warning(f"Failed to save bot config error status: {save_error}")

        # Retry if we haven't exceeded max retries (only for Celery task)
        if task_instance and hasattr(task_instance, "request"):
            max_retries = getattr(task_instance, "max_retries", 3)
            default_retry_delay = getattr(task_instance, "default_retry_delay", 600)
            if task_instance.request.retries < max_retries:
                logger.info(f"Retrying bot task in {default_retry_delay} seconds...")
                raise task_instance.retry(exc=exc) from exc

        return {
            "status": "error",
            "message": full_error_message,
            "bot_config_id": bot_config_id,
        }


@shared_task(bind=True, max_retries=3, default_retry_delay=600)
def execute_single_bot_simulation(self, simulation_run_id: str, bot_config_id: str):
    """
    Celery task wrapper to execute simulation for a single bot configuration.
    This task is used for parallel execution of multiple bots.

    Args:
        self: Celery task instance (bind=True)
        simulation_run_id: UUID of BotSimulationRun instance
        bot_config_id: UUID of BotSimulationConfig instance

    Returns:
        Dict with execution results for this bot
    """
    return _execute_single_bot_simulation_internal(
        simulation_run_id, bot_config_id, task_instance=self
    )
