# Background Jobs for Stock Data Processing

This document describes the background job system for automatically downloading and processing stock data using Yahoo Finance as the data source.

## Overview

The system uses Celery with Redis as the message broker to handle background tasks for:
- Daily intraday data synchronization
- Current price updates
- Batch processing of multiple stocks

## Components

### 1. Yahoo Finance Service (`stocks/services.py`)

The `YahooFinanceService` class provides methods to:
- Fetch intraday data with various intervals (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h)
- Get current/latest prices for stocks
- Retrieve basic stock information
- Batch process multiple stocks efficiently

### 2. Management Command (`stocks/management/commands/sync_daily_intraday.py`)

A Django management command that can be run manually or via Celery tasks:

```bash
# Sync all active stocks with 5-minute intervals
python manage.py sync_daily_intraday

# Sync specific stocks
python manage.py sync_daily_intraday --symbols AAPL,GOOGL,MSFT

# Use different interval
python manage.py sync_daily_intraday --interval 1m

# Force update even if data exists
python manage.py sync_daily_intraday --force

# Dry run to see what would be done
python manage.py sync_daily_intraday --dry-run
```

### 3. Celery Tasks (`stocks/tasks.py`)

Background tasks for automated processing:

- `sync_daily_intraday_data`: Main task for daily data synchronization
- `sync_single_stock_intraday`: Process individual stocks
- `sync_current_prices`: Update current prices for all stocks

### 4. Celery Configuration (`config/celery.py`)

Configured with periodic tasks:
- **Hourly sync**: Every hour during market hours
- **Market open**: 9:30 AM EST on weekdays
- **Market close**: 4:00 PM EST on weekdays

## Setup Instructions

### 1. Install Dependencies

The required packages are already added to `pyproject.toml`:
- `yfinance>=0.2.40`: Yahoo Finance API client
- `celery>=5.4.0`: Task queue system
- `django-celery-beat>=2.7.0`: Database-backed periodic tasks

Install them:
```bash
uv sync
```

### 2. Start Redis

Celery requires Redis as a message broker:
```bash
# Install Redis (macOS)
brew install redis

# Start Redis
redis-server

# Or start as a service
brew services start redis
```

### 3. Run Database Migrations

Create tables for Celery Beat:
```bash
python manage.py migrate
```

### 4. Start Celery Services

Use the provided script:
```bash
./scripts/start-celery.sh
```

Or start services manually:

```bash
# Terminal 1: Start Celery worker
celery -A config worker --loglevel=info --queues=stock_data,celery

# Terminal 2: Start Celery beat scheduler
celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Usage Examples

### Manual Data Sync

**Intraday Data (IntradayPrice model):**
```bash
# Sync all stocks for today
python manage.py sync_daily_intraday

# Sync specific stocks with 1-minute intervals
python manage.py sync_daily_intraday --symbols AAPL,TSLA,NVDA --interval 1m

# Force refresh of existing data
python manage.py sync_daily_intraday --force
```

**Historical Data (StockPrice model):**
```bash
# Sync 1 year of daily historical data for all stocks
python manage.py sync_historical_data

# Sync specific stocks with custom period
python manage.py sync_historical_data --symbols AAPL,GOOGL,MSFT --period 2y

# Sync with custom date range
python manage.py sync_historical_data --start-date 2023-01-01 --end-date 2023-12-31

# Sync weekly data for 5 years
python manage.py sync_historical_data --period 5y --interval 1wk

# Force refresh existing historical data
python manage.py sync_historical_data --force
```

### Programmatic Task Execution

**Intraday Data Tasks:**
```python
from stocks.tasks import sync_daily_intraday_data, sync_single_stock_intraday

# Queue a task to sync all stocks
result = sync_daily_intraday_data.delay()

# Queue a task for specific stocks
result = sync_daily_intraday_data.delay(symbols=['AAPL', 'GOOGL'], interval='1m')

# Sync a single stock
result = sync_single_stock_intraday.delay('AAPL', interval='5m')

# Check task status
print(result.status)
print(result.result)
```

**Historical Data Tasks:**
```python
from stocks.tasks import sync_historical_data

