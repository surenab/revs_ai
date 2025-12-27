"""
Django signals for trading bot automation.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import IntradayPrice, StockPrice, StockTick, TradingBotConfig
from .tasks import execute_trading_bots

logger = logging.getLogger(__name__)


@receiver(post_save, sender=StockPrice)
def trigger_bot_on_price_update(sender, instance, created, **kwargs):
    """
    Trigger trading bot execution when stock price is updated.
    """
    if not created:  # Only trigger on new price updates
        return

    # Check if there are any active bots monitoring this stock
    active_bots = TradingBotConfig.objects.filter(
        is_active=True, assigned_stocks=instance.stock
    )

    if active_bots.exists():
        # Trigger bot execution asynchronously
        try:
            execute_trading_bots.delay(stock_symbol=instance.stock.symbol)
            logger.debug(
                f"Triggered bot execution for {instance.stock.symbol} "
                f"({active_bots.count()} active bots)"
            )
        except Exception:
            logger.exception("Error triggering bot execution")


@receiver(post_save, sender=IntradayPrice)
def trigger_bot_on_intraday_update(sender, instance, created, **kwargs):
    """
    Trigger trading bot execution when intraday price is updated.
    """
    if not created:  # Only trigger on new price updates
        return

    # Check if there are any active bots monitoring this stock
    active_bots = TradingBotConfig.objects.filter(
        is_active=True, assigned_stocks=instance.stock
    )

    if active_bots.exists():
        # Trigger bot execution asynchronously
        try:
            execute_trading_bots.delay(stock_symbol=instance.stock.symbol)
            logger.debug(
                f"Triggered bot execution for {instance.stock.symbol} "
                f"({active_bots.count()} active bots)"
            )
        except Exception:
            logger.exception("Error triggering bot execution")


@receiver(post_save, sender=StockTick)
def trigger_bot_on_tick_update(sender, instance, created, **kwargs):
    """
    Trigger trading bot execution when stock tick is updated.
    This is the primary signal for tick-based trading bots.
    """
    if not created:  # Only trigger on new tick updates
        return

    # Check if there are any active bots monitoring this stock
    active_bots = TradingBotConfig.objects.filter(
        is_active=True, assigned_stocks=instance.stock
    )

    if active_bots.exists():
        # Trigger bot execution asynchronously
        try:
            execute_trading_bots.delay(stock_symbol=instance.stock.symbol)
            logger.debug(
                f"Triggered bot execution for {instance.stock.symbol} "
                f"({active_bots.count()} active bots) on tick update"
            )
        except Exception:
            logger.exception("Error triggering bot execution on tick update")
