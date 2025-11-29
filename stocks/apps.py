import contextlib

from django.apps import AppConfig


class StocksConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "stocks"
    verbose_name = "Stock Management"

    def ready(self):
        """Import signals when the app is ready."""
        with contextlib.suppress(ImportError):
            import stocks.signals  # noqa: F401
