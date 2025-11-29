# 🚀 DigitalOcean Deployment Guide

Complete step-by-step guide to deploy StockApp on a DigitalOcean droplet.

## 📋 Prerequisites

- DigitalOcean account
- Domain name (optional but recommended)
- SSH key pair
- GitHub repository access

## 🖥️ Step 1: Create DigitalOcean Droplet

1. **Log in to DigitalOcean** and click "Create" → "Droplets"

2. **Choose Configuration:**
   - **Image**: Ubuntu 22.04 LTS (or latest LTS)
   - **Plan**:
     - Minimum: 2GB RAM / 1 vCPU ($12/month)
     - Recommended: 4GB RAM / 2 vCPU ($24/month) for production
   - **Datacenter**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password
   - **Hostname**: `stocks-app` (or your preferred name)

3. **Click "Create Droplet"** and wait for it to be ready

4. **Note the IP address** - you'll need this for SSH and domain configuration

## 🔐 Step 2: Initial Server Setup

### 2.1 Connect to Your Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

### 2.2 Create a Non-Root User

```bash
# Create new user
adduser stocks
usermod -aG sudo stocks

# Switch to new user
su - stocks
```

### 2.3 Set Up SSH Key (if not done during droplet creation)

```bash
# On your local machine, copy your SSH key
ssh-copy-id stocks@YOUR_DROPLET_IP
```

### 2.4 Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw
```

### 2.5 Configure Firewall

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## 🐳 Step 3: Install Docker and Docker Compose

### 3.1 Install Docker

```bash
# Remove old versions (errors are OK if packages don't exist)
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null || true

# Install prerequisites
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index (IMPORTANT: must run after adding repository)
sudo apt update

# Install Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker stocks

# Verify installation
docker --version
docker compose version
```

**If you get "Package docker-ce has no installation candidate" errors:**

1. **Check your Ubuntu version:**
   ```bash
   lsb_release -cs
   ```

2. **Verify the repository was added correctly:**
   ```bash
   cat /etc/apt/sources.list.d/docker.list
   ```

3. **Try alternative installation method (if above doesn't work):**
   ```bash
   # Remove any existing Docker repository
   sudo rm -f /etc/apt/sources.list.d/docker.list

   # Use Docker's convenience script (recommended for Ubuntu)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Add user to docker group
   sudo usermod -aG docker stocks

   # Install Docker Compose plugin
   sudo apt update
   sudo apt install -y docker-compose-plugin

   # Verify installation
   docker --version
   docker compose version
   ```

### 3.2 Logout and Login Again

```bash
exit
# SSH back in
ssh stocks@YOUR_DROPLET_IP
```

## 📦 Step 4: Clone and Set Up Application

### 4.1 Clone Repository

```bash
# Create app directory
mkdir -p ~/apps
cd ~/apps

# Clone your repository
git clone https://github.com/surenab/revs_ai
cd revs_ai
```

### 4.2 Create Environment File

```bash
# Copy example env file
cp env.example .env.production

# Edit the environment file
nano .env.production
```

### 4.3 Configure Environment Variables

Edit `.env.production` with the following values:

```bash
# Django Settings
DEBUG=False
SECRET_KEY=your-super-secret-key-here-generate-with-openssl-rand-hex-32
ALLOWED_HOSTS=your-domain.com,www.your-domain.com,YOUR_DROPLET_IP

# Database
DB_NAME=stocks_prod
DB_USER=postgres
DB_PASSWORD=your-strong-database-password-here
DB_HOST=db
DB_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/1

# Email Configuration (for password resets, etc.)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=noreply@your-domain.com

# Sentry (optional but recommended for error tracking)
SENTRY_DSN=your-sentry-dsn-here

