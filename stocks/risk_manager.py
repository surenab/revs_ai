"""
Risk Management for Trading Bot
Comprehensive risk management including position sizing, limits, and validation.
"""

import logging
from decimal import Decimal

from django.utils import timezone

from .models import Order, Portfolio, TradingBotConfig

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
        # Check if stock is in assigned stocks
        if stock not in self.bot_config.assigned_stocks.all():
            return False, f"Stock {stock.symbol} is not in bot's assigned stocks"

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
    ) -> Decimal:
        """
        Calculate optimal position size based on risk management rules.

        Args:
            stock: Stock instance
            price: Current price
            stop_loss_price: Stop loss price (optional)

        Returns:
            Optimal position size (quantity)
        """
        # Get available budget
        available_budget = self._get_available_budget()

        if available_budget <= 0:
            return Decimal("0.00")

        # Calculate risk per trade
        risk_per_trade = self.bot_config.risk_per_trade / Decimal("100.00")
        risk_amount = available_budget * risk_per_trade

        # Calculate position size based on stop loss
        if stop_loss_price and stop_loss_price > 0:
            stop_loss_percent = abs((price - stop_loss_price) / price)
            if stop_loss_percent > 0:
                position_value = risk_amount / stop_loss_percent
                quantity = position_value / price
            else:
                # Fallback to percentage of budget
                max_position_percent = Decimal("0.10")  # 10% max per position
                position_value = available_budget * max_position_percent
                quantity = position_value / price
        else:
            # Use default risk percentage
            max_position_percent = Decimal("0.10")  # 10% max per position
            position_value = available_budget * max_position_percent
            quantity = position_value / price

        # Apply max position size limit
        if self.bot_config.max_position_size:
            quantity = min(quantity, self.bot_config.max_position_size)

        # Ensure quantity is positive and reasonable
        quantity = max(Decimal("0.0001"), min(quantity, available_budget / price))

        return quantity.quantize(Decimal("0.0001"))

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

        # Check budget
        total_cost = quantity * price
        available_budget = self._get_available_budget()

        if total_cost > available_budget:
            return (
                False,
                f"Insufficient budget. Need {total_cost}, have {available_budget}",
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

        # Check quantity
        if quantity is None:
            quantity = total_quantity  # Sell all

        if quantity > total_quantity:
            return False, f"Cannot sell {quantity}, only have {total_quantity}"

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
        """Get available budget for trading."""
        if self.bot_config.budget_type == "cash":
            # For cash budget, track separately or use a dedicated field
            # For now, return the budget_cash value
            return self.bot_config.budget_cash or Decimal("0.00")
        # For portfolio budget, calculate current value of assigned positions
        portfolio_positions = self.bot_config.budget_portfolio.all()
        total_value = Decimal("0.00")
        for pos in portfolio_positions:
            total_value += pos.current_value
        return total_value

    def _get_bot_positions(self, stock) -> list[Portfolio]:
        """Get bot's positions in a stock."""
        # Get positions created by bot orders
        bot_orders = Order.objects.filter(
            bot_config=self.bot_config,
            stock=stock,
            status="done",
            transaction_type="buy",
        )

        positions = []
        for order in bot_orders:
            try:
                portfolio_entry = Portfolio.objects.get(
                    user=self.user, stock=stock, order=order
                )
                if portfolio_entry.quantity > 0:
                    positions.append(portfolio_entry)
            except Portfolio.DoesNotExist:
                pass

        # Also include portfolio positions assigned to bot
        if self.bot_config.budget_type == "portfolio":
            assigned_positions = self.bot_config.budget_portfolio.filter(stock=stock)
            positions.extend(assigned_positions)

        return positions

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
