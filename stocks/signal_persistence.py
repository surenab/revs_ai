"""
Signal persistence tracker for trading bot.

Tracks signals over N ticks or M minutes to ensure consistent signals before execution.
"""

import logging
from datetime import datetime
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)


class SignalPersistenceTracker:
    """
    Tracks signal persistence across ticks or time.

    Global tracking: One tracker per bot instance (across all stocks).
    When signal changes, counter resets immediately.
    """

    def __init__(
        self,
        persistence_type: str | None,
        persistence_value: int | None,
    ):
        """
        Initialize signal persistence tracker.

        Args:
            persistence_type: 'tick_count', 'time_duration', or None (disabled)
            persistence_value: N for tick count or M for minutes
        """
        self.persistence_type = persistence_type
        self.persistence_value = persistence_value
        self.enabled = (
            persistence_type is not None
            and persistence_value is not None
            and persistence_value > 0
        )

        # State tracking
        self.current_signal: str | None = None  # 'buy', 'sell', 'hold', or None
        self.counter: int = 0  # Number of matching ticks
        self.start_timestamp: datetime | None = None  # When current signal started
        self.signal_history: list[
            dict[str, Any]
        ] = []  # History of signals during persistence period

        if self.enabled:
            logger.info(
                f"Signal persistence enabled: {persistence_type} = {persistence_value}"
            )
        else:
            logger.debug("Signal persistence disabled")

    def check_signal(
        self, signal_action: str, timestamp: datetime | None = None
    ) -> dict[str, Any]:
        """
        Check if signal matches current tracked signal and update counter.

        Args:
            signal_action: Current signal action ('buy', 'sell', 'hold', 'skip')
            timestamp: Current timestamp (for time-based persistence)

        Returns:
            Dictionary with persistence state:
            {
                'should_execute': bool,
                'persistence_met': bool,
                'current_count': int,
                'required_value': int,
                'signal': str,
                'time_elapsed_seconds': float | None
            }
        """
        if not self.enabled:
            # If disabled, always allow execution (backward compatibility)
            return {
                "should_execute": True,
                "persistence_met": True,
                "current_count": 0,
                "required_value": 0,
                "signal": signal_action,
                "time_elapsed_seconds": None,
            }

        # Normalize signal action (treat 'skip' as 'hold')
        normalized_action = (
            "hold" if signal_action in ["skip", "hold"] else signal_action
        )

        # Use current time if timestamp not provided
        if timestamp is None:
            timestamp = timezone.now()

        # Check if signal changed
        if normalized_action != self.current_signal:
            # Signal changed - reset counter
            self._reset(new_signal=normalized_action, timestamp=timestamp)
            logger.debug(
                f"Signal changed from {self.current_signal} to {normalized_action}, resetting counter"
            )

        # Update counter or timer
        if self.persistence_type == "tick_count":
            self.counter += 1
            self.signal_history.append(
                {
                    "action": normalized_action,
                    "timestamp": timestamp.isoformat(),
                    "tick_number": self.counter,
                }
            )
            persistence_met = self.counter >= self.persistence_value
            time_elapsed = None

        elif self.persistence_type == "time_duration":
            if self.start_timestamp is None:
                self.start_timestamp = timestamp
                self.counter = 1
            else:
                time_elapsed = (timestamp - self.start_timestamp).total_seconds()
                # Check if M minutes have elapsed
                minutes_elapsed = time_elapsed / 60.0
                persistence_met = minutes_elapsed >= self.persistence_value
                self.counter += 1
            self.signal_history.append(
                {
                    "action": normalized_action,
                    "timestamp": timestamp.isoformat(),
                    "counter": self.counter,
                }
            )
            time_elapsed = (
                (timestamp - self.start_timestamp).total_seconds()
                if self.start_timestamp
                else 0.0
            )

        else:
            # Unknown persistence type - disable
            logger.warning(f"Unknown persistence type: {self.persistence_type}")
            return {
                "should_execute": True,
                "persistence_met": True,
                "current_count": 0,
                "required_value": 0,
                "signal": signal_action,
                "time_elapsed_seconds": None,
            }

        # Determine if we should execute
        # Only execute buy/sell signals, not hold
        should_execute = (
            persistence_met
            and normalized_action in ["buy", "sell"]
            and normalized_action == self.current_signal
        )

        return {
            "should_execute": should_execute,
            "persistence_met": persistence_met,
            "current_count": self.counter,
            "required_value": self.persistence_value,
            "signal": normalized_action,
            "time_elapsed_seconds": time_elapsed
            if self.persistence_type == "time_duration"
            else None,
        }

    def should_execute(self) -> bool:
        """
        Check if persistence criteria is met and signal is executable.

        Returns:
            True if persistence met and signal is buy/sell
        """
        if not self.enabled:
            return True

        if self.current_signal not in ["buy", "sell"]:
            return False

        if self.persistence_type == "tick_count":
            return self.counter >= self.persistence_value
        if self.persistence_type == "time_duration":
            if self.start_timestamp is None:
                return False
            time_elapsed = (timezone.now() - self.start_timestamp).total_seconds()
            minutes_elapsed = time_elapsed / 60.0
            return minutes_elapsed >= self.persistence_value

        return False

    def reset(self, new_signal: str | None = None, timestamp: datetime | None = None):
        """
        Reset counter when signal changes.

        Args:
            new_signal: New signal to track (if None, just reset)
            timestamp: Timestamp for new signal start
        """
        self.current_signal = new_signal
        self.counter = 0
        self.start_timestamp = timestamp if timestamp else timezone.now()
        self.signal_history = []

        if new_signal:
            logger.debug(f"Persistence tracker reset for signal: {new_signal}")

    def _reset(self, new_signal: str | None = None, timestamp: datetime | None = None):
        """Internal reset method."""
        self.reset(new_signal, timestamp)

    def get_state(self) -> dict[str, Any]:
        """
        Get current persistence state for debugging.

        Returns:
            Dictionary with current state
        """
        state = {
            "enabled": self.enabled,
            "persistence_type": self.persistence_type,
            "persistence_value": self.persistence_value,
            "current_signal": self.current_signal,
            "counter": self.counter,
            "start_timestamp": (
                self.start_timestamp.isoformat() if self.start_timestamp else None
            ),
            "signal_history_count": len(self.signal_history),
        }

        if self.persistence_type == "time_duration" and self.start_timestamp:
            time_elapsed = (timezone.now() - self.start_timestamp).total_seconds()
            state["time_elapsed_seconds"] = time_elapsed
            state["time_elapsed_minutes"] = time_elapsed / 60.0

        return state

    def get_signal_history(self) -> list[dict[str, Any]]:
        """Get signal history during persistence period."""
        return self.signal_history.copy()