# Frontend API URL
REACT_APP_API_URL=https://your-domain.com/api
```

**Generate SECRET_KEY:**
```bash
openssl rand -hex 32
```

### 4.4 Update Nginx Configuration

```bash
# Edit nginx configuration
nano nginx/default.conf
```

Update the `server_name` line:
```nginx
server_name your-domain.com www.your-domain.com;
```

## 🌐 Step 5: Set Up Domain (Optional but Recommended)

### 5.1 Configure DNS

1. Go to your domain registrar
2. Add A records:
   - `@` → `YOUR_DROPLET_IP`
   - `www` → `YOUR_DROPLET_IP`

### 5.2 Install Certbot for SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
```

## 🏗️ Step 6: Build and Deploy Application

### 6.1 Build Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm install

# Build for production
npm run build

# Go back to root
cd ..
```

### 6.2 Update Docker Compose for Production

The production setup uses Docker Compose. Make sure your `docker-compose.production.yml` is configured correctly.

### 6.3 Start Services

```bash
# Build and start services
sudo docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build

# Check logs
sudo docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f
```

### 6.4 Run Migrations

```bash
# Run database migrations
sudo docker compose -f docker-compose.yml -f docker-compose.production.yml exec web python manage.py migrate

# Create superuser
sudo docker compose -f docker-compose.yml -f docker-compose.production.yml exec web python manage.py createsuperuser
```

### 6.5 Collect Static Files

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.production.yml exec web python manage.py collectstatic --noinput
```

## 🔒 Step 7: Set Up SSL with Let's Encrypt

### 7.1 If Using Nginx Inside Docker

You'll need to set up SSL certificates manually or use a reverse proxy outside Docker.

**Option A: Use Certbot with Nginx on Host**

```bash
# Install Nginx on host
sudo apt install -y nginx

# Stop Docker nginx temporarily
docker compose -f docker-compose.yml -f docker-compose.production.yml stop nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Configure Nginx on host to proxy to Docker
sudo nano /etc/nginx/sites-available/stocks
```

Add this configuration:

```nginx
upstream django {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Include SSL configuration
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Static files
    location /static/ {
        alias /home/stocks/apps/stocks/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /home/stocks/apps/stocks/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Proxy to Django
    location / {
        proxy_pass http://django;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/stocks /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Option B: Use Docker with SSL Certificates**

```bash
# Create SSL directory
mkdir -p ssl

# Copy certificates to ssl directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
sudo chown -R stocks:stocks ssl/
```

### 7.2 Auto-Renewal for SSL

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up renewal, but verify
sudo systemctl status certbot.timer
```

## 🔄 Step 8: Set Up Celery Worker

### 8.1 Create Celery Systemd Service

```bash
sudo nano /etc/systemd/system/celery-worker.service
```

Add this configuration:

```ini
[Unit]
Description=Celery Worker for Stocks App
After=network.target

[Service]
Type=forking
User=stocks
Group=stocks
WorkingDirectory=/home/stocks/apps/stocks
Environment="PATH=/home/stocks/apps/stocks/.venv/bin"
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=/home/stocks/apps/stocks/.venv/bin/celery -A config worker --loglevel=info --logfile=/app/logs/worker.log --pidfile=/var/run/celery/worker.pid --detach
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

### 8.2 Create Celery Beat Service

```bash
sudo nano /etc/systemd/system/celery-beat.service
```

Add this configuration:

```ini
[Unit]
Description=Celery Beat for Stocks App
After=network.target

[Service]
Type=forking
User=stocks
Group=stocks
WorkingDirectory=/home/stocks/apps/stocks
Environment="PATH=/home/stocks/apps/stocks/.venv/bin"
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=/home/stocks/apps/stocks/.venv/bin/celery -A config beat --loglevel=info --logfile=/app/logs/beat.log --pidfile=/var/run/celery/beat.pid --detach
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

### 8.3 Create Directories and Start Services

```bash
# Create directories
sudo mkdir -p /apps/logs /var/run/celery
sudo chown -R stocks:stocks /apps/logs /var/run/celery

# Reload systemd
sudo systemctl daemon-reload

# Enable and start services
sudo systemctl enable celery-worker celery-beat
sudo systemctl start celery-worker celery-beat

# Check status
sudo systemctl status celery-worker
sudo systemctl status celery-beat
```

