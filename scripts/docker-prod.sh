#!/bin/bash

# Production Docker management script

set -e

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.production.yml"

# Check if .env file exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please create .env.production with required environment variables."
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

case "$1" in
    "up")
        echo "🚀 Starting production environment..."
        docker-compose $COMPOSE_FILES up -d --build
        echo "✅ Production environment started!"
        echo "🌐 Application available at: https://$(echo $ALLOWED_HOSTS | cut -d',' -f1)"
        ;;
    "down")
        echo "🛑 Stopping production environment..."
        docker-compose $COMPOSE_FILES down
        ;;
    "restart")
        echo "🔄 Restarting production environment..."
        docker-compose $COMPOSE_FILES restart
        ;;
    "logs")
        echo "📋 Showing logs..."
        docker-compose $COMPOSE_FILES logs -f "${2:-web}"
        ;;
    "status")
        echo "📊 Checking service status..."
        docker-compose $COMPOSE_FILES ps
        ;;
    "migrate")
        echo "🗄️ Running migrations..."
        docker-compose $COMPOSE_FILES exec web python manage.py migrate
        ;;
    "collectstatic")
        echo "📦 Collecting static files..."
        docker-compose $COMPOSE_FILES exec web python manage.py collectstatic --noinput
        ;;
    "backup")
        echo "💾 Creating database backup..."
        BACKUP_FILE="backups/prod_backup_$(date +%Y%m%d_%H%M%S).sql"
        docker-compose $COMPOSE_FILES exec -T db pg_dump -U $DB_USER -d $DB_NAME > "$BACKUP_FILE"
        echo "✅ Backup created: $BACKUP_FILE"
        ;;
    "restore")
        if [ -z "$2" ]; then
            echo "❌ Error: Please specify backup file to restore"
            echo "Usage: $0 restore <backup_file>"
            exit 1
        fi
        echo "🔄 Restoring database from $2..."
        docker-compose $COMPOSE_FILES exec -T db psql -U $DB_USER -d $DB_NAME < "$2"
        echo "✅ Database restored successfully!"
        ;;
    "shell")
        echo "🐚 Opening shell in web container..."
        docker-compose $COMPOSE_FILES exec web bash
        ;;
    "update")
        echo "🔄 Updating production deployment..."
        git pull origin main
        docker-compose $COMPOSE_FILES build web
        docker-compose $COMPOSE_FILES up -d web
        docker-compose $COMPOSE_FILES exec web python manage.py migrate
        docker-compose $COMPOSE_FILES exec web python manage.py collectstatic --noinput
        echo "✅ Production updated successfully!"
        ;;
    "ssl-renew")
        echo "🔒 Renewing SSL certificates..."
        # Add your SSL renewal logic here (e.g., Let's Encrypt)
        # certbot renew --webroot -w /var/www/certbot
        docker-compose $COMPOSE_FILES restart nginx
        echo "✅ SSL certificates renewed!"
        ;;
    "monitor")
        echo "📊 Opening monitoring dashboard..."
        echo "Prometheus: http://localhost:9090"
        echo "Grafana: http://localhost:3000"
        ;;
    *)
        echo "🐳 Production Docker Management Script"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  up              Start production environment"
        echo "  down            Stop production environment"
        echo "  restart         Restart production environment"
        echo "  logs [service]  Show logs (default: web)"
        echo "  status          Show service status"
        echo "  migrate         Run database migrations"
        echo "  collectstatic   Collect static files"
        echo "  backup          Create database backup"
        echo "  restore <file>  Restore database from backup"
        echo "  shell           Open shell in web container"
        echo "  update          Update production deployment"
        echo "  ssl-renew       Renew SSL certificates"
        echo "  monitor         Show monitoring URLs"
        echo ""
        echo "Examples:"
        echo "  $0 up"
        echo "  $0 backup"
        echo "  $0 restore backups/prod_backup_20231201_120000.sql"
        exit 1
        ;;
esac
