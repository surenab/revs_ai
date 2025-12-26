#!/bin/bash

# Initialize deployment configuration
# Run this once to set up your deployment settings

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

CONFIG_FILE="$APP_DIR/.deploy-config"

echo -e "${YELLOW}🔧 Setting up deployment configuration...${NC}"
echo ""

# Check if config already exists
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Configuration file already exists.${NC}"
    read -p "Do you want to update it? (y/n): " UPDATE
    if [ "$UPDATE" != "y" ] && [ "$UPDATE" != "Y" ]; then
        echo "Cancelled."
        exit 0
    fi
    echo ""
fi

# Get server details
read -p "Enter server IP or hostname [167.172.196.213]: " SERVER_IP
SERVER_IP=${SERVER_IP:-167.172.196.213}

read -p "Enter server username [stocks]: " SERVER_USER
SERVER_USER=${SERVER_USER:-stocks}

read -p "Enter server app path [~/apps/revs_ai]: " APP_PATH
APP_PATH=${APP_PATH:-~/apps/revs_ai}

read -p "Enter domain name (optional, press Enter to skip): " DOMAIN

read -p "Enter SSH key path (optional, press Enter to use default): " SSH_KEY

# Create config file
cat > "$CONFIG_FILE" <<EOF
# Deployment Configuration
# This file stores deployment settings used by deployment scripts
# Generated on $(date)

# Server connection details
DEPLOY_SERVER=$SERVER_IP
DEPLOY_USER=$SERVER_USER
DEPLOY_PATH=$APP_PATH

# Domain (optional - leave empty if using IP)
DEPLOY_DOMAIN=$DOMAIN

# SSH key path (optional - leave empty to use default)
DEPLOY_SSH_KEY=$SSH_KEY
EOF

echo ""
echo -e "${GREEN}✅ Deployment configuration created!${NC}"
echo ""
echo "Configuration saved to: $CONFIG_FILE"
echo ""
echo "Settings:"
echo "  Server: ${SERVER_USER}@${SERVER_IP}"
echo "  Path: ${APP_PATH}"
if [ -n "$DOMAIN" ]; then
    echo "  Domain: ${DOMAIN}"
else
    echo "  Domain: (using IP)"
fi
if [ -n "$SSH_KEY" ]; then
    echo "  SSH Key: ${SSH_KEY}"
else
    echo "  SSH Key: (using default)"
fi
echo ""
echo "You can edit this file anytime: nano .deploy-config"