## 📊 Step 9: Set Up Monitoring (Optional)

### 9.1 Check Application Health

```bash
# Check if all containers are running
docker compose -f docker-compose.yml -f docker-compose.production.yml ps

# Check logs
docker compose -f docker-compose.yml -f docker-compose.production.yml logs web
docker compose -f docker-compose.yml -f docker-compose.production.yml logs nginx
```

### 9.2 Set Up Log Rotation

```bash
sudo nano /etc/logrotate.d/stocks
```

Add:

```
/home/stocks/apps/stocks/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 stocks stocks
    sharedscripts
}
```

## 🔄 Step 10: Set Up Automated Backups

### 10.1 Create Backup Script

```bash
nano ~/backup-stocks.sh
```

Add:

```bash
#!/bin/bash

BACKUP_DIR="/home/stocks/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="stocks_prod"
DB_USER="postgres"
CONTAINER_NAME="stocks-db-1"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_$DATE.sql

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

```bash
# Make executable
chmod +x ~/backup-stocks.sh

# Test backup
~/backup-stocks.sh
```

### 10.2 Set Up Cron Job for Backups

```bash
crontab -e
```

Add:

```
# Daily backup at 2 AM
0 2 * * * /home/stocks/backup-stocks.sh >> /home/stocks/backup.log 2>&1
```

## 🚀 Step 11: Deploy Frontend

### 11.1 Serve Frontend with Nginx

Update your Nginx configuration to serve the built frontend:

```nginx
# In your nginx configuration, add:
location / {
    root /home/stocks/apps/stocks/frontend/dist;
    try_files $uri $uri/ /index.html;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# API proxy
location /api/ {
    proxy_pass http://django;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 🔧 Step 12: Maintenance Commands

### Useful Commands

```bash
# View logs
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f web
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f nginx

# Restart services
docker compose -f docker-compose.yml -f docker-compose.production.yml restart

# Stop services
docker compose -f docker-compose.yml -f docker-compose.production.yml down

# Start services
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d

# Update application
cd ~/apps/stocks
git pull
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.production.yml exec web python manage.py migrate
docker compose -f docker-compose.yml -f docker-compose.production.yml exec web python manage.py collectstatic --noinput

# Rebuild frontend
cd frontend
npm install
npm run build
cd ..
```

## 🛡️ Step 13: Security Hardening

### 13.1 Set Up Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 13.2 Disable Root Login (Optional)

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 13.3 Set Up Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## ✅ Step 14: Verify Deployment

1. **Check Application**: Visit `https://your-domain.com`
2. **Check API**: Visit `https://your-domain.com/api/`
3. **Check Admin**: Visit `https://your-domain.com/admin/`
4. **Check Health**: Visit `https://your-domain.com/health/`

## 🐛 Troubleshooting

### Application Not Starting

```bash
# Check Docker logs
docker compose -f docker-compose.yml -f docker-compose.production.yml logs

# Check system resources
df -h
free -h

# Check if ports are in use
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

### Database Connection Issues

```bash
# Check database container
docker compose -f docker-compose.yml -f docker-compose.production.yml ps db

# Check database logs
docker compose -f docker-compose.yml -f docker-compose.production.yml logs db

# Test connection
docker compose -f docker-compose.yml -f docker-compose.production.yml exec db psql -U postgres -d stocks_prod
```

### SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx configuration
sudo nginx -t
```

## 📝 Next Steps

1. **Set up monitoring** (Prometheus, Grafana, or Sentry)
2. **Configure email** for notifications
3. **Set up CI/CD** pipeline for automated deployments
4. **Configure CDN** for static assets (Cloudflare, etc.)
5. **Set up database backups** to external storage (S3, etc.)

## 📚 Additional Resources

- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Congratulations!** Your StockApp should now be running on DigitalOcean! 🎉
