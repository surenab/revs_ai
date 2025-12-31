# Celery Setup and Usage

## Redis Status

✅ **Redis is installed and running**
- Redis version: 7.0.0
- Status: Running (managed by Homebrew)
- Port: 6379 (default)
- Auto-start: Enabled (will start on system boot)

## Starting Celery Worker

To process simulation tasks, you need to start the Celery worker:

### Option 1: Using the provided script
```bash
./start_celery.sh
```

### Option 2: Manual command
```bash
uv run celery -A config worker --loglevel=info
```

### Option 3: Run in background (detached)
```bash
uv run celery -A config worker --loglevel=info --detach
```

## Starting Celery Beat (for scheduled tasks)

If you need periodic tasks (like data syncing):

```bash
uv run celery -A config beat --loglevel=info
```

## Verifying Setup

1. **Check Redis is running:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check Celery worker is running:**
   ```bash
   ps aux | grep celery
   ```

3. **Test Celery connection:**
   ```bash
   uv run python manage.py shell -c "from config.celery import app; print('Celery app:', app)"
   ```

## Troubleshooting

### Redis not running
```bash
# Start Redis
brew services start redis

# Or manually
redis-server
```

### Celery can't connect to Redis
- Check Redis is running: `redis-cli ping`
- Verify Redis URL in settings: `config/settings/base.py` (default: `redis://localhost:6379/0`)

### Tasks not executing
- Ensure Celery worker is running
- Check worker logs for errors
- Verify task is registered: `uv run celery -A config inspect registered`

## Useful Commands

- **List active tasks:** `uv run celery -A config inspect active`
- **List registered tasks:** `uv run celery -A config inspect registered`
- **Purge all tasks:** `uv run celery -A config purge`
- **Monitor workers:** `uv run celery -A config flower` (requires flower package)
