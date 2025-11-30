# 🚀 DigitalOcean Deployment Guide (No Docker)

Complete step-by-step guide to deploy StockApp directly on a DigitalOcean droplet without Docker.

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

5. **Configure deployment settings** (on your local machine):
   ```bash
   # Run the configuration script
   ./scripts/init-deploy-config.sh
   ```

   This will create a `.deploy-config` file with your server details that all deployment scripts will use automatically.

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

### 2.4 Logout and Login as New User

```bash
exit
# SSH back in as the new user
ssh stocks@YOUR_DROPLET_IP
```

## 🛠️ Step 3: Run Server Setup Script

This script installs all system dependencies.

```bash
# Clone your repository
git clone https://github.com/surenab/revs_ai.git
cd revs_ai

# Make scripts executable
chmod +x scripts/*.sh

# Run server setup (installs all system dependencies)
./scripts/setup-server.sh
```

This will install:
- Python 3.13
- PostgreSQL
- Redis
- Nginx
- Node.js and npm
- uv (Python package manager)
- Certbot (for SSL)
- Security tools (UFW, Fail2Ban)

**Note:** The script will take a few minutes to complete.

## 📦 Step 4: Set Up Application

### 4.1 Configure Environment Variables

```bash
# Copy example env file
cp env.example .env.production

# Edit the environment file
nano .env.production
```

Configure the following values:

```bash
# Django Settings
DEBUG=False
SECRET_KEY=your-super-secret-key-here-generate-with-openssl-rand-hex-32
ALLOWED_HOSTS=your-domain.com,www.your-domain.com,YOUR_DROPLET_IP

# Database Configuration
DB_NAME=stocks_prod
DB_USER=stocks_user
DB_PASSWORD=your-strong-database-password-here
DB_HOST=localhost
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://localhost:6379/1

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

### 4.2 Run Application Setup

```bash
# This will:
# - Set up Python virtual environment
# - Install Python dependencies
# - Create database and user
# Note: Frontend will be uploaded separately from local machine
./scripts/setup-app.sh
```

The script will:
- Install Python dependencies using `uv`
- Create necessary directories
- Set up PostgreSQL database and user
- Update environment variables for localhost

**Note:** Frontend setup is skipped on the server. You'll build and upload it from your local machine (see Step 6.1).

## 🔧 Step 5: Set Up Systemd Services

Create systemd service files for Gunicorn, Celery Worker, and Celery Beat:

```bash
./scripts/setup-services.sh
```

This creates:
- `gunicorn.service` - Django application server
- `celery-worker.service` - Background task worker
- `celery-beat.service` - Scheduled task scheduler

## 🌐 Step 6: Configure Nginx

Set up Nginx reverse proxy:

```bash
./scripts/setup-nginx.sh
```

This will:
- Create Nginx configuration
- Set up reverse proxy to Gunicorn
- Configure static and media file serving
- Set up rate limiting
- Enable the site

## 🚀 Step 7: Build and Upload Frontend

**On your local machine:**

First, configure deployment settings (if not done already):

```bash
./scripts/init-deploy-config.sh
```

This will prompt you for:
- Server IP or hostname (e.g., 167.172.196.213)
- Server username (default: stocks)
- Server app path (default: ~/apps/revs_ai)
- Domain name (optional)
- SSH key path (optional)

Then build and upload the frontend:

```bash
# From your local machine (in the project root)
./scripts/upload-frontend.sh
```

This script will:
1. Load settings from `.deploy-config` (or prompt if not configured)
2. Build the frontend locally (fast on your machine)
3. Create a compressed archive
4. Upload it to the server via SCP
5. Extract it on the server

**Note:** After the first run, the script will remember your server details from `.deploy-config`.

**Alternative: Manual upload**

```bash
# On local machine
cd frontend
npm run build
tar -czf dist.tar.gz dist/

# Upload
scp dist.tar.gz stocks@YOUR_SERVER_IP:~/apps/revs_ai/frontend/

