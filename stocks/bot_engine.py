"""
Trading Bot Engine
Main orchestration for trading bot analysis and execution.
"""

import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from . import indicators, pattern_detector
from .models import (
    Order,
    Stock,
    StockPrice,
    TradingBotConfig,
    TradingBotExecution,
)
from .risk_manager import RiskManager
from .rule_engine import RuleEvaluator

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

                if analysis["action"] == "buy":
                    results["buy_signals"].append(
                        {
                            "stock": stock_item.symbol,
                            "reason": analysis["reason"],
                            "risk_score": float(analysis["risk_score"])
                            if analysis["risk_score"]
                            else None,
                        }
                    )
                elif analysis["action"] == "sell":
                    results["sell_signals"].append(
                        {
                            "stock": stock_item.symbol,
                            "reason": analysis["reason"],
                            "risk_score": float(analysis["risk_score"])
                            if analysis["risk_score"]
                            else None,
                        }
                    )
                else:
                    results["skipped"].append(
                        {"stock": stock_item.symbol, "reason": analysis["reason"]}
                    )
            except Exception as e:
                logger.exception(f"Error analyzing {stock_item.symbol}")
                results["skipped"].append(
                    {"stock": stock_item.symbol, "reason": f"Error: {e!s}"}
                )

        return results

    def analyze_stock(self, stock: Stock) -> dict:
        """
        Analyze a single stock using indicators, patterns, and rules.

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
            }

        # Calculate indicators
        indicators_data = self._calculate_indicators(price_data)

        # Detect patterns
        patterns = self._detect_patterns(price_data)

        # Evaluate buy signals
        buy_signal = self.evaluate_buy_signals(price_data, indicators_data, patterns)

        # Evaluate sell signals
        sell_signal = self.evaluate_sell_signals(
            price_data, indicators_data, patterns, stock
        )

        # Determine action
        if sell_signal["should_sell"]:
            return {
                "action": "sell",
                "reason": sell_signal["reason"],
                "indicators": indicators_data,
                "patterns": [p.to_dict() for p in patterns],
                "risk_score": sell_signal.get("risk_score"),
            }
        if buy_signal["should_buy"]:
            return {
                "action": "buy",
                "reason": buy_signal["reason"],
                "indicators": indicators_data,
                "patterns": [p.to_dict() for p in patterns],
                "risk_score": buy_signal.get("risk_score"),
            }
        return {
            "action": "skip",
            "reason": "No buy or sell signals detected",
            "indicators": indicators_data,
            "patterns": [p.to_dict() for p in patterns],
            "risk_score": None,
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
        TradingBotExecution.objects.create(
            bot_config=self.bot_config,
            stock=stock,
            action=action,
            reason=analysis_result.get("reason", ""),
            indicators_data=analysis_result.get("indicators", {}),
            patterns_detected={
                p.get("pattern", ""): p for p in analysis_result.get("patterns", [])
            },
            risk_score=analysis_result.get("risk_score"),
            executed_order=order,
        )

        logger.info(
            f"Bot {self.bot_config.name} executed {action} order for {stock.symbol}: {quantity} shares @ {current_price}"
        )

        return order

    def _get_price_data(self, stock: Stock, limit: int = 100) -> list[dict]:
        """Get price data for stock."""
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

    def _calculate_indicators(self, price_data: list[dict]) -> dict:
        """Calculate indicators based on bot configuration."""
        indicators_data = {}

        if not price_data or len(price_data) < 2:
            logger.warning("Insufficient price data for indicator calculation")
            return indicators_data

        enabled_indicators = self.bot_config.enabled_indicators or {}

        try:
            # Calculate common indicators
            if "sma" in enabled_indicators or not enabled_indicators:
                period = enabled_indicators.get("sma", {}).get("period", 20)
                indicators_data[f"sma_{period}"] = indicators.calculate_sma(
                    price_data, period
                )

            if "ema" in enabled_indicators or not enabled_indicators:
                period = enabled_indicators.get("ema", {}).get("period", 20)
                indicators_data[f"ema_{period}"] = indicators.calculate_ema(
                    price_data, period
                )

            if "rsi" in enabled_indicators or not enabled_indicators:
                period = enabled_indicators.get("rsi", {}).get("period", 14)
                indicators_data[f"rsi_{period}"] = indicators.calculate_rsi(
                    price_data, period
                )

            if "macd" in enabled_indicators or not enabled_indicators:
                macd_data = indicators.calculate_macd(price_data, 12, 26, 9)
                indicators_data["macd"] = macd_data["macd"]
                indicators_data["macd_signal"] = macd_data["signal"]
                indicators_data["macd_histogram"] = macd_data["histogram"]

            if "bollinger_bands" in enabled_indicators or not enabled_indicators:
                period = enabled_indicators.get("bollinger_bands", {}).get("period", 20)
                bb_data = indicators.calculate_bollinger_bands(price_data, period)
                indicators_data["bb_upper"] = bb_data["upper"]
                indicators_data["bb_middle"] = bb_data["middle"]
                indicators_data["bb_lower"] = bb_data["lower"]

            if "atr" in enabled_indicators or not enabled_indicators:
                period = enabled_indicators.get("atr", {}).get("period", 14)
                indicators_data[f"atr_{period}"] = indicators.calculate_atr(
                    price_data, period
                )
        except Exception:
            logger.exception("Error calculating indicators")
            # Return empty dict on error to prevent further issues

        return indicators_data

    def _detect_patterns(
        self, price_data: list[dict]
    ) -> list[pattern_detector.PatternMatch]:
        """Detect patterns based on bot configuration."""
        enabled_patterns = self.bot_config.enabled_patterns or {}
        pattern_ids = list(enabled_patterns.keys()) if enabled_patterns else None

        return pattern_detector.detect_all_patterns(price_data, pattern_ids)

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
