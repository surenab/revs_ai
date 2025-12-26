#!/bin/bash

# Upload frontend build to server
# Run this from your local machine after building the frontend

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

echo -e "${YELLOW}📦 Building and uploading frontend...${NC}"

# Load deployment configuration
if [ -f "$APP_DIR/.deploy-config" ]; then
    source "$APP_DIR/.deploy-config"
    echo -e "${GREEN}✓ Loaded deployment configuration${NC}"
else
    echo -e "${YELLOW}⚠️  .deploy-config not found. Creating default...${NC}"
    cat > "$APP_DIR/.deploy-config" <<EOF
# Deployment Configuration
DEPLOY_SERVER=167.172.196.213
DEPLOY_USER=stocks
DEPLOY_PATH=~/apps/revs_ai
DEPLOY_DOMAIN=
DEPLOY_SSH_KEY=
EOF
    source "$APP_DIR/.deploy-config"
    echo -e "${YELLOW}Please edit .deploy-config with your server details${NC}"
    echo ""
fi

# Prompt for server details if not in configuration
if [ -z "$DEPLOY_SERVER" ] || [ "$DEPLOY_SERVER" = "YOUR_SERVER_IP" ]; then
    read -p "Enter server IP or hostname: " DEPLOY_SERVER
    # Update config file
    sed -i.bak "s/^DEPLOY_SERVER=.*/DEPLOY_SERVER=$DEPLOY_SERVER/" "$APP_DIR/.deploy-config" 2>/dev/null || \
    sed -i "s/^DEPLOY_SERVER=.*/DEPLOY_SERVER=$DEPLOY_SERVER/" "$APP_DIR/.deploy-config"
fi

if [ -z "$DEPLOY_USER" ] || [ "$DEPLOY_USER" = "YOUR_USERNAME" ]; then
    read -p "Enter server username [stocks]: " DEPLOY_USER
    DEPLOY_USER=${DEPLOY_USER:-stocks}
    sed -i.bak "s/^DEPLOY_USER=.*/DEPLOY_USER=$DEPLOY_USER/" "$APP_DIR/.deploy-config" 2>/dev/null || \
    sed -i "s/^DEPLOY_USER=.*/DEPLOY_USER=$DEPLOY_USER/" "$APP_DIR/.deploy-config"
fi

if [ -z "$DEPLOY_PATH" ] || [ "$DEPLOY_PATH" = "YOUR_APP_PATH" ]; then
    read -p "Enter server app path [~/apps/revs_ai]: " DEPLOY_PATH
    DEPLOY_PATH=${DEPLOY_PATH:-~/apps/revs_ai}
    sed -i.bak "s|^DEPLOY_PATH=.*|DEPLOY_PATH=$DEPLOY_PATH|" "$APP_DIR/.deploy-config" 2>/dev/null || \
    sed -i "s|^DEPLOY_PATH=.*|DEPLOY_PATH=$DEPLOY_PATH|" "$APP_DIR/.deploy-config"
fi

echo ""
echo -e "${YELLOW}Server: ${DEPLOY_USER}@${DEPLOY_SERVER}${NC}"
echo -e "${YELLOW}Path: ${DEPLOY_PATH}${NC}"
echo ""

# Build frontend
echo -e "${YELLOW}📦 Building frontend...${NC}"
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Build
echo "Building frontend..."
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}Error: Frontend build failed - dist directory not found${NC}"
    exit 1
fi

# Create archive
echo -e "${YELLOW}📦 Creating archive...${NC}"
tar -czf dist.tar.gz dist/

# Get file size
FILE_SIZE=$(du -h dist.tar.gz | cut -f1)
echo -e "${GREEN}✓ Archive created: dist.tar.gz (${FILE_SIZE})${NC}"

# Upload to server
echo -e "${YELLOW}📤 Uploading to server...${NC}"
if [ -n "$DEPLOY_SSH_KEY" ] && [ -f "$DEPLOY_SSH_KEY" ]; then
    scp -i "$DEPLOY_SSH_KEY" dist.tar.gz ${DEPLOY_USER}@${DEPLOY_SERVER}:${DEPLOY_PATH}/frontend/
else
    scp dist.tar.gz ${DEPLOY_USER}@${DEPLOY_SERVER}:${DEPLOY_PATH}/frontend/
fi

# Extract on server
echo -e "${YELLOW}📦 Extracting on server...${NC}"
if [ -n "$DEPLOY_SSH_KEY" ] && [ -f "$DEPLOY_SSH_KEY" ]; then
    ssh -i "$DEPLOY_SSH_KEY" ${DEPLOY_USER}@${DEPLOY_SERVER} "cd ${DEPLOY_PATH}/frontend && tar -xzf dist.tar.gz && rm dist.tar.gz"
else
    ssh ${DEPLOY_USER}@${DEPLOY_SERVER} "cd ${DEPLOY_PATH}/frontend && tar -xzf dist.tar.gz && rm dist.tar.gz"
fi

# Clean up local archive
rm dist.tar.gz

echo -e "${GREEN}✅ Frontend uploaded successfully!${NC}"
echo ""
echo "Next steps on server:"
if [ -n "$DEPLOY_SSH_KEY" ] && [ -f "$DEPLOY_SSH_KEY" ]; then
    echo "  ssh -i $DEPLOY_SSH_KEY ${DEPLOY_USER}@${DEPLOY_SERVER}"
else
    echo "  ssh ${DEPLOY_USER}@${DEPLOY_SERVER}"
fi
echo "  cd ${DEPLOY_PATH}"
echo "  ./scripts/deploy.sh"