# On server, extract
ssh stocks@YOUR_SERVER_IP
cd ~/apps/revs_ai/frontend
tar -xzf dist.tar.gz
rm dist.tar.gz
```

## 🚀 Step 8: Deploy Application

Run the deployment script to:
- Run migrations
- Collect static files
- Start all services

```bash
./scripts/deploy.sh
```

This script will:
1. Update Python dependencies
2. Check for frontend build (should be uploaded)
3. Run database migrations
4. Collect static files
5. Restart all services

## 🔒 Step 8: Set Up SSL with Let's Encrypt

If you have a domain name:

```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot will automatically:
- Obtain SSL certificate
- Configure Nginx for HTTPS
- Set up auto-renewal

## 🌍 Step 9: Configure Domain DNS

1. Go to your domain registrar
2. Add A records:
   - `@` → `YOUR_DROPLET_IP`
   - `www` → `YOUR_DROPLET_IP`

3. Wait for DNS propagation (can take up to 48 hours, usually much faster)

4. Update `ALLOWED_HOSTS` in `.env.production` if needed

5. Restart services:
   ```bash
   ./scripts/deploy.sh
   ```

## ✅ Step 10: Verify Deployment

1. **Check Application**: Visit `https://your-domain.com` or `http://YOUR_DROPLET_IP`
2. **Check API**: Visit `https://your-domain.com/api/`
3. **Check Admin**: Visit `https://your-domain.com/admin/`
4. **Check Health**: Visit `https://your-domain.com/health/`

### Check Service Status

```bash
# Check all services
sudo systemctl status gunicorn
sudo systemctl status celery-worker
sudo systemctl status celery-beat
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis-server

# Check logs
sudo journalctl -u gunicorn -f
sudo journalctl -u celery-worker -f
tail -f logs/gunicorn-error.log
tail -f logs/celery-worker.log
```

## 🔄 Step 11: Create Superuser

```bash
# Activate virtual environment
source .venv/bin/activate

# Create superuser
python manage.py createsuperuser --settings=config.settings.production
```

## 📊 Step 12: Set Up Backups

### 12.1 Create Backup Script

```bash
nano ~/backup-stocks.sh
```

Add:

```bash
#!/bin/bash

BACKUP_DIR="$HOME/revs_ai/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="stocks_prod"
DB_USER="stocks_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h localhost $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_$DATE.sql

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

```bash
# Make executable
chmod +x ~/backup-stocks.sh

# Test backup (source .env.production first)
source ~/revs_ai/.env.production
~/backup-stocks.sh
```

### 12.2 Set Up Cron Job for Backups

```bash
crontab -e
```

Add:

```
# Daily backup at 2 AM
0 2 * * * cd /home/stocks/revs_ai && source .env.production && /home/stocks/backup-stocks.sh >> /home/stocks/backup.log 2>&1
```

## 🔄 Step 13: Updating the Application

### Backend Updates Only

If you only changed backend code:

```bash
cd ~/apps/revs_ai
git pull
./scripts/deploy-backend.sh
```

This will:
- Update Python dependencies
- Run migrations
- Collect static files
- Restart services

### Frontend Updates

If you changed frontend code:

**On your local machine:**
```bash
# Build and upload frontend
./scripts/upload-frontend.sh
```

**On server:**
```bash
cd ~/apps/revs_ai
./scripts/deploy.sh
```

### Full Update (Backend + Frontend)

**On your local machine:**
```bash
# Build and upload frontend
./scripts/upload-frontend.sh
```

**On server:**
```bash
cd ~/apps/revs_ai
git pull
./scripts/deploy.sh
```

### Quick Reference

| Scenario | Local Machine | Server |
|----------|--------------|--------|
| Backend only | - | `git pull && ./scripts/deploy-backend.sh` |
| Frontend only | `./scripts/upload-frontend.sh` | `./scripts/deploy.sh` |
| Both | `./scripts/upload-frontend.sh` | `git pull && ./scripts/deploy.sh` |

## 🛡️ Step 14: Security Hardening

### 14.1 Configure Firewall

The setup script already configured UFW, but verify:

```bash
sudo ufw status
```

### 14.2 Fail2Ban

Already installed and enabled by setup script. Check status:

```bash
sudo systemctl status fail2ban
```

### 14.3 Automatic Security Updates

Already configured by setup script. Verify:

```bash
sudo systemctl status unattended-upgrades
```

### 14.4 Disable Root Login (Optional)

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

## 🐛 Troubleshooting

### Application Not Starting

```bash
# Check service status
sudo systemctl status gunicorn

