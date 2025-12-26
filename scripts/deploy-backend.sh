#!/bin/bash

# Backend-only deployment script
# Use this when only backend code has changed

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$APP_DIR"

echo -e "${YELLOW}🚀 Starting backend deployment...${NC}"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production not found!${NC}"
    echo "Please create it from env.example and configure it."
    exit 1
fi

# Source environment variables
set -a
source .env.production
set +a

# Install uv if not in PATH
if ! command -v uv &> /dev/null; then
    export PATH="$HOME/.local/bin:$PATH"
fi

echo -e "${YELLOW}📦 Updating Python dependencies...${NC}"
uv sync --all-groups

echo -e "${YELLOW}🔄 Running database migrations...${NC}"
uv run python manage.py migrate --settings=config.settings.production

echo -e "${YELLOW}📁 Collecting static files...${NC}"
uv run python manage.py collectstatic --noinput --settings=config.settings.production

echo -e "${YELLOW}🔄 Restarting services...${NC}"
sudo systemctl restart gunicorn
sudo systemctl restart celery-worker
sudo systemctl restart celery-beat
sudo systemctl reload nginx

echo -e "${GREEN}✅ Backend deployment completed successfully!${NC}"
echo ""
echo "Services status:"
sudo systemctl status gunicorn --no-pager -l
sudo systemctl status celery-worker --no-pager -l
sudo systemctl status celery-beat --no-pager -l
