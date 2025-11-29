#!/bin/bash

# Start Celery worker and beat scheduler for stock data processing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Celery services for Stock Data Processing${NC}"

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${RED}Error: Redis is not running. Please start Redis first.${NC}"
    echo "You can start Redis with: redis-server"
    exit 1
fi

echo -e "${GREEN}✓ Redis is running${NC}"

# Set Django settings
export DJANGO_SETTINGS_MODULE=config.settings.development

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}Shutting down Celery services...${NC}"
    if [ ! -z "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null
        echo -e "${GREEN}✓ Celery worker stopped${NC}"
    fi
    if [ ! -z "$BEAT_PID" ]; then
        kill $BEAT_PID 2>/dev/null
        echo -e "${GREEN}✓ Celery beat stopped${NC}"
    fi
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start Celery worker in background
echo -e "${YELLOW}Starting Celery worker...${NC}"
uv run celery -A config worker --loglevel=info --queues=stock_data,celery &
WORKER_PID=$!

# Wait a moment for worker to start
sleep 2

# Check if worker started successfully
if ! kill -0 $WORKER_PID 2>/dev/null; then
    echo -e "${RED}Error: Failed to start Celery worker${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Celery worker started (PID: $WORKER_PID)${NC}"

# Start Celery beat scheduler in background
echo -e "${YELLOW}Starting Celery beat scheduler...${NC}"
uv run celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler &
BEAT_PID=$!

# Wait a moment for beat to start
sleep 2

# Check if beat started successfully
if ! kill -0 $BEAT_PID 2>/dev/null; then
    echo -e "${RED}Error: Failed to start Celery beat${NC}"
    kill $WORKER_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✓ Celery beat started (PID: $BEAT_PID)${NC}"

echo -e "\n${GREEN}All Celery services are running!${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "\nServices:"
echo -e "  • Worker PID: $WORKER_PID"
echo -e "  • Beat PID: $BEAT_PID"
echo -e "\nMonitoring logs..."

# Wait for background processes
wait