# Check logs
sudo journalctl -u gunicorn -n 50
tail -f logs/gunicorn-error.log

# Check if port is in use
sudo netstat -tulpn | grep 8080
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo journalctl -u postgresql -n 50

# Test connection
psql -U stocks_user -h localhost -d stocks_prod
```

### Celery Not Working

```bash
# Check Celery worker status
sudo systemctl status celery-worker

# Check Celery logs
tail -f logs/celery-worker.log

# Restart Celery
sudo systemctl restart celery-worker
sudo systemctl restart celery-beat
```

### Nginx Issues

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Reload Nginx
sudo systemctl reload nginx
```

### Frontend Not Loading

```bash
# Rebuild frontend
cd frontend
npm run build
cd ..

# Check if static files are collected
ls -la staticfiles/

# Restart services
./scripts/deploy.sh
```

### Permission Issues

```bash
# Fix ownership of app directory
sudo chown -R stocks:stocks ~/revs_ai

# Fix permissions
chmod -R 755 ~/revs_ai
chmod -R 775 ~/revs_ai/media
chmod -R 775 ~/revs_ai/logs
```

## 📝 Maintenance Commands

### View Logs

```bash
# Gunicorn logs
sudo journalctl -u gunicorn -f
tail -f logs/gunicorn-access.log
tail -f logs/gunicorn-error.log

# Celery logs
tail -f logs/celery-worker.log
tail -f logs/celery-beat.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo journalctl -u postgresql -f
```

### Restart Services

```bash
# Restart all services
sudo systemctl restart gunicorn
sudo systemctl restart celery-worker
sudo systemctl restart celery-beat
sudo systemctl reload nginx

# Or use deploy script
./scripts/deploy.sh
```

### Stop Services

```bash
sudo systemctl stop gunicorn
sudo systemctl stop celery-worker
sudo systemctl stop celery-beat
```

### Start Services

```bash
sudo systemctl start gunicorn
sudo systemctl start celery-worker
sudo systemctl start celery-beat
```

### Check Service Status

```bash
sudo systemctl status gunicorn
sudo systemctl status celery-worker
sudo systemctl status celery-beat
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis-server
```

## 📚 Quick Reference

### Initial Setup (One Time)

**On Server:**
```bash
# 1. Clone repository
git clone https://github.com/surenab/revs_ai.git
cd revs_ai

# 2. Run server setup
./scripts/setup-server.sh

# 3. Configure .env.production
nano .env.production

# 4. Run app setup (backend only)
./scripts/setup-app.sh

# 5. Set up services
./scripts/setup-services.sh

# 6. Set up Nginx
./scripts/setup-nginx.sh
```

**On Local Machine:**
```bash
# 7. Build and upload frontend
cd /path/to/revs_ai
./scripts/upload-frontend.sh
```

**Back on Server:**
```bash
# 8. Deploy
./scripts/deploy.sh

# 9. Set up SSL (if you have domain)
sudo certbot --nginx -d your-domain.com

# 10. Create superuser
source .venv/bin/activate
python manage.py createsuperuser --settings=config.settings.production
```

### Regular Updates

**Backend only:**
```bash
# On server
cd ~/apps/revs_ai
git pull
./scripts/deploy-backend.sh
```

**Frontend only:**
```bash
# On local machine
./scripts/upload-frontend.sh

# On server
cd ~/apps/revs_ai
./scripts/deploy.sh
```

**Both:**
```bash
# On local machine
./scripts/upload-frontend.sh

# On server
cd ~/apps/revs_ai
git pull
./scripts/deploy.sh
```

## 🎉 Success!

Your StockApp should now be running on DigitalOcean without Docker!

---

**Need Help?** Check the troubleshooting section or review the service logs.
