#!/bin/bash

# Production deployment script for DigitalOcean
# Usage: ./scripts/deploy-production.sh

set -e

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    echo "Please create .env.production from env.example and configure it."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed!${NC}"
    echo "Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed!${NC}"
    echo "Please install Docker Compose first."
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Build frontend
echo -e "${YELLOW}📦 Building frontend...${NC}"
cd frontend
if [ ! -d node_modules ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run build
cd ..

# Pull latest changes
echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
git pull

# Build and start Docker containers
echo -e "${YELLOW}🐳 Building Docker images...${NC}"
docker compose -f docker-compose.yml -f docker-compose.production.yml build

echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 10

# Run migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
docker compose -f docker-compose.yml -f docker-compose.production.yml exec -T web python manage.py migrate --noinput

# Collect static files
echo -e "${YELLOW}📁 Collecting static files...${NC}"
docker compose -f docker-compose.yml -f docker-compose.production.yml exec -T web python manage.py collectstatic --noinput

# Restart services to ensure everything is up
echo -e "${YELLOW}🔄 Restarting services...${NC}"
docker compose -f docker-compose.yml -f docker-compose.production.yml restart

# Check service status
echo -e "${YELLOW}📊 Checking service status...${NC}"
docker compose -f docker-compose.yml -f docker-compose.production.yml ps

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Check logs: docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f"
echo "2. Create superuser: docker compose -f docker-compose.yml -f docker-compose.production.yml exec web python manage.py createsuperuser"
echo "3. Verify application is running at your domain"
