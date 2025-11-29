#!/bin/bash

# Setup systemd services
# Run this once to create systemd service files

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

USER=$(whoami)

echo -e "${YELLOW}🔧 Setting up systemd services...${NC}"

# Install uv if not in PATH
if ! command -v uv &> /dev/null; then
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Get Python path from uv
PYTHON_PATH=$(uv run which python)
VENV_PATH=$(dirname $(dirname "$PYTHON_PATH"))

echo -e "${YELLOW}Creating Gunicorn service...${NC}"
sudo tee /etc/systemd/system/gunicorn.service > /dev/null <<EOF
[Unit]
Description=Gunicorn daemon for StockApp
After=network.target postgresql.service redis-server.service

[Service]
User=${USER}
Group=${USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${VENV_PATH}/bin"
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=${VENV_PATH}/bin/gunicorn \\
    --workers 3 \\
    --timeout 120 \\
    --bind 127.0.0.1:8080 \\
    --access-logfile ${APP_DIR}/logs/gunicorn-access.log \\
    --error-logfile ${APP_DIR}/logs/gunicorn-error.log \\
    config.wsgi:application

Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo -e "${YELLOW}Creating Celery Worker service...${NC}"
sudo tee /etc/systemd/system/celery-worker.service > /dev/null <<EOF
[Unit]
Description=Celery Worker for StockApp
After=network.target redis-server.service postgresql.service

[Service]
Type=forking
User=${USER}
Group=${USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${VENV_PATH}/bin"
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=${VENV_PATH}/bin/celery -A config worker \\
    --loglevel=info \\
    --logfile=${APP_DIR}/logs/celery-worker.log \\
    --pidfile=/var/run/celery/worker.pid \\
    --detach
ExecStop=/bin/kill -s TERM \$MAINPID
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo -e "${YELLOW}Creating Celery Beat service...${NC}"
sudo tee /etc/systemd/system/celery-beat.service > /dev/null <<EOF
[Unit]
Description=Celery Beat for StockApp
After=network.target redis-server.service postgresql.service

[Service]
Type=forking
User=${USER}
Group=${USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${VENV_PATH}/bin"
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=${VENV_PATH}/bin/celery -A config beat \\
    --loglevel=info \\
    --logfile=${APP_DIR}/logs/celery-beat.log \\
    --pidfile=/var/run/celery/beat.pid \\
    --detach
ExecStop=/bin/kill -s TERM \$MAINPID
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
sudo mkdir -p /var/run/celery
sudo chown -R ${USER}:${USER} /var/run/celery
mkdir -p ${APP_DIR}/logs

# Reload systemd
sudo systemctl daemon-reload

# Enable services
echo -e "${YELLOW}Enabling services...${NC}"
sudo systemctl enable gunicorn
sudo systemctl enable celery-worker
sudo systemctl enable celery-beat

echo -e "${GREEN}✅ Services created and enabled!${NC}"
echo ""
echo "To start services, run:"
echo "  sudo systemctl start gunicorn"
echo "  sudo systemctl start celery-worker"
echo "  sudo systemctl start celery-beat"
echo ""
echo "Or run: ./scripts/deploy.sh (which will restart them)"
