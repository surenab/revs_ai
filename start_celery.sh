#!/bin/bash
# Script to start Celery worker for the Stocks project

cd "$(dirname "$0")"

echo "Starting Celery worker..."
echo "Press Ctrl+C to stop the worker"
echo ""

# Start Celery worker
uv run celery -A config worker --loglevel=info
