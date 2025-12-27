"""
Signals package for signal aggregation and processing.
"""

from .aggregator import SignalAggregator
from .types import Signal, SignalSource

__all__ = ["Signal", "SignalAggregator", "SignalSource"]
