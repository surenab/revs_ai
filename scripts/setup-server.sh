#!/bin/bash

# Server setup script for DigitalOcean droplet
# This script sets up the server with all required dependencies
# Run this once on a fresh Ubuntu droplet

set -e

echo "🚀 Starting server setup for StockApp..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}Please do not run as root. Run as a regular user with sudo privileges.${NC}"
   exit 1
fi

echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

echo -e "${YELLOW}📦 Installing system dependencies...${NC}"
sudo apt install -y \
    build-essential \
    curl \
    wget \
    git \
    postgresql \
    postgresql-contrib \
    redis-server \
    nginx \
    certbot \
    python3-certbot-nginx \
    libpq-dev \
    python3-dev \
    python3-venv \
    ufw \
    fail2ban \
    unattended-upgrades

echo -e "${YELLOW}📦 Installing Node.js 20...${NC}"
# Check if Node.js is already installed
if ! command -v node &> /dev/null; then
    # Install Node.js 20 from NodeSource (includes npm)
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js is already installed: $(node --version)"
    # Verify npm is available
    if ! command -v npm &> /dev/null; then
        echo "npm is missing, installing Node.js from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
fi

# Verify Node.js and npm installation
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

echo -e "${YELLOW}🐍 Installing Python 3.13...${NC}"
# Add deadsnakes PPA for Python 3.13
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3.13-dev

echo -e "${YELLOW}📦 Installing uv (Python package manager)...${NC}"
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

echo -e "${YELLOW}🗄️  Setting up PostgreSQL...${NC}"
# PostgreSQL will be configured later with database creation

echo -e "${YELLOW}🔴 Setting up Redis...${NC}"
# Check if Redis is already running
if sudo systemctl is-active --quiet redis-server; then
    echo "Redis is already running"
else
    # Enable Redis
    sudo systemctl enable redis-server

    # Try to start Redis
    if sudo systemctl start redis-server; then
        echo "Redis started successfully"
    else
        echo -e "${YELLOW}⚠️  Redis failed to start. Checking status...${NC}"
        sudo systemctl status redis-server --no-pager -l || true
        echo -e "${YELLOW}Attempting to fix Redis configuration...${NC}"

        # Check if Redis config exists and fix common issues
        if [ -f /etc/redis/redis.conf ]; then
            # Make sure Redis is configured to bind to localhost
            sudo sed -i 's/^bind.*/bind 127.0.0.1/' /etc/redis/redis.conf || true
            # Make sure protected mode is set appropriately
            sudo sed -i 's/^protected-mode.*/protected-mode yes/' /etc/redis/redis.conf || true
        fi

        # Try starting again
        sudo systemctl start redis-server || {
            echo -e "${RED}Redis still failed to start. You may need to check logs manually:${NC}"
            echo "  sudo journalctl -xeu redis-server.service"
            echo "  sudo tail -f /var/log/redis/redis-server.log"
        }
    fi
fi

# Verify Redis is running
if sudo systemctl is-active --quiet redis-server; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠️  Redis is not running. You may need to start it manually later.${NC}"
fi

echo -e "${YELLOW}🌐 Configuring firewall...${NC}"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo -e "${YELLOW}🔒 Setting up automatic security updates...${NC}"
sudo dpkg-reconfigure -plow unattended-upgrades

echo -e "${YELLOW}🛡️  Setting up Fail2Ban...${NC}"
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

echo -e "${GREEN}✅ Server setup completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Clone your repository: git clone https://github.com/surenab/revs_ai.git"
echo "2. Run: cd revs_ai && ./scripts/setup-app.sh"
echo "3. Configure your .env.production file"
echo "4. Run: ./scripts/deploy.sh"
