"""
Reward Functions
Various reward function implementations for RL training.

This module provides different reward functions:
- Simple returns
- Sharpe ratio
- Risk-adjusted returns
- Drawdown-aware rewards
"""

import logging

logger = logging.getLogger(__name__)


def simple_return_reward(
    prev_portfolio_value: float, current_portfolio_value: float
) -> float:
    """
    Simple return-based reward.

    Args:
        prev_portfolio_value: Previous portfolio value
        current_portfolio_value: Current portfolio value

    Returns:
        Reward as percentage return
    """
    if prev_portfolio_value > 0:
        return (current_portfolio_value - prev_portfolio_value) / prev_portfolio_value
    return 0.0


def sharpe_ratio_reward(portfolio_history: list[float], window: int = 20) -> float:
    """
    Sharpe ratio-based reward.

    Args:
        portfolio_history: History of portfolio values
        window: Window size for calculating Sharpe ratio

    Returns:
        Reward based on Sharpe ratio
    """
    if len(portfolio_history) < window + 1:
        return 0.0

    # Calculate returns
    returns = [
        (portfolio_history[i] - portfolio_history[i - 1]) / portfolio_history[i - 1]
        for i in range(len(portfolio_history) - window, len(portfolio_history))
        if portfolio_history[i - 1] > 0
    ]

    if not returns:
        return 0.0

    # Calculate Sharpe ratio
    avg_return = sum(returns) / len(returns)
    variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
    std_dev = variance**0.5 if variance > 0 else 0.0

    if std_dev > 0:
        sharpe_ratio = avg_return / std_dev
        return sharpe_ratio * 0.1  # Scale reward
    return 0.0


def risk_adjusted_reward(
    prev_portfolio_value: float,
    current_portfolio_value: float,
    volatility: float,
) -> float:
    """
    Risk-adjusted return reward.

    Args:
        prev_portfolio_value: Previous portfolio value
        current_portfolio_value: Current portfolio value
        volatility: Current volatility measure

    Returns:
        Risk-adjusted reward
    """
    if prev_portfolio_value > 0:
        return_rate = (
            current_portfolio_value - prev_portfolio_value
        ) / prev_portfolio_value
        # Penalize high volatility
        if volatility > 0:
            return return_rate / (1 + volatility)
        return return_rate
    return 0.0


def drawdown_aware_reward(
    portfolio_history: list[float],
    prev_portfolio_value: float,
    current_portfolio_value: float,
) -> float:
    """
    Drawdown-aware reward that penalizes large drawdowns.

    Args:
        portfolio_history: History of portfolio values
        prev_portfolio_value: Previous portfolio value
        current_portfolio_value: Current portfolio value

    Returns:
        Drawdown-aware reward
    """
    if not portfolio_history or prev_portfolio_value <= 0:
        return 0.0

    # Calculate current drawdown
    peak = max(portfolio_history)
    current_drawdown = (peak - current_portfolio_value) / peak if peak > 0 else 0.0

    # Calculate return
    return_rate = (
        current_portfolio_value - prev_portfolio_value
    ) / prev_portfolio_value

    # Penalize large drawdowns
    drawdown_penalty = current_drawdown * 0.5

    return return_rate - drawdown_penalty


def get_reward_function(reward_type: str):
    """
    Get reward function by type.

    Args:
        reward_type: Type of reward function ('simple', 'sharpe', 'risk_adjusted', 'drawdown')

    Returns:
        Reward function
    """
    reward_functions = {
        "simple": simple_return_reward,
        "sharpe": sharpe_ratio_reward,
        "risk_adjusted": risk_adjusted_reward,
        "drawdown": drawdown_aware_reward,
    }

    return reward_functions.get(reward_type, simple_return_reward)
