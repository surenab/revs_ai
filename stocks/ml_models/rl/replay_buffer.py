"""
Replay Buffer
Store and sample trading experiences for offline RL.

This buffer stores (state, action, reward, next_state) tuples
for training RL agents on historical data.
"""

import logging
import random
from collections import deque
from typing import Any

logger = logging.getLogger(__name__)


class ReplayBuffer:
    """
    Experience replay buffer for offline RL training.

    Stores trading experiences and allows sampling for training.
    This is essential for offline RL where we learn from historical data.

    Example:
        buffer = ReplayBuffer(max_size=10000)
        buffer.add(state, action, reward, next_state, done)
        batch = buffer.sample(batch_size=32)
    """

    def __init__(self, max_size: int = 10000):
        """
        Initialize replay buffer.

        Args:
            max_size: Maximum number of experiences to store
        """
        self.max_size = max_size
        self.buffer: deque = deque(maxlen=max_size)

    def add(
        self,
        state: dict[str, Any],
        action: dict[str, Any],
        reward: float,
        next_state: dict[str, Any],
        done: bool,
    ) -> None:
        """
        Add experience to buffer.

        Args:
            state: Current state
            action: Action taken
            reward: Reward received
            next_state: Next state after action
            done: Whether episode is done
        """
        experience = {
            "state": state,
            "action": action,
            "reward": reward,
            "next_state": next_state,
            "done": done,
        }
        self.buffer.append(experience)

    def sample(self, batch_size: int) -> list[dict[str, Any]]:
        """
        Sample a batch of experiences from buffer.

        Args:
            batch_size: Number of experiences to sample

        Returns:
            List of experience dictionaries
        """
        if len(self.buffer) < batch_size:
            return list(self.buffer)

        return random.sample(list(self.buffer), batch_size)

    def __len__(self) -> int:
        """Get current buffer size."""
        return len(self.buffer)

    def clear(self) -> None:
        """Clear all experiences from buffer."""
        self.buffer.clear()

    def get_all(self) -> list[dict[str, Any]]:
        """
        Get all experiences (for offline RL).

        Returns:
            List of all experience dictionaries
        """
        return list(self.buffer)
