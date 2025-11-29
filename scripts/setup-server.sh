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
    nodejs \
    npm \
    ufw \
    fail2ban \
    unattended-upgrades

echo -e "${YELLOW}🐍 Installing Python 3.13...${NC}"
# Add deadsnakes PPA for Python 3.13
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3.13-dev

echo -e "${YELLOW}📦 Installing uv (Python package manager)...${NC}"
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.cargo/bin:$PATH"

echo -e "${YELLOW}🗄️  Setting up PostgreSQL...${NC}"
# PostgreSQL will be configured later with database creation

echo -e "${YELLOW}🔴 Setting up Redis...${NC}"
sudo systemctl enable redis-server
sudo systemctl start redis-server

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
