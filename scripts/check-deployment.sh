#!/bin/bash

# Deployment check script
# Helps diagnose deployment issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
echo ""

# Check Gunicorn
echo -e "${YELLOW}Checking Gunicorn...${NC}"
if sudo systemctl is-active --quiet gunicorn; then
    echo -e "${GREEN}✓ Gunicorn is running${NC}"
    sudo systemctl status gunicorn --no-pager -l | head -5
else
    echo -e "${RED}✗ Gunicorn is NOT running${NC}"
    echo "Start it with: sudo systemctl start gunicorn"
fi
echo ""

# Check if Gunicorn is listening on port 8080
echo -e "${YELLOW}Checking if Gunicorn is listening on port 8080...${NC}"
if sudo netstat -tulpn | grep -q ":8080"; then
    echo -e "${GREEN}✓ Port 8080 is in use${NC}"
    sudo netstat -tulpn | grep ":8080"
else
    echo -e "${RED}✗ Nothing is listening on port 8080${NC}"
    echo "Gunicorn may not be running or configured correctly"
fi
echo ""

# Check Nginx
echo -e "${YELLOW}Checking Nginx...${NC}"
if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
    sudo systemctl status nginx --no-pager -l | head -5
else
    echo -e "${RED}✗ Nginx is NOT running${NC}"
    echo "Start it with: sudo systemctl start nginx"
fi
echo ""

# Check Nginx configuration
echo -e "${YELLOW}Checking Nginx configuration...${NC}"
if sudo nginx -t; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
fi
echo ""

# Check if stocks site is enabled
echo -e "${YELLOW}Checking Nginx sites...${NC}"
if [ -L /etc/nginx/sites-enabled/stocks ]; then
    echo -e "${GREEN}✓ Stocks site is enabled${NC}"
    echo "Configuration file:"
    ls -la /etc/nginx/sites-enabled/stocks
else
    echo -e "${RED}✗ Stocks site is NOT enabled${NC}"
    echo "Enable it with: sudo ln -s /etc/nginx/sites-available/stocks /etc/nginx/sites-enabled/stocks"
fi
echo ""

# Check if default site is disabled
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo -e "${YELLOW}⚠️  Default Nginx site is still enabled (this may cause conflicts)${NC}"
    echo "Disable it with: sudo rm /etc/nginx/sites-enabled/default"
else
    echo -e "${GREEN}✓ Default site is disabled${NC}"
fi
echo ""

# Check if port 80 is in use
echo -e "${YELLOW}Checking port 80...${NC}"
if sudo netstat -tulpn | grep -q ":80"; then
    echo -e "${GREEN}✓ Port 80 is in use${NC}"
    sudo netstat -tulpn | grep ":80"
else
    echo -e "${RED}✗ Nothing is listening on port 80${NC}"
fi
echo ""

# Test Gunicorn directly
echo -e "${YELLOW}Testing Gunicorn directly...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/admin/ | grep -q "200\|301\|302\|403"; then
    echo -e "${GREEN}✓ Gunicorn is responding on port 8080${NC}"
else
    echo -e "${RED}✗ Gunicorn is NOT responding on port 8080${NC}"
    echo "Try: curl http://localhost:8080/admin/"
fi
echo ""

# Check frontend build
echo -e "${YELLOW}Checking frontend build...${NC}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

if [ -d "$APP_DIR/frontend/dist" ]; then
    echo -e "${GREEN}✓ Frontend dist directory exists${NC}"
    echo "Files: $(ls -1 $APP_DIR/frontend/dist | wc -l) files"
    if [ -f "$APP_DIR/frontend/dist/index.html" ]; then
        echo -e "${GREEN}✓ index.html exists${NC}"
    else
        echo -e "${RED}✗ index.html is missing${NC}"
    fi
else
    echo -e "${RED}✗ Frontend dist directory does NOT exist${NC}"
    echo "Build frontend with: cd frontend && npm run build"
fi
echo ""

# Check static files
echo -e "${YELLOW}Checking static files...${NC}"
if [ -d "$APP_DIR/staticfiles" ]; then
    echo -e "${GREEN}✓ Static files directory exists${NC}"
    echo "Files: $(find $APP_DIR/staticfiles -type f | wc -l) files"
else
    echo -e "${YELLOW}⚠️  Static files directory does not exist${NC}"
    echo "Run: python manage.py collectstatic --settings=config.settings.production"
fi
echo ""

# Summary
echo -e "${YELLOW}📋 Summary:${NC}"
echo "1. Check Gunicorn logs: sudo journalctl -u gunicorn -n 50"
echo "2. Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "3. Test locally: curl http://localhost:8080"
echo "4. Reload Nginx: sudo systemctl reload nginx"
