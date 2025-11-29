#!/bin/bash

# Setup Nginx configuration
# Run this once to configure Nginx

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${YELLOW}🌐 Setting up Nginx configuration...${NC}"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production not found!${NC}"
    exit 1
fi

# Source environment variables to get domain
set -a
source .env.production
set +a

# Get domain from ALLOWED_HOSTS or prompt
DOMAIN=$(echo $ALLOWED_HOSTS | cut -d',' -f1 | xargs)
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ] || [ "$DOMAIN" = "127.0.0.1" ]; then
    read -p "Enter your domain name (or press Enter to use IP): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        DOMAIN="_"
    fi
fi

# Check if DOMAIN is an IP address
IS_IP=false
if [[ $DOMAIN =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    IS_IP=true
    echo -e "${YELLOW}⚠️  IP address detected. SSL certificates are not available for IP addresses.${NC}"
    echo -e "${YELLOW}   Creating HTTP-only configuration. You can add SSL later when you have a domain.${NC}"
fi

echo -e "${YELLOW}Creating Nginx configuration for: ${DOMAIN}${NC}"

# Create Nginx configuration
if [ "$IS_IP" = true ]; then
    # HTTP-only configuration for IP address
    sudo tee /etc/nginx/sites-available/stocks > /dev/null <<EOF
# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login:10m rate=2r/s;

# Upstream Django
upstream django {
    server 127.0.0.1:8080;
}

# HTTP server (no SSL for IP addresses)
server {
    listen 80;
    server_name ${DOMAIN};

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Client max body size
    client_max_body_size 100M;

    # Static files
    location /static/ {
        alias ${APP_DIR}/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias ${APP_DIR}/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Frontend files (served from Django or build directory)
    location / {
        # Try to serve from frontend build, fallback to Django
        try_files \$uri \$uri/ @django;
    }

    location @django {
        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Auth endpoints with stricter rate limiting
    location /api/v1/auth/ {
        limit_req zone=login burst=5 nodelay;

        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # Admin interface
    location /admin/ {
        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # Health check
    location /health/ {
        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        access_log off;
    }
}
EOF
else
    # HTTPS configuration for domain name
    sudo tee /etc/nginx/sites-available/stocks > /dev/null <<EOF
# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login:10m rate=2r/s;

# Upstream Django
upstream django {
    server 127.0.0.1:8080;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ${DOMAIN};

    # For Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # SSL Configuration (will be updated by Certbot)
    # Note: These paths will be created when you run certbot
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Client max body size
    client_max_body_size 100M;

    # Static files
    location /static/ {
        alias ${APP_DIR}/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias ${APP_DIR}/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Frontend files (served from Django or build directory)
    location / {
        # Try to serve from frontend build, fallback to Django
        try_files \$uri \$uri/ @django;
    }

    location @django {
        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Auth endpoints with stricter rate limiting
    location /api/v1/auth/ {
        limit_req zone=login burst=5 nodelay;

        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # Admin interface
    location /admin/ {
        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # Health check
    location /health/ {
        proxy_pass http://django;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        access_log off;
    }
}
EOF
fi

# Enable site
sudo ln -sf /etc/nginx/sites-available/stocks /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo -e "${YELLOW}Testing Nginx configuration...${NC}"
sudo nginx -t

echo -e "${GREEN}✅ Nginx configuration created!${NC}"
echo ""
if [ "$IS_IP" = true ]; then
    echo "⚠️  IP address detected - HTTP-only configuration created."
    echo "   SSL certificates are not available for IP addresses."
    echo "   To enable HTTPS, you'll need to:"
    echo "   1. Point a domain name to this IP address"
    echo "   2. Update ALLOWED_HOSTS in .env.production"
    echo "   3. Run: sudo certbot --nginx -d your-domain.com"
    echo ""
    echo "For now, the application will work over HTTP."
else
    echo "Next steps:"
    echo "1. Set up SSL: sudo certbot --nginx -d ${DOMAIN}"
    echo "   (This will automatically configure SSL certificates)"
    echo "2. Or reload Nginx now for HTTP-only: sudo systemctl reload nginx"
fi
echo ""
echo "Reload Nginx: sudo systemctl reload nginx"
