"""
Risk Management for Trading Bot
Comprehensive risk management including position sizing, limits, and validation.
"""

import logging
import math
from decimal import Decimal

from django.utils import timezone

from .models import BotPortfolio, Order, TradingBotConfig

logger = logging.getLogger(__name__)


class RiskManager:
    """Manages risk for trading bot operations."""

    def __init__(self, bot_config: TradingBotConfig):
        """
        Initialize risk manager.

        Args:
            bot_config: TradingBotConfig instance
        """
        self.bot_config = bot_config
        self.user = bot_config.user

    def validate_trade(
        self,
        stock,
        action: str,
        quantity: Decimal | None = None,
        price: Decimal | None = None,
    ) -> tuple[bool, str]:
        """
        Validate if a trade can be executed based on risk rules.

        Args:
            stock: Stock instance
            action: "buy" or "sell"
            quantity: Quantity to trade (optional, will be calculated if None)
            price: Current price (optional, will be fetched if None)

        Returns:
            Tuple of (is_valid, reason)
        """
        # Check if stock is in assigned stocks OR in bot's portfolio
        # (bots can sell positions even if not in assigned_stocks)
        is_assigned = stock in self.bot_config.assigned_stocks.all()
        has_position = BotPortfolio.objects.filter(
            bot_config=self.bot_config, stock=stock, quantity__gt=0
        ).exists()

        if not is_assigned and not has_position:
            return (
                False,
                f"Stock {stock.symbol} is not in bot's assigned stocks or portfolio",
            )

        # Check daily trade limits
        if not self._check_daily_trade_limit():
            return False, "Daily trade limit reached"

        # Check daily loss limits
        if not self._check_daily_loss_limit():
            return False, "Daily loss limit reached"

        if action == "buy":
            return self._validate_buy(stock, quantity, price)
        if action == "sell":
            return self._validate_sell(stock, quantity, price)
        return False, f"Unknown action: {action}"

    def calculate_position_size(
        self, stock, price: Decimal, stop_loss_price: Decimal | None = None
    ) -> int:
        """
        Calculate optimal position size based on risk management rules.
        Returns integer quantity (no fractional shares).

        Args:
            stock: Stock instance
            price: Current price
            stop_loss_price: Stop loss price (optional)

        Returns:
            Optimal position size (quantity as integer)
        """
        # Get available budget (bot cash balance)
        available_budget = self._get_available_budget()

        if available_budget <= 0:
            return 0

        # Calculate maximum affordable quantity based on cash
        max_affordable_quantity = math.floor(available_budget / price)
        if max_affordable_quantity <= 0:
            return 0

        # Calculate risk per trade
        risk_per_trade = self.bot_config.risk_per_trade / Decimal("100.00")
        risk_amount = available_budget * risk_per_trade

        # Calculate risk-based position size
        if stop_loss_price and stop_loss_price > 0:
            stop_loss_percent = abs((price - stop_loss_price) / price)
            if stop_loss_percent > 0:
                position_value = risk_amount / stop_loss_percent
                risk_quantity = position_value / price
            else:
                # Fallback to percentage of budget
                max_position_percent = Decimal("0.10")  # 10% max per position
                position_value = available_budget * max_position_percent
                risk_quantity = position_value / price
        else:
            # Use default risk percentage
            max_position_percent = Decimal("0.10")  # 10% max per position
            position_value = available_budget * max_position_percent
            risk_quantity = position_value / price

        # Round down to integer
        risk_quantity_int = math.floor(risk_quantity)

        # Apply max position size limit
        if self.bot_config.max_position_size:
            max_position_int = int(self.bot_config.max_position_size)
            risk_quantity_int = min(risk_quantity_int, max_position_int)

        # CRITICAL: Take minimum of risk-based size and max affordable
        # This ensures we never exceed available cash
        final_quantity = min(risk_quantity_int, max_affordable_quantity)

        # Ensure quantity is positive
        return max(0, final_quantity)

    def calculate_risk_score(self, stock, price: Decimal, quantity: Decimal) -> Decimal:
        """
        Calculate risk score (0-100) for a potential trade.

        Args:
            stock: Stock instance
            price: Current price
            quantity: Quantity to trade

        Returns:
            Risk score (0-100, higher = more risky)
        """
        score = Decimal("0.00")

        # Volatility component (0-30 points)
        volatility_score = self._calculate_volatility_score(stock)
        score += volatility_score * Decimal("0.30")

        # Portfolio concentration (0-20 points)
        concentration_score = self._calculate_concentration_score(
            stock, price, quantity
        )
        score += concentration_score * Decimal("0.20")

        # Current drawdown (0-25 points)
        drawdown_score = self._calculate_drawdown_score()
        score += drawdown_score * Decimal("0.25")

        # Position size relative to budget (0-25 points)
        position_score = self._calculate_position_size_score(price, quantity)
        score += position_score * Decimal("0.25")

        return min(Decimal("100.00"), max(Decimal("0.00"), score))

    def _validate_buy(
        self, stock, quantity: Decimal | None, price: Decimal | None
    ) -> tuple[bool, str]:
        """Validate buy order."""
        # Get current price if not provided
        if price is None:
            latest_price = stock.latest_price
            if not latest_price:
                return False, "No price data available"
            price = latest_price.close_price

        # Calculate position size if not provided
        if quantity is None:
            stop_loss_price = None
            if self.bot_config.stop_loss_percent:
                stop_loss_pct = self.bot_config.stop_loss_percent / Decimal("100.00")
                stop_loss_price = price * (Decimal("1.00") - stop_loss_pct)
            quantity = self.calculate_position_size(stock, price, stop_loss_price)

        # Check bot cash balance (for buy orders, we only use cash, not portfolio value)
        quantity_int = int(quantity) if quantity else 0
        total_cost = Decimal(str(quantity_int)) * price
        cash_balance = self.bot_config.cash_balance or Decimal("0.00")

        if total_cost > cash_balance:
            return (
                False,
                f"Insufficient bot cash. Need {total_cost}, have {cash_balance}",
            )

        # Check max position size
        if (
            self.bot_config.max_position_size
            and quantity > self.bot_config.max_position_size
        ):
            return (
                False,
                f"Quantity {quantity} exceeds max position size {self.bot_config.max_position_size}",
            )

        return True, "Buy order validated"

    def _validate_sell(
        self, stock, quantity: Decimal | None, price: Decimal | None
    ) -> tuple[bool, str]:
        """Validate sell order."""
        # Get current price if not provided
        if price is None:
            latest_price = stock.latest_price
            if not latest_price:
                return False, "No price data available"
            price = latest_price.close_price

        # Check if bot has position in this stock
        bot_positions = self._get_bot_positions(stock)
        total_quantity = sum(pos.quantity for pos in bot_positions)

        if total_quantity <= 0:
            return False, f"No position in {stock.symbol} to sell"

        # Check quantity (convert to int for comparison)
        quantity_int = total_quantity if quantity is None else int(quantity)

        if quantity_int > total_quantity:
            return False, f"Cannot sell {quantity_int}, only have {total_quantity}"

        return True, "Sell order validated"

    def _check_daily_trade_limit(self) -> bool:
        """Check if daily trade limit has been reached."""
        if not self.bot_config.max_daily_trades:
            return True  # No limit set

        today = timezone.now().date()
        today_orders = Order.objects.filter(
            bot_config=self.bot_config,
            created_at__date=today,
            status__in=["done", "in_progress"],
        ).count()

        return today_orders < self.bot_config.max_daily_trades

    def _check_daily_loss_limit(self) -> bool:
        """Check if daily loss limit has been reached."""
        if not self.bot_config.max_daily_loss:
            return True  # No limit set

        today = timezone.now().date()
        today_orders = Order.objects.filter(
            bot_config=self.bot_config, created_at__date=today, status="done"
        )

        total_loss = Decimal("0.00")
        for order in today_orders:
            if order.executed_price and order.executed_at:
                # Calculate P&L for this order
                # This is simplified - in reality, need to track entry/exit prices
                pass  # TODO: Implement proper P&L calculation

        return total_loss >= -self.bot_config.max_daily_loss

    def _get_available_budget(self) -> Decimal:
        """Get available budget for trading (bot cash balance + current portfolio value)."""
        # Always use bot's cash balance
        cash_balance = self.bot_config.cash_balance or Decimal("0.00")

        # Add current portfolio value
        portfolio_value = Decimal("0.00")
        for holding in self.bot_config.bot_portfolio_holdings.all():
            portfolio_value += holding.current_value

        return cash_balance + portfolio_value

    def _get_bot_positions(self, stock) -> list[BotPortfolio]:
        """Get bot's positions in a stock from BotPortfolio."""
        # Query BotPortfolio directly
        bot_positions = BotPortfolio.objects.filter(
            bot_config=self.bot_config,
            stock=stock,
            quantity__gt=0,
        )
        return list(bot_positions)

    def _calculate_volatility_score(self, stock) -> Decimal:
        """Calculate volatility score (0-1)."""
        # Simplified - would use ATR or standard deviation
        # For now, return moderate score
        return Decimal("0.50")

    def _calculate_concentration_score(
        self, stock, price: Decimal, quantity: Decimal
    ) -> Decimal:
        """Calculate portfolio concentration score (0-1)."""
        position_value = price * quantity
        total_budget = self._get_available_budget()

        if total_budget > 0:
            concentration = position_value / total_budget
            # Higher concentration = higher risk
            return min(Decimal("1.00"), concentration * Decimal("2.00"))
        return Decimal("0.00")

    def _calculate_drawdown_score(self) -> Decimal:
        """Calculate current drawdown score (0-1)."""
        # Simplified - would calculate actual drawdown
        return Decimal("0.00")

    def _calculate_position_size_score(
        self, price: Decimal, quantity: Decimal
    ) -> Decimal:
        """Calculate position size risk score (0-1)."""
        position_value = price * quantity
        total_budget = self._get_available_budget()

        if total_budget > 0:
            size_ratio = position_value / total_budget
            # Larger positions = higher risk
            return min(Decimal("1.00"), size_ratio * Decimal("5.00"))
        return Decimal("0.00")