# Queue historical data sync for all stocks (1 year)
result = sync_historical_data.delay()

# Queue historical data sync for specific stocks
result = sync_historical_data.delay(symbols=['AAPL', 'GOOGL'], period='2y')

# Queue historical data sync with custom interval
result = sync_historical_data.delay(period='5y', interval='1wk')

# Force refresh historical data
result = sync_historical_data.delay(force=True)

# Check task status
print(result.status)
print(result.result)
```

### Monitoring Tasks

```python
from celery import current_app

# Get active tasks
active_tasks = current_app.control.inspect().active()

# Get scheduled tasks
scheduled_tasks = current_app.control.inspect().scheduled()

# Get task stats
stats = current_app.control.inspect().stats()
```

## Configuration

### Environment Variables

Add to your `.env` file:
```bash
# Redis URL for Celery
REDIS_URL=redis://localhost:6379/0

# Optional: Celery settings
CELERY_TASK_ALWAYS_EAGER=False  # Set to True for development
```

### Celery Beat Schedule

The periodic tasks are configured in `config/celery.py`:

```python
app.conf.beat_schedule = {
    'sync-daily-intraday-data': {
        'task': 'stocks.tasks.sync_daily_intraday_data',
        'schedule': 60.0 * 60.0,  # Every hour
    },
    'sync-daily-intraday-data-market-open': {
        'task': 'stocks.tasks.sync_daily_intraday_data',
        'schedule': {
            'hour': 9,
            'minute': 30,
            'day_of_week': '1,2,3,4,5',  # Monday to Friday
        },
    },
    # ... more schedules
}
```

### Task Queues

Tasks are routed to specific queues:
- `stock_data`: All stock-related tasks
- `celery`: Default queue for other tasks

## Data Storage

Intraday data is stored in the `IntradayPrice` model with:
- Stock reference
- Date and time
- Interval (1m, 5m, etc.)
- OHLCV data (Open, High, Low, Close, Volume)

## Error Handling

The system includes:
- **Retry logic**: Tasks retry up to 3 times with delays
- **Logging**: Comprehensive logging for debugging
- **Graceful degradation**: Individual stock failures don't stop batch processing
- **Data validation**: Input validation and error checking

## Monitoring and Maintenance

### Logs

Check logs for task execution:
```bash
# Django logs
tail -f logs/django.log

# Celery worker logs (if running in background)
tail -f celery_worker.log
```

### Database Cleanup

Periodically clean old intraday data:
```python
from datetime import timedelta
from django.utils import timezone
from stocks.models import IntradayPrice

# Delete data older than 30 days
cutoff_date = timezone.now() - timedelta(days=30)
IntradayPrice.objects.filter(date__lt=cutoff_date).delete()
```

### Performance Tuning

- **Batch size**: Adjust `--batch-size` parameter for optimal performance
- **Delays**: Modify `--delay` to respect API rate limits
- **Worker concurrency**: Scale Celery workers based on load
- **Queue management**: Use separate queues for different task types

## Troubleshooting

### Common Issues

1. **Redis connection errors**:
   - Ensure Redis is running: `redis-cli ping`
   - Check Redis URL in settings

2. **Task not executing**:
   - Verify Celery worker is running
   - Check task routing configuration
   - Look for errors in logs

3. **Yahoo Finance API errors**:
   - Check internet connection
   - Verify stock symbols are valid
   - Monitor for rate limiting

4. **Database errors**:
   - Ensure migrations are applied
   - Check database connectivity
   - Monitor disk space

### Debug Mode

For development, set tasks to run synchronously:
```python
# In settings
CELERY_TASK_ALWAYS_EAGER = True
```

This runs tasks immediately without Celery worker.

## Production Deployment

For production environments:

1. **Use a process manager** (systemd, supervisor) for Celery services
2. **Monitor task queues** with tools like Flower
3. **Set up alerts** for failed tasks
4. **Scale workers** based on load
5. **Use persistent Redis** configuration
6. **Implement health checks** for services

Example systemd service files are available in the `deployment/` directory.
