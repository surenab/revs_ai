"""
Trading Environment
Gym-style environment for RL training.

This environment provides:
- State space: Market features (price, indicators, patterns, portfolio state)
- Action space: Discrete (buy/sell/hold) or continuous (position sizing)
- Reward function: Portfolio returns, Sharpe ratio, risk-adjusted metrics
- Step function: Execute action, update portfolio, calculate reward
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class TradingEnvironment:
    """
    Trading environment for reinforcement learning.

    This is a simplified Gym-style environment for training RL agents.
    In a real implementation, this would integrate with actual trading
    simulation and portfolio management.

    Example:
        env = TradingEnvironment(
            initial_cash=10000,
            price_data=price_data,
            indicators=indicators
        )
        state = env.reset()
        action = agent.select_action(state)
        next_state, reward, done, info = env.step(action)
    """

    def __init__(
        self,
        initial_cash: float = 10000.0,
        price_data: list[dict] | None = None,
        indicators: dict[str, Any] | None = None,
        commission: float = 0.001,  # 0.1% commission
    ):
        """
        Initialize trading environment.

        Args:
            initial_cash: Starting cash amount
            price_data: Historical price data
            indicators: Calculated indicators
            commission: Trading commission rate
        """
        self.initial_cash = initial_cash
        self.price_data = price_data or []
        self.indicators = indicators or {}
        self.commission = commission

        # Environment state
        self.current_step = 0
        self.cash = initial_cash
        self.position = 0.0  # Number of shares
        self.entry_price = 0.0
        self.portfolio_value = initial_cash
        self.done = False

        # History tracking
        self.portfolio_history = []
        self.action_history = []
        self.reward_history = []

    def reset(self) -> dict[str, Any]:
        """
        Reset environment to initial state.

        Returns:
            Initial state observation
        """
        self.current_step = 0
        self.cash = self.initial_cash
        self.position = 0.0
        self.entry_price = 0.0
        self.portfolio_value = self.initial_cash
        self.done = False

        self.portfolio_history = [self.portfolio_value]
        self.action_history = []
        self.reward_history = []

        return self._get_state()

    def step(self, action: dict[str, Any]) -> tuple[dict[str, Any], float, bool, dict]:
        """
        Execute one step in the environment.

        Args:
            action: Dictionary with 'action' ('buy', 'sell', 'hold') and optional 'quantity'

        Returns:
            Tuple of (next_state, reward, done, info)
        """
        if self.done:
            return self._get_state(), 0.0, True, {"message": "Episode finished"}

        if self.current_step >= len(self.price_data):
            self.done = True
            return self._get_state(), 0.0, True, {"message": "No more data"}

        # Get current price
        current_data = self.price_data[self.current_step]
        current_price = self._get_price(current_data)

        if current_price is None:
            self.current_step += 1
            return self._get_state(), 0.0, False, {"message": "Invalid price"}

        # Execute action
        action_type = action.get("action", "hold")
        quantity = action.get("quantity", 0.0)

        prev_portfolio_value = self.portfolio_value

        if action_type == "buy" and quantity > 0:
            self._execute_buy(current_price, quantity)
        elif action_type == "sell" and quantity > 0:
            self._execute_sell(current_price, quantity)
        # else: hold (no action)

        # Update portfolio value
        self.portfolio_value = self.cash + (self.position * current_price)

        # Calculate reward
        reward = self._calculate_reward(prev_portfolio_value, self.portfolio_value)

        # Move to next step
        self.current_step += 1

        # Check if done
        if self.current_step >= len(self.price_data):
            self.done = True

        # Track history
        self.portfolio_history.append(self.portfolio_value)
        self.action_history.append(action)
        self.reward_history.append(reward)

        info = {
            "portfolio_value": self.portfolio_value,
            "cash": self.cash,
            "position": self.position,
            "step": self.current_step,
        }

        return self._get_state(), reward, self.done, info

    def _execute_buy(self, price: float, quantity: float) -> None:
        """Execute buy order."""
        cost = price * quantity * (1 + self.commission)

        if cost <= self.cash:
            self.cash -= cost
            self.position += quantity
            if self.entry_price == 0.0:
                self.entry_price = price

    def _execute_sell(self, price: float, quantity: float) -> None:
        """Execute sell order."""
        quantity = min(quantity, self.position)

        if quantity > 0:
            revenue = price * quantity * (1 - self.commission)
            self.cash += revenue
            self.position -= quantity

            if self.position == 0.0:
                self.entry_price = 0.0

    def _calculate_reward(
        self, prev_portfolio_value: float, current_portfolio_value: float
    ) -> float:
        """
        Calculate reward based on portfolio performance.

        Args:
            prev_portfolio_value: Previous portfolio value
            current_portfolio_value: Current portfolio value

        Returns:
            Reward value
        """
        # Simple return-based reward
        if prev_portfolio_value > 0:
            return_rate = (
                current_portfolio_value - prev_portfolio_value
            ) / prev_portfolio_value
            return return_rate * 100.0  # Scale reward

        return 0.0

    def _get_state(self) -> dict[str, Any]:
        """
        Get current state observation.

        Returns:
            State dictionary with market features and portfolio state
        """
        if self.current_step >= len(self.price_data):
            return self._get_empty_state()

        current_data = self.price_data[self.current_step]
        current_price = self._get_price(current_data)

        state = {
            "price": current_price or 0.0,
            "cash": self.cash,
            "position": self.position,
            "portfolio_value": self.portfolio_value,
            "entry_price": self.entry_price,
            "step": self.current_step,
        }

        # Add indicator features if available
        if self.indicators:
            for key, values in self.indicators.items():
                if isinstance(values, list) and self.current_step < len(values):
                    value = values[self.current_step]
                    if value is not None:
                        state[f"indicator_{key}"] = float(value)

        return state

    def _get_empty_state(self) -> dict[str, Any]:
        """Get empty state when no data available."""
        return {
            "price": 0.0,
            "cash": self.cash,
            "position": self.position,
            "portfolio_value": self.portfolio_value,
            "entry_price": self.entry_price,
            "step": self.current_step,
        }

    def _get_price(self, data: dict) -> float | None:
        """Extract price from data point."""
        price = data.get("close_price")
        if price is None:
            return None

        try:
            return float(price)
        except (ValueError, TypeError):
            return None

    def get_portfolio_stats(self) -> dict[str, Any]:
        """
        Get portfolio statistics.

        Returns:
            Dictionary with portfolio statistics
        """
        if not self.portfolio_history:
            return {}

        initial_value = self.portfolio_history[0]
        final_value = self.portfolio_history[-1]

        total_return = (
            (final_value - initial_value) / initial_value if initial_value > 0 else 0.0
        )

        # Calculate Sharpe ratio (simplified)
        returns = [
            (self.portfolio_history[i] - self.portfolio_history[i - 1])
            / self.portfolio_history[i - 1]
            for i in range(1, len(self.portfolio_history))
            if self.portfolio_history[i - 1] > 0
        ]

        if returns:
            avg_return = sum(returns) / len(returns)
            variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
            std_dev = variance**0.5 if variance > 0 else 0.0
            sharpe_ratio = avg_return / std_dev if std_dev > 0 else 0.0
        else:
            sharpe_ratio = 0.0

        return {
            "initial_value": initial_value,
            "final_value": final_value,
            "total_return": total_return,
            "sharpe_ratio": sharpe_ratio,
            "total_steps": len(self.portfolio_history),
        }
