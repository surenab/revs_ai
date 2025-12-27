"""
Trading Bot Engine
Main orchestration for trading bot analysis and execution.
"""

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from . import indicators, pattern_detector
from .analyzers import DummyNewsAnalyzer, DummySocialAnalyzer
from .ml_models.models import DummyMLModel, RSIModel, SimpleMovingAverageModel
from .models import (
    BotSignalHistory,
    MLModel,
    Order,
    Stock,
    StockPrice,
    StockTick,
    TradingBotConfig,
    TradingBotExecution,
)
from .risk_manager import RiskManager
from .rule_engine import RuleEvaluator
from .signals import SignalAggregator

logger = logging.getLogger(__name__)


class TradingBot:
    """Main trading bot class that orchestrates analysis and execution."""

    def __init__(self, bot_config: TradingBotConfig):
        """
        Initialize trading bot.

        Args:
            bot_config: TradingBotConfig instance
        """
        self.bot_config = bot_config
        self.user = bot_config.user
        self.risk_manager = RiskManager(bot_config)

    def run_analysis(self, stock: Stock | None = None) -> dict:
        """
        Run analysis for assigned stocks.

        Args:
            stock: Optional specific stock to analyze (if None, analyzes all assigned stocks)

        Returns:
            Dictionary with analysis results
        """
        results = {
            "bot_id": str(self.bot_config.id),
            "bot_name": self.bot_config.name,
            "timestamp": timezone.now(),
            "stocks_analyzed": [],
            "buy_signals": [],
            "sell_signals": [],
            "skipped": [],
        }

        stocks_to_analyze = [stock] if stock else self.bot_config.assigned_stocks.all()

        for stock_item in stocks_to_analyze:
            try:
                analysis = self.analyze_stock(stock_item)
                results["stocks_analyzed"].append(stock_item.symbol)

                # Get current price from price data
                price_data = self._get_price_data(stock_item)
                current_price = None
                if price_data and len(price_data) > 0:
                    current_price = float(price_data[-1].get("close_price", 0))

                # Prepare detailed analysis result with all signal information
                detailed_analysis = {
                    "stock": stock_item.symbol,
                    "stock_name": stock_item.name,
                    "action": analysis["action"],
                    "reason": analysis.get("reason", "No reason provided"),
                    "risk_score": float(analysis["risk_score"])
                    if analysis.get("risk_score")
                    else None,
                    "confidence": float(
                        analysis.get("aggregated_signal", {}).get("confidence", 0.0)
                    ),
                    "current_price": current_price,
                    "indicators": self._serialize_indicators(
                        analysis.get("indicators", {})
                    ),
                    "patterns": analysis.get("patterns", []),
                    "ml_signals": analysis.get("ml_signals", []),
                    "social_signals": analysis.get("social_signals"),
                    "news_signals": analysis.get("news_signals"),
                    "aggregated_signal": analysis.get("aggregated_signal", {}),
                    "position_size": analysis.get("position_size"),
                    "decision_details": {
                        "action_scores": analysis.get("aggregated_signal", {}).get(
                            "action_scores", {}
                        ),
                        "signals_used": analysis.get("aggregated_signal", {}).get(
                            "signals_used", 0
                        ),
                        "aggregation_method": analysis.get("aggregated_signal", {}).get(
                            "aggregation_method", "unknown"
                        ),
                        "risk_override": analysis.get("aggregated_signal", {}).get(
                            "risk_override", False
                        ),
                        "position_scale_factor": analysis.get(
                            "aggregated_signal", {}
                        ).get("position_scale_factor", 1.0),
                        "risk_score_threshold": float(
                            self.bot_config.risk_score_threshold
                        )
                        if self.bot_config.risk_score_threshold
                        else 80.0,
                    },
                }

                if analysis["action"] == "buy":
                    results["buy_signals"].append(detailed_analysis)
                elif analysis["action"] == "sell":
                    results["sell_signals"].append(detailed_analysis)
                else:
                    # Include detailed analysis even for skipped stocks
                    results["skipped"].append(detailed_analysis)
            except Exception as e:
                logger.exception(f"Error analyzing {stock_item.symbol}")
                results["skipped"].append(
                    {
                        "stock": stock_item.symbol,
                        "reason": f"Error: {e!s}",
                        "action": "error",
                    }
                )

        return results

    def analyze_stock(self, stock: Stock) -> dict:
        """
        Analyze a single stock using ML models, social/news analysis, indicators, patterns, and signal aggregation.

        Args:
            stock: Stock instance to analyze

        Returns:
            Dictionary with analysis results
        """
        # Get price data
        price_data = self._get_price_data(stock)
        if not price_data:
            return {
                "action": "skip",
                "reason": "No price data available",
                "indicators": {},
                "patterns": [],
                "risk_score": None,
                "ml_signals": [],
                "social_signals": {},
                "news_signals": {},
            }

        # Calculate indicators
        indicators_data = self._calculate_indicators(price_data)

        # Detect patterns
        patterns = self._detect_patterns(price_data)

        # Get ML model predictions
        ml_signals = self._get_ml_predictions(stock, price_data, indicators_data)

        # Analyze social media sentiment
        social_signals = self._analyze_social_media(stock)

        # Analyze news sentiment
        news_signals = self._analyze_news(stock)

        # Calculate preliminary risk score (before position sizing)
        current_price = (
            self._to_decimal(price_data[-1].get("close_price")) if price_data else None
        )
        preliminary_risk_score = None
        if current_price:
            # Use a default quantity for preliminary risk calculation
            default_quantity = Decimal("1.0")
            preliminary_risk_score = float(
                self.risk_manager.calculate_risk_score(
                    stock, current_price, default_quantity
                )
            )

        # Aggregate all signals with risk adjustment
        signal_config = {
            "method": self.bot_config.signal_aggregation_method or "weighted_average",
            "weights": self.bot_config.signal_weights or {},
            "ml_model_weights": self.bot_config.ml_model_weights or {},
            "thresholds": self.bot_config.signal_thresholds or {},
            "risk_score_threshold": float(self.bot_config.risk_score_threshold)
            if self.bot_config.risk_score_threshold
            else 80.0,
            "risk_adjustment_factor": float(self.bot_config.risk_adjustment_factor)
            if self.bot_config.risk_adjustment_factor
            else 0.40,
            "risk_based_position_scaling": self.bot_config.risk_based_position_scaling,
        }

        aggregator = SignalAggregator(signal_config)
        aggregated_result = aggregator.aggregate_signals(
            ml_signals=ml_signals,
            social_signals=social_signals,
            news_signals=news_signals,
            indicator_signals=self._convert_indicators_to_signals(
                indicators_data, price_data
            ),
            pattern_signals=[p.to_dict() for p in patterns],
            risk_score=preliminary_risk_score,
        )

        # Calculate final position size based on risk parameters
        final_position_size = None
        final_risk_score = preliminary_risk_score

        if current_price and aggregated_result["action"] in ["buy", "sell"]:
            # Calculate position size
            stop_loss_price = None
            if (
                self.bot_config.stop_loss_percent
                and aggregated_result["action"] == "buy"
            ):
                stop_loss_pct = self.bot_config.stop_loss_percent / Decimal("100.00")
                stop_loss_price = current_price * (Decimal("1.00") - stop_loss_pct)

            if aggregated_result["action"] == "buy":
                calculated_size = self.risk_manager.calculate_position_size(
                    stock, current_price, stop_loss_price
                )
                # Apply risk-based position scaling
                scale_factor = aggregated_result.get("position_scale_factor", 1.0)
                final_position_size = calculated_size * Decimal(str(scale_factor))
                # Recalculate risk score with actual position size
                final_risk_score = float(
                    self.risk_manager.calculate_risk_score(
                        stock, current_price, final_position_size
                    )
                )
            else:
                # For sell, get existing position
                bot_positions = self.risk_manager._get_bot_positions(stock)  # noqa: SLF001
                final_position_size = sum(pos.quantity for pos in bot_positions)
                if final_position_size > 0:
                    final_risk_score = float(
                        self.risk_manager.calculate_risk_score(
                            stock, current_price, final_position_size
                        )
                    )

        # Apply risk-based decision modifiers
        if (
            final_risk_score
            and final_risk_score > signal_config["risk_score_threshold"]
        ):
            aggregated_result["action"] = "hold"
            aggregated_result["reason"] = (
                f"Risk score {final_risk_score:.2f} exceeds threshold {signal_config['risk_score_threshold']}"
            )
            aggregated_result["confidence"] = 0.0

        # Determine final action
        final_action = aggregated_result.get("action", "hold")
        if final_action == "hold":
            final_action = "skip"

        # Store signal history
        self._store_signal_history(
            stock=stock,
            price_data=price_data,
            ml_signals=ml_signals,
            social_signals=social_signals,
            news_signals=news_signals,
            indicator_signals=self._convert_indicators_to_signals(
                indicators_data, price_data
            ),
            pattern_signals=[p.to_dict() for p in patterns],
            aggregated_signal=aggregated_result,
            final_decision=final_action,
            decision_confidence=aggregated_result.get("confidence", 0.0),
            risk_score=final_risk_score,
        )

        # Prepare result
        return {
            "action": final_action,
            "reason": aggregated_result.get("reason", "Signal aggregation result"),
            "indicators": indicators_data,
            "patterns": [p.to_dict() for p in patterns],
            "risk_score": Decimal(str(final_risk_score)) if final_risk_score else None,
            "ml_signals": ml_signals,
            "social_signals": social_signals,
            "news_signals": news_signals,
            "aggregated_signal": aggregated_result,
            "position_size": float(final_position_size)
            if final_position_size
            else None,
        }

    def evaluate_buy_signals(
        self,
        price_data: list[dict],
        indicators_data: dict,
        patterns: list[pattern_detector.PatternMatch],
    ) -> dict:
        """
        Evaluate buy rules.

        Args:
            price_data: List of price data
            indicators_data: Calculated indicators
            patterns: Detected patterns

        Returns:
            Dictionary with should_buy, reason, etc.
        """
        if not self.bot_config.buy_rules:
            return {"should_buy": False, "reason": "No buy rules configured"}

        # Create rule evaluator
        evaluator = RuleEvaluator(price_data, indicators_data, patterns)

        # Evaluate buy rules
        buy_condition_met = evaluator.evaluate_rule(self.bot_config.buy_rules)

        if not buy_condition_met:
            return {"should_buy": False, "reason": "Buy rules not satisfied"}

        # Get current price
        if not price_data:
            return {"should_buy": False, "reason": "No price data"}

        latest_price_data = price_data[-1]
        current_price = self._to_decimal(latest_price_data.get("close_price"))

        if current_price is None:
            return {"should_buy": False, "reason": "Invalid price data"}

        # Validate trade with risk manager
        stock = Stock.objects.get(symbol=latest_price_data.get("symbol"))
        is_valid, reason = self.risk_manager.validate_trade(
            stock, "buy", price=current_price
        )

        if not is_valid:
            return {"should_buy": False, "reason": reason}

        # Calculate risk score
        quantity = self.risk_manager.calculate_position_size(stock, current_price)
        risk_score = self.risk_manager.calculate_risk_score(
            stock, current_price, quantity
        )

        return {
            "should_buy": True,
            "reason": "Buy rules satisfied and risk validated",
            "risk_score": risk_score,
        }

    def evaluate_sell_signals(  # noqa: PLR0911
        self,
        price_data: list[dict],
        indicators_data: dict,
        patterns: list[pattern_detector.PatternMatch],
        stock: Stock,
    ) -> dict:
        """
        Evaluate sell rules for existing positions.

        Args:
            price_data: List of price data
            indicators_data: Calculated indicators
            patterns: Detected patterns
            stock: Stock instance

        Returns:
            Dictionary with should_sell, reason, etc.
        """
        # Check if bot has position in this stock
        bot_positions = self.risk_manager._get_bot_positions(stock)  # noqa: SLF001
        if not bot_positions:
            return {"should_sell": False, "reason": "No position to sell"}

        if not self.bot_config.sell_rules:
            return {"should_sell": False, "reason": "No sell rules configured"}

        # Create rule evaluator
        evaluator = RuleEvaluator(price_data, indicators_data, patterns)

        # Evaluate sell rules
        sell_condition_met = evaluator.evaluate_rule(self.bot_config.sell_rules)

        if not sell_condition_met:
            return {"should_sell": False, "reason": "Sell rules not satisfied"}

        # Get current price
        if not price_data:
            return {"should_sell": False, "reason": "No price data"}

        latest_price_data = price_data[-1]
        current_price = self._to_decimal(latest_price_data.get("close_price"))

        if current_price is None:
            return {"should_sell": False, "reason": "Invalid price data"}

        # Check stop loss / take profit
        total_quantity = sum(pos.quantity for pos in bot_positions)
        avg_purchase_price = sum(
            pos.purchase_price * pos.quantity for pos in bot_positions
        ) / sum(pos.quantity for pos in bot_positions)

        # Check stop loss
        if self.bot_config.stop_loss_percent:
            stop_loss_pct = self.bot_config.stop_loss_percent / Decimal("100.00")
            stop_loss_price = avg_purchase_price * (Decimal("1.00") - stop_loss_pct)
            if current_price <= stop_loss_price:
                return {
                    "should_sell": True,
                    "reason": f"Stop loss triggered at {current_price} (stop loss: {stop_loss_price})",
                    "risk_score": Decimal("100.00"),  # High risk
                }

        # Check take profit
        if self.bot_config.take_profit_percent:
            take_profit_pct = self.bot_config.take_profit_percent / Decimal("100.00")
            take_profit_price = avg_purchase_price * (Decimal("1.00") + take_profit_pct)
            if current_price >= take_profit_price:
                return {
                    "should_sell": True,
                    "reason": f"Take profit triggered at {current_price} (target: {take_profit_price})",
                    "risk_score": Decimal("0.00"),  # Low risk
                }

        # Validate trade with risk manager
        is_valid, reason = self.risk_manager.validate_trade(
            stock, "sell", price=current_price
        )

        if not is_valid:
            return {"should_sell": False, "reason": reason}

        # Calculate risk score
        risk_score = self.risk_manager.calculate_risk_score(
            stock, current_price, total_quantity
        )

        return {
            "should_sell": True,
            "reason": "Sell rules satisfied and risk validated",
            "risk_score": risk_score,
        }

    @transaction.atomic
    def execute_trade(
        self, stock: Stock, action: str, analysis_result: dict
    ) -> Order | None:
        """
        Execute a trade based on analysis result.

        Args:
            stock: Stock instance
            action: "buy" or "sell"
            analysis_result: Result from analyze_stock()

        Returns:
            Created Order instance or None if failed
        """
        if action not in ["buy", "sell"]:
            logger.error(f"Invalid action: {action}")
            return None

        # Get current price
        latest_price = stock.latest_price
        if not latest_price:
            logger.error(f"No price data for {stock.symbol}")
            return None

        current_price = latest_price.close_price

        # Calculate quantity
        if action == "buy":
            stop_loss_price = None
            if self.bot_config.stop_loss_percent:
                stop_loss_pct = self.bot_config.stop_loss_percent / Decimal("100.00")
                stop_loss_price = current_price * (Decimal("1.00") - stop_loss_pct)
            quantity = self.risk_manager.calculate_position_size(
                stock, current_price, stop_loss_price
            )
        else:
            # For sell, get existing position quantity
            bot_positions = self.risk_manager._get_bot_positions(stock)  # noqa: SLF001
            quantity = sum(pos.quantity for pos in bot_positions)

        # Validate trade
        is_valid, reason = self.risk_manager.validate_trade(
            stock, action, quantity, current_price
        )
        if not is_valid:
            logger.warning(f"Trade validation failed: {reason}")
            return None

        # Create order
        order = Order.objects.create(
            user=self.user,
            stock=stock,
            transaction_type=action,
            order_type="market",
            quantity=quantity,
            bot_config=self.bot_config,
            notes=f"Auto-traded by bot: {self.bot_config.name}. {analysis_result.get('reason', '')}",
        )

        # Execute order
        executed = order.execute()
        if not executed:
            logger.error(f"Order execution failed for {stock.symbol}")
            order.delete()
            return None

        # Create execution record
        patterns_data = analysis_result.get("patterns", [])
        if isinstance(patterns_data, list):
            # Store all patterns with unique keys to preserve duplicates
            patterns_dict = {
                f"{p.get('pattern', 'pattern')}_{idx}": p
                for idx, p in enumerate(patterns_data)
            }
        else:
            patterns_dict = patterns_data

        TradingBotExecution.objects.create(
            bot_config=self.bot_config,
            stock=stock,
            action=action,
            reason=analysis_result.get("reason", ""),
            indicators_data=analysis_result.get("indicators", {}),
            patterns_detected=patterns_dict,
            risk_score=analysis_result.get("risk_score"),
            executed_order=order,
        )

        # Update signal history with execution reference
        try:
            latest_signal_history = (
                BotSignalHistory.objects.filter(bot_config=self.bot_config, stock=stock)
                .order_by("-timestamp")
                .first()
            )
            if latest_signal_history:
                latest_signal_history.execution = (
                    TradingBotExecution.objects.filter(
                        bot_config=self.bot_config, stock=stock, executed_order=order
                    )
                    .order_by("-timestamp")
                    .first()
                )
                latest_signal_history.save()
        except Exception:
            logger.exception("Error updating signal history with execution")

        logger.info(
            f"Bot {self.bot_config.name} executed {action} order for {stock.symbol}: {quantity} shares @ {current_price}"
        )

        return order

    def _get_price_data(self, stock: Stock, limit: int = 200) -> list[dict]:
        """Get price data for stock (last N days)."""
        prices = StockPrice.objects.filter(stock=stock, interval="1d").order_by(
            "-date"
        )[:limit]

        return [
            {
                "symbol": stock.symbol,
                "open_price": price.open_price,
                "high_price": price.high_price,
                "low_price": price.low_price,
                "close_price": price.close_price,
                "volume": price.volume,
                "date": price.date.isoformat() if price.date else None,
            }
            for price in reversed(prices)  # Reverse to get chronological order
        ]

    def _get_last_day_tick_data(self, stock: Stock) -> list[dict]:
        """Get tick data for the last trading day."""
        from datetime import datetime

        # Get the last trading day (today or most recent day with data)
        last_price = (
            StockPrice.objects.filter(stock=stock, interval="1d")
            .order_by("-date")
            .first()
        )
        if not last_price or not last_price.date:
            return []

        # Get tick data for the last trading day
        start_of_day = timezone.make_aware(
            datetime.combine(last_price.date, datetime.min.time())
        )
        end_of_day = start_of_day + timedelta(days=1)

        ticks = (
            StockTick.objects.filter(
                stock=stock, timestamp__gte=start_of_day, timestamp__lt=end_of_day
            )
            .order_by("timestamp")
            .values(
                "price",
                "volume",
                "bid_price",
                "ask_price",
                "bid_size",
                "ask_size",
                "timestamp",
            )
        )

        return [
            {
                "price": float(tick["price"]) if tick["price"] else None,
                "volume": tick["volume"],
                "bid_price": float(tick["bid_price"]) if tick["bid_price"] else None,
                "ask_price": float(tick["ask_price"]) if tick["ask_price"] else None,
                "bid_size": tick["bid_size"],
                "ask_size": tick["ask_size"],
                "timestamp": tick["timestamp"].isoformat()
                if tick["timestamp"]
                else None,
            }
            for tick in ticks
        ]

    def _calculate_indicators(self, price_data: list[dict]) -> dict:  # noqa: PLR0912, PLR0915
        """Calculate indicators based on bot configuration."""
        indicators_data = {}

        if not price_data or len(price_data) < 2:
            logger.warning("Insufficient price data for indicator calculation")
            return indicators_data

        enabled_indicators = self.bot_config.enabled_indicators or {}

        # If no indicators are enabled, return empty dict
        if not enabled_indicators:
            return indicators_data

        try:
            # Moving Averages
            if "sma" in enabled_indicators:
                period = enabled_indicators.get("sma", {}).get("period", 20)
                indicators_data[f"sma_{period}"] = indicators.calculate_sma(
                    price_data, period
                )

            if "ema" in enabled_indicators:
                period = enabled_indicators.get("ema", {}).get("period", 20)
                indicators_data[f"ema_{period}"] = indicators.calculate_ema(
                    price_data, period
                )

            if "wma" in enabled_indicators:
                period = enabled_indicators.get("wma", {}).get("period", 20)
                indicators_data[f"wma_{period}"] = indicators.calculate_wma(
                    price_data, period
                )

            if "dema" in enabled_indicators:
                period = enabled_indicators.get("dema", {}).get("period", 20)
                indicators_data[f"dema_{period}"] = indicators.calculate_dema(
                    price_data, period
                )

            if "tema" in enabled_indicators:
                period = enabled_indicators.get("tema", {}).get("period", 20)
                indicators_data[f"tema_{period}"] = indicators.calculate_tema(
                    price_data, period
                )

            if "tma" in enabled_indicators:
                period = enabled_indicators.get("tma", {}).get("period", 20)
                indicators_data[f"tma_{period}"] = indicators.calculate_tma(
                    price_data, period
                )

            if "hma" in enabled_indicators:
                period = enabled_indicators.get("hma", {}).get("period", 20)
                indicators_data[f"hma_{period}"] = indicators.calculate_hma(
                    price_data, period
                )

            if "mcginley" in enabled_indicators:
                period = enabled_indicators.get("mcginley", {}).get("period", 14)
                indicators_data[f"mcginley_{period}"] = indicators.calculate_mcginley(
                    price_data, period
                )

            if "vwap_ma" in enabled_indicators:
                period = enabled_indicators.get("vwap_ma", {}).get("period", 20)
                indicators_data[f"vwap_ma_{period}"] = indicators.calculate_vwap_ma(
                    price_data, period
                )

            # Bands & Channels
            if (
                "bollinger" in enabled_indicators
                or "bollinger_bands" in enabled_indicators
            ):
                period = enabled_indicators.get(
                    "bollinger", enabled_indicators.get("bollinger_bands", {})
                ).get("period", 20)
                bb_data = indicators.calculate_bollinger_bands(price_data, period)
                indicators_data["bb_upper"] = bb_data["upper"]
                indicators_data["bb_middle"] = bb_data["middle"]
                indicators_data["bb_lower"] = bb_data["lower"]

            if "bollinger_upper" in enabled_indicators:
                period = enabled_indicators.get("bollinger_upper", {}).get("period", 20)
                bb_data = indicators.calculate_bollinger_bands(price_data, period)
                indicators_data["bb_upper"] = bb_data["upper"]

            if "bollinger_middle" in enabled_indicators:
                period = enabled_indicators.get("bollinger_middle", {}).get(
                    "period", 20
                )
                bb_data = indicators.calculate_bollinger_bands(price_data, period)
                indicators_data["bb_middle"] = bb_data["middle"]

            if "bollinger_lower" in enabled_indicators:
                period = enabled_indicators.get("bollinger_lower", {}).get("period", 20)
                bb_data = indicators.calculate_bollinger_bands(price_data, period)
                indicators_data["bb_lower"] = bb_data["lower"]

            if "keltner" in enabled_indicators:
                period = enabled_indicators.get("keltner", {}).get("period", 20)
                multiplier = enabled_indicators.get("keltner", {}).get(
                    "multiplier", 2.0
                )
                kc_data = indicators.calculate_keltner_channels(
                    price_data, period, multiplier
                )
                indicators_data["keltner_upper"] = kc_data["upper"]
                indicators_data["keltner_middle"] = kc_data["middle"]
                indicators_data["keltner_lower"] = kc_data["lower"]

            if "donchian" in enabled_indicators:
                period = enabled_indicators.get("donchian", {}).get("period", 20)
                dc_data = indicators.calculate_donchian_channels(price_data, period)
                indicators_data["donchian_upper"] = dc_data["upper"]
                indicators_data["donchian_middle"] = dc_data["middle"]
                indicators_data["donchian_lower"] = dc_data["lower"]

            if "fractal" in enabled_indicators:
                period = enabled_indicators.get("fractal", {}).get("period", 5)
                fb_data = indicators.calculate_fractal_bands(price_data, period)
                indicators_data["fractal_upper"] = fb_data["upper"]
                indicators_data["fractal_lower"] = fb_data["lower"]

            # Oscillators
            if "rsi" in enabled_indicators:
                period = enabled_indicators.get("rsi", {}).get("period", 14)
                indicators_data[f"rsi_{period}"] = indicators.calculate_rsi(
                    price_data, period
                )

            if "adx" in enabled_indicators:
                period = enabled_indicators.get("adx", {}).get("period", 14)
                adx_data = indicators.calculate_adx(price_data, period)
                indicators_data["adx"] = adx_data["adx"]
                indicators_data["adx_plus_di"] = adx_data["plus_di"]
                indicators_data["adx_minus_di"] = adx_data["minus_di"]

            if "cci" in enabled_indicators:
                period = enabled_indicators.get("cci", {}).get("period", 20)
                indicators_data[f"cci_{period}"] = indicators.calculate_cci(
                    price_data, period
                )

            if "mfi" in enabled_indicators:
                period = enabled_indicators.get("mfi", {}).get("period", 14)
                indicators_data[f"mfi_{period}"] = indicators.calculate_mfi(
                    price_data, period
                )

            if "macd" in enabled_indicators:
                fast = enabled_indicators.get("macd", {}).get("fast_period", 12)
                slow = enabled_indicators.get("macd", {}).get("slow_period", 26)
                signal = enabled_indicators.get("macd", {}).get("signal_period", 9)
                macd_data = indicators.calculate_macd(price_data, fast, slow, signal)
                indicators_data["macd"] = macd_data["macd"]
                indicators_data["macd_signal"] = macd_data["signal"]
                indicators_data["macd_histogram"] = macd_data["histogram"]

            if "williams_r" in enabled_indicators:
                period = enabled_indicators.get("williams_r", {}).get("period", 14)
                indicators_data[f"williams_r_{period}"] = (
                    indicators.calculate_williams_r(price_data, period)
                )

            if "momentum" in enabled_indicators:
                period = enabled_indicators.get("momentum", {}).get("period", 10)
                indicators_data[f"momentum_{period}"] = indicators.calculate_momentum(
                    price_data, period
                )

            if "proc" in enabled_indicators:
                period = enabled_indicators.get("proc", {}).get("period", 12)
                indicators_data[f"proc_{period}"] = indicators.calculate_proc(
                    price_data, period
                )

            if "obv" in enabled_indicators:
                indicators_data["obv"] = indicators.calculate_obv(price_data)

            if "stochastic" in enabled_indicators:
                k_period = enabled_indicators.get("stochastic", {}).get("k_period", 14)
                d_period = enabled_indicators.get("stochastic", {}).get("d_period", 3)
                stoch_data = indicators.calculate_stochastic(
                    price_data, k_period, d_period
                )
                indicators_data["stochastic_k"] = stoch_data["k"]
                indicators_data["stochastic_d"] = stoch_data["d"]

            # Other Indicators
            if "vwap" in enabled_indicators:
                indicators_data["vwap"] = indicators.calculate_vwap(price_data)

            if "atr" in enabled_indicators:
                period = enabled_indicators.get("atr", {}).get("period", 14)
                indicators_data[f"atr_{period}"] = indicators.calculate_atr(
                    price_data, period
                )

            if "atr_trailing" in enabled_indicators:
                period = enabled_indicators.get("atr_trailing", {}).get("period", 14)
                multiplier = enabled_indicators.get("atr_trailing", {}).get(
                    "multiplier", 2.0
                )
                indicators_data[f"atr_trailing_{period}"] = (
                    indicators.calculate_atr_trailing_stop(
                        price_data, period, multiplier
                    )
                )

            if "psar" in enabled_indicators or "parabolic_sar" in enabled_indicators:
                accel = enabled_indicators.get(
                    "psar", enabled_indicators.get("parabolic_sar", {})
                ).get("acceleration", 0.02)
                maximum = enabled_indicators.get(
                    "psar", enabled_indicators.get("parabolic_sar", {})
                ).get("maximum", 0.20)
                indicators_data["psar"] = indicators.calculate_parabolic_sar(
                    price_data, accel, maximum
                )

            if "supertrend" in enabled_indicators:
                period = enabled_indicators.get("supertrend", {}).get("period", 10)
                multiplier = enabled_indicators.get("supertrend", {}).get(
                    "multiplier", 3.0
                )
                st_data = indicators.calculate_supertrend(
                    price_data, period, multiplier
                )
                indicators_data["supertrend"] = st_data["supertrend"]
                indicators_data["supertrend_trend"] = st_data["trend"]

            if "alligator" in enabled_indicators:
                jaw = enabled_indicators.get("alligator", {}).get("jaw_period", 13)
                teeth = enabled_indicators.get("alligator", {}).get("teeth_period", 8)
                lips = enabled_indicators.get("alligator", {}).get("lips_period", 5)
                alligator_data = indicators.calculate_alligator(
                    price_data, jaw, teeth, lips
                )
                indicators_data["alligator_jaw"] = alligator_data["jaw"]
                indicators_data["alligator_teeth"] = alligator_data["teeth"]
                indicators_data["alligator_lips"] = alligator_data["lips"]

            if "ichimoku" in enabled_indicators:
                tenkan = enabled_indicators.get("ichimoku", {}).get("tenkan_period", 9)
                kijun = enabled_indicators.get("ichimoku", {}).get("kijun_period", 26)
                senkou_b = enabled_indicators.get("ichimoku", {}).get(
                    "senkou_b_period", 52
                )
                ichimoku_data = indicators.calculate_ichimoku(
                    price_data, tenkan, kijun, senkou_b
                )
                indicators_data["ichimoku_tenkan"] = ichimoku_data["tenkan"]
                indicators_data["ichimoku_kijun"] = ichimoku_data["kijun"]
                indicators_data["ichimoku_senkou_a"] = ichimoku_data["senkou_a"]
                indicators_data["ichimoku_senkou_b"] = ichimoku_data["senkou_b"]
                indicators_data["ichimoku_chikou"] = ichimoku_data["chikou"]

            if "linear_regression" in enabled_indicators:
                period = enabled_indicators.get("linear_regression", {}).get(
                    "period", 14
                )
                indicators_data[f"linear_regression_{period}"] = (
                    indicators.calculate_linear_regression(price_data, period)
                )

            if "pivot_points" in enabled_indicators:
                pivot_data = indicators.calculate_pivot_points(price_data)
                indicators_data["pivot"] = pivot_data["pivot"]
                indicators_data["pivot_r1"] = pivot_data["r1"]
                indicators_data["pivot_r2"] = pivot_data["r2"]
                indicators_data["pivot_r3"] = pivot_data["r3"]
                indicators_data["pivot_s1"] = pivot_data["s1"]
                indicators_data["pivot_s2"] = pivot_data["s2"]
                indicators_data["pivot_s3"] = pivot_data["s3"]
        except Exception:
            logger.exception("Error calculating indicators")
            # Return empty dict on error to prevent further issues

        return indicators_data

    def _detect_patterns(
        self, price_data: list[dict]
    ) -> list[pattern_detector.PatternMatch]:
        """Detect patterns based on bot configuration."""
        enabled_patterns = self.bot_config.enabled_patterns or {}

        # If no patterns are enabled, return empty list
        if not enabled_patterns:
            return []

        pattern_ids = list(enabled_patterns.keys())
        logger.info(f"Attempting to detect {len(pattern_ids)} patterns: {pattern_ids}")

        all_detected = pattern_detector.detect_all_patterns(price_data, pattern_ids)
        logger.info(f"Pattern detection returned {len(all_detected)} matches")

        # Filter patterns by min_confidence if specified
        filtered_patterns = []
        for pattern in all_detected:
            pattern_config = enabled_patterns.get(pattern.pattern, {})
            min_confidence = pattern_config.get("min_confidence", 0.0)

            # Include pattern if it meets the confidence threshold
            if pattern.confidence >= min_confidence:
                filtered_patterns.append(pattern)
            else:
                logger.debug(
                    f"Pattern {pattern.pattern} filtered out: "
                    f"confidence {pattern.confidence:.2f} < min {min_confidence:.2f}"
                )

        logger.info(
            f"Detected {len(all_detected)} patterns, "
            f"{len(filtered_patterns)} passed confidence threshold"
        )

        return filtered_patterns

    def _get_ml_predictions(
        self, stock: Stock, price_data: list[dict], indicators_data: dict
    ) -> list[dict]:
        """Get ML model predictions."""
        ml_signals = []

        enabled_ml_models = self.bot_config.enabled_ml_models or []
        if not enabled_ml_models:
            return ml_signals

        for model_id in enabled_ml_models:
            try:
                # Try to get model from database
                db_model = MLModel.objects.filter(id=model_id, is_active=True).first()
                if not db_model:
                    logger.warning(f"ML model {model_id} not found or inactive")
                    continue

                # For now, use dummy models based on framework
                # In production, this would load actual trained models
                if db_model.framework == "custom":
                    if "sma" in db_model.name.lower():
                        model = SimpleMovingAverageModel()
                    elif "rsi" in db_model.name.lower():
                        model = RSIModel()
                    else:
                        model = DummyMLModel()
                else:
                    model = DummyMLModel()

                prediction = model.predict(stock, price_data, indicators_data)
                if prediction:
                    prediction["model_id"] = str(model_id)
                    prediction["model_name"] = db_model.name
                    ml_signals.append(prediction)
            except Exception:
                logger.exception(f"Error getting prediction from model {model_id}")

        return ml_signals

    def _analyze_social_media(self, stock: Stock) -> dict | None:
        """Analyze social media sentiment."""
        if not self.bot_config.enable_social_analysis:
            return None

        try:
            analyzer = DummySocialAnalyzer()
            result = analyzer.analyze_stock(stock.symbol)
            result["metadata"]["timestamp"] = timezone.now().isoformat()
        except Exception:
            logger.exception(f"Error analyzing social media for {stock.symbol}")
            return None
        else:
            return result

    def _analyze_news(self, stock: Stock) -> dict | None:
        """Analyze news sentiment."""
        if not self.bot_config.enable_news_analysis:
            return None

        try:
            analyzer = DummyNewsAnalyzer()
            result = analyzer.analyze_stock(stock.symbol)
            result["metadata"]["timestamp"] = timezone.now().isoformat()
        except Exception:
            logger.exception(f"Error analyzing news for {stock.symbol}")
            return None
        return result

    def _convert_indicators_to_signals(
        self, indicators_data: dict, price_data: list[dict]
    ) -> list[dict]:
        """Convert indicator values to signal format using comprehensive signal conversion."""
        from .indicator_signals import convert_indicator_to_signal

        signals = []

        if not price_data or not indicators_data:
            return signals

        # Convert all indicators to signals
        for key, value in indicators_data.items():
            try:
                signal = convert_indicator_to_signal(
                    indicator_key=key,
                    indicator_value=value,
                    bot_config=self.bot_config,
                    price_data=price_data,
                    indicators_data=indicators_data,
                )

                if signal:
                    signal["name"] = key
                    signals.append(signal)
            except (ValueError, TypeError, KeyError) as e:
                logger.warning(
                    f"Error converting indicator {key} to signal: {e}",
                    exc_info=True,
                )
                continue

        return signals

    def _store_signal_history(
        self,
        stock: Stock,
        price_data: list[dict],
        ml_signals: list[dict],
        social_signals: dict | None,
        news_signals: dict | None,
        indicator_signals: list[dict],
        pattern_signals: list[dict],
        aggregated_signal: dict,
        final_decision: str,
        decision_confidence: float,
        risk_score: float | None,
    ) -> None:
        """Store signal history for transparency."""
        try:
            tick_data = self._get_last_day_tick_data(stock)
            BotSignalHistory.objects.create(
                bot_config=self.bot_config,
                stock=stock,
                price_data_snapshot={
                    "latest": self._serialize_price_data(price_data[-1])
                    if price_data
                    else {},
                    "count": len(price_data),
                    "tick_data": tick_data,
                    "tick_count": len(tick_data),
                },
                ml_signals={"predictions": ml_signals, "count": len(ml_signals)},
                social_signals=social_signals or {},
                news_signals=news_signals or {},
                indicator_signals={
                    "signals": indicator_signals,
                    "count": len(indicator_signals),
                },
                pattern_signals={
                    "patterns": pattern_signals,
                    "count": len(pattern_signals),
                },
                aggregated_signal=aggregated_signal,
                final_decision=final_decision,
                decision_confidence=Decimal(str(decision_confidence))
                * Decimal("100.0"),
                risk_score=Decimal(str(risk_score)) if risk_score else None,
            )
        except Exception:
            logger.exception("Error storing signal history")

    def _serialize_indicators(self, indicators_data: dict) -> dict:
        """Serialize indicators data for JSON response."""
        serialized = {}
        for key, value in indicators_data.items():
            if isinstance(value, list):
                # Get the last value (most recent) and last 10 values
                if value and len(value) > 0:
                    serialized[key] = {
                        "current": float(value[-1]) if value[-1] is not None else None,
                        "values": [
                            float(v) if v is not None else None for v in value[-10:]
                        ]
                        if len(value) > 10
                        else [float(v) if v is not None else None for v in value],
                    }
                else:
                    serialized[key] = {"current": None, "values": []}
            elif isinstance(value, int | float | Decimal):
                serialized[key] = float(value)
            else:
                serialized[key] = value
        return serialized

    def _to_decimal(self, value) -> Decimal | None:
        """Convert value to Decimal."""
        if value is None:
            return None
        if isinstance(value, Decimal):
            return value
        try:
            return Decimal(str(value))
        except (ValueError, TypeError):
            return None

    def _serialize_price_data(self, price_data: dict) -> dict:
        """Serialize price data for JSON storage (convert Decimal to float)."""
        if not price_data:
            return {}
        serialized = {}
        for key, value in price_data.items():
            if isinstance(value, Decimal):
                serialized[key] = float(value)
            elif isinstance(value, int | float):
                serialized[key] = value
            elif value is None:
                serialized[key] = None
            else:
                serialized[key] = str(value)  # Convert other types to string
        return serialized
