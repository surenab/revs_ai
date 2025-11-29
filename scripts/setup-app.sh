#!/bin/bash

# Application setup script
# Run this after cloning the repository to set up the application

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

echo -e "${YELLOW}📦 Setting up Python environment...${NC}"

# Install uv if not in PATH
if ! command -v uv &> /dev/null; then
    export PATH="$HOME/.local/bin:$PATH"
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}Error: uv is not installed. Please run ./scripts/setup-server.sh first.${NC}"
        exit 1
    fi
fi

# Install Python dependencies
uv sync --all-groups

echo -e "${YELLOW}📦 Setting up frontend...${NC}"
cd frontend
npm install
cd ..

echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p staticfiles media logs backups

echo -e "${YELLOW}🗄️  Setting up database...${NC}"
# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${YELLOW}⚠️  .env.production not found. Creating from env.example...${NC}"
    cp env.example .env.production
    echo -e "${RED}⚠️  Please edit .env.production with your production settings!${NC}"
    echo ""
    echo "Required settings:"
    echo "  - SECRET_KEY (generate with: openssl rand -hex 32)"
    echo "  - DEBUG=False"
    echo "  - ALLOWED_HOSTS=your-domain.com"
    echo "  - DB_NAME, DB_USER, DB_PASSWORD"
    echo "  - Email configuration"
    echo ""
    read -p "Press Enter after you've configured .env.production..."
fi

# Source environment variables
set -a
source .env.production
set +a

# Create database and user if they don't exist
echo -e "${YELLOW}Creating PostgreSQL database and user...${NC}"

# Check if database exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME:-stocks_prod}'")

if [ "$DB_EXISTS" != "1" ]; then
    echo "Creating database ${DB_NAME:-stocks_prod}..."
    sudo -u postgres createdb ${DB_NAME:-stocks_prod}
else
    echo "Database ${DB_NAME:-stocks_prod} already exists."
fi

# Check if user exists
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_user WHERE usename='${DB_USER:-stocks_user}'")

if [ "$USER_EXISTS" != "1" ]; then
    echo "Creating user ${DB_USER:-stocks_user}..."
    sudo -u postgres psql -c "CREATE USER ${DB_USER:-stocks_user} WITH PASSWORD '${DB_PASSWORD}';"
else
    echo "User ${DB_USER:-stocks_user} already exists. Updating password..."
    sudo -u postgres psql -c "ALTER USER ${DB_USER:-stocks_user} WITH PASSWORD '${DB_PASSWORD}';"
fi

# Grant privileges
echo "Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME:-stocks_prod} TO ${DB_USER:-stocks_user};"
sudo -u postgres psql -c "ALTER USER ${DB_USER:-stocks_user} CREATEDB;"

# Update .env.production to use localhost for DB_HOST
sed -i 's/DB_HOST=db/DB_HOST=localhost/' .env.production
sed -i 's/REDIS_URL=redis:\/\/redis:6379\/1/REDIS_URL=redis:\/\/localhost:6379\/1/' .env.production

echo -e "${GREEN}✅ Application setup completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Review and update .env.production"
echo "2. Run: ./scripts/deploy.sh"
