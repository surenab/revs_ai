"""
Celery configuration for the stocks project.
"""

import logging
import os

from celery import Celery

logger = logging.getLogger(__name__)

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("stocks")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Configure connection retry settings to handle Redis connection issues gracefully
# These settings prevent Celery from trying to connect immediately on import
app.conf.broker_connection_retry_on_startup = False  # Don't retry on startup
app.conf.broker_connection_retry = True
app.conf.broker_connection_max_retries = 10
app.conf.broker_connection_timeout = 5.0

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Note: When using django_celery_beat with DatabaseScheduler, periodic tasks
# should be configured in the database via PeriodicTask model, not here.
# Use the management command: python manage.py setup_periodic_tasks
# to create periodic tasks in the database.
#
# IMPORTANT: When using DatabaseScheduler, beat_schedule should be empty or None
# to prevent Celery Beat from trying to sync dict-based schedules to the database.
# The DatabaseScheduler will load tasks from the database instead.

# Disable beat_schedule when using DatabaseScheduler to avoid sync errors
# If you need to use file-based scheduling instead, set CELERY_BEAT_SCHEDULER to None
# and uncomment the beat_schedule below.
app.conf.beat_schedule = {}

app.conf.timezone = "UTC"


@app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery configuration."""
