"""
Celery configuration for the stocks project.
"""

import os

from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("stocks")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Configure Celery Beat schedule for periodic tasks
app.conf.beat_schedule = {
    "sync-daily-intraday-data": {
        "task": "stocks.tasks.sync_daily_intraday_data",
        "schedule": 60.0 * 60.0,  # Every hour during market hours
        "options": {
            "expires": 3600,  # Task expires after 1 hour
        },
    },
    "sync-daily-intraday-data-market-open": {
        "task": "stocks.tasks.sync_daily_intraday_data",
        "schedule": {
            "hour": 9,
            "minute": 30,
            "day_of_week": "1,2,3,4,5",  # Monday to Friday
        },
        "options": {
            "expires": 3600,
        },
    },
    "sync-daily-intraday-data-market-close": {
        "task": "stocks.tasks.sync_daily_intraday_data",
        "schedule": {
            "hour": 16,
            "minute": 0,
            "day_of_week": "1,2,3,4,5",  # Monday to Friday
        },
        "options": {
            "expires": 3600,
        },
    },
    "sync-historical-data-weekly": {
        "task": "stocks.tasks.sync_historical_data",
        "schedule": {
            "hour": 2,
            "minute": 0,
            "day_of_week": "6",  # Saturday at 2 AM
        },
        "kwargs": {"period": "1mo", "force": True},
        "options": {
            "expires": 7200,  # 2 hours
        },
    },
}

app.conf.timezone = "UTC"


@app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery configuration."""
