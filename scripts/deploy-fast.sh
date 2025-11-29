#!/bin/bash

# Fast deployment script - skips frontend build
# Use this when frontend hasn't changed or you've built it locally

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

echo -e "${YELLOW}🚀 Starting fast deployment (skipping frontend build)...${NC}"

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

echo -e "${YELLOW}⏭️  Skipping frontend build (using existing build)${NC}"

echo -e "${YELLOW}🔄 Running database migrations...${NC}"
uv run python manage.py migrate --settings=config.settings.production

echo -e "${YELLOW}📁 Collecting static files...${NC}"
uv run python manage.py collectstatic --noinput --settings=config.settings.production

echo -e "${YELLOW}🔄 Restarting services...${NC}"
sudo systemctl restart gunicorn
sudo systemctl restart celery-worker
sudo systemctl restart celery-beat
sudo systemctl reload nginx

echo -e "${GREEN}✅ Fast deployment completed successfully!${NC}"
echo ""
echo "Services status:"
sudo systemctl status gunicorn --no-pager -l
sudo systemctl status celery-worker --no-pager -l
sudo systemctl status celery-beat --no-pager -l
