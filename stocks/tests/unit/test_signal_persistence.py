"""
Unit tests for SignalPersistenceTracker.
"""

from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from stocks.signal_persistence import SignalPersistenceTracker


class TestSignalPersistenceTracker:
    """Test cases for SignalPersistenceTracker."""

    def test_disabled_persistence(self):
        """Test that disabled persistence always allows execution."""
        tracker = SignalPersistenceTracker(None, None)
        assert not tracker.enabled

        result = tracker.check_signal("buy")
        assert result["should_execute"] is True
        assert result["persistence_met"] is True

    def test_tick_count_persistence(self):
        """Test tick count persistence."""
        tracker = SignalPersistenceTracker("tick_count", 3)

        # First tick - should not execute
        result1 = tracker.check_signal("buy")
        assert result1["should_execute"] is False
        assert result1["persistence_met"] is False
        assert result1["current_count"] == 1

        # Second tick - should not execute
        result2 = tracker.check_signal("buy")
        assert result2["should_execute"] is False
        assert result2["persistence_met"] is False
        assert result2["current_count"] == 2

        # Third tick - should execute
        result3 = tracker.check_signal("buy")
        assert result3["should_execute"] is True
        assert result3["persistence_met"] is True
        assert result3["current_count"] == 3

    def test_tick_count_reset_on_signal_change(self):
        """Test that tick count resets when signal changes."""
        tracker = SignalPersistenceTracker("tick_count", 3)

        # Two buy signals
        tracker.check_signal("buy")
        tracker.check_signal("buy")

        # Signal changes to sell - should reset
        result = tracker.check_signal("sell")
        assert result["should_execute"] is False
        assert result["current_count"] == 1
        assert tracker.current_signal == "sell"

        # Continue with sell signals (need 2 more to reach 3 total)
        tracker.check_signal("sell")  # count = 2
        result = tracker.check_signal("sell")  # count = 3, should execute
        assert result["should_execute"] is True
        assert result["current_count"] == 3

    def test_time_duration_persistence(self):
        """Test time duration persistence."""
        tracker = SignalPersistenceTracker("time_duration", 5)  # 5 minutes

        base_time = timezone.now()

        # First check - should not execute
        result1 = tracker.check_signal("buy", timestamp=base_time)
        assert result1["should_execute"] is False
        assert result1["persistence_met"] is False

        # Check after 3 minutes - should not execute
        result2 = tracker.check_signal("buy", timestamp=base_time + timedelta(minutes=3))
        assert result2["should_execute"] is False
        assert result2["persistence_met"] is False

        # Check after 5 minutes - should execute
        result3 = tracker.check_signal("buy", timestamp=base_time + timedelta(minutes=5))
        assert result3["should_execute"] is True
        assert result3["persistence_met"] is True

    def test_time_duration_reset_on_signal_change(self):
        """Test that time duration resets when signal changes."""
        tracker = SignalPersistenceTracker("time_duration", 5)

        base_time = timezone.now()

        # Buy signal at time 0
        tracker.check_signal("buy", timestamp=base_time)

        # Signal changes to sell at time 2 minutes - should reset
        result = tracker.check_signal("sell", timestamp=base_time + timedelta(minutes=2))
        assert result["should_execute"] is False
        assert tracker.current_signal == "sell"
        assert tracker.start_timestamp == base_time + timedelta(minutes=2)

        # Check after 5 more minutes from reset - should execute
        result = tracker.check_signal(
            "sell", timestamp=base_time + timedelta(minutes=7)
        )
        assert result["should_execute"] is True

    def test_hold_signals_do_not_execute(self):
        """Test that hold/skip signals never execute even if persistence is met."""
        tracker = SignalPersistenceTracker("tick_count", 2)

        # Two hold signals - persistence met but should not execute
        tracker.check_signal("hold")
        result = tracker.check_signal("hold")
        assert result["persistence_met"] is True
        assert result["should_execute"] is False  # Hold never executes

        # Same for skip
        tracker.reset("skip")
        tracker.check_signal("skip")
        result = tracker.check_signal("skip")
        assert result["persistence_met"] is True
        assert result["should_execute"] is False

    def test_global_tracking(self):
        """Test that tracker is global across all stocks."""
        tracker = SignalPersistenceTracker("tick_count", 3)

        # Signal for stock A
        tracker.check_signal("buy")
        tracker.check_signal("buy")

        # Signal for stock B (same signal) - should continue counting
        result = tracker.check_signal("buy")
        assert result["should_execute"] is True
        assert result["current_count"] == 3

    def test_signal_history_tracking(self):
        """Test that signal history is tracked."""
        tracker = SignalPersistenceTracker("tick_count", 3)

        tracker.check_signal("buy")
        tracker.check_signal("buy")
        tracker.check_signal("buy")

        history = tracker.get_signal_history()
        assert len(history) == 3
        assert all(entry["action"] == "buy" for entry in history)

    def test_get_state(self):
        """Test get_state method."""
        tracker = SignalPersistenceTracker("tick_count", 3)

        state = tracker.get_state()
        assert state["enabled"] is True
        assert state["persistence_type"] == "tick_count"
        assert state["persistence_value"] == 3
        assert state["current_signal"] is None
        assert state["counter"] == 0

        tracker.check_signal("buy")
        state = tracker.get_state()
        assert state["current_signal"] == "buy"
        assert state["counter"] == 1

    def test_reset_method(self):
        """Test reset method."""
        tracker = SignalPersistenceTracker("tick_count", 3)

        tracker.check_signal("buy")
        tracker.check_signal("buy")
        assert tracker.counter == 2

        tracker.reset("sell")
        assert tracker.current_signal == "sell"
        assert tracker.counter == 0
        assert len(tracker.signal_history) == 0

    def test_exact_match_required(self):
        """Test that exact signal match is required."""
        tracker = SignalPersistenceTracker("tick_count", 3)

        # Buy signals
        tracker.check_signal("buy")
        tracker.check_signal("buy")

        # Hold signal - should reset
        result = tracker.check_signal("hold")
        assert result["current_count"] == 1
        assert tracker.current_signal == "hold"

        # Back to buy - should reset again
        result = tracker.check_signal("buy")
        assert result["current_count"] == 1
        assert tracker.current_signal == "buy"
