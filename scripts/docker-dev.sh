#!/bin/bash

# Development Docker management script

set -e

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.development.yml"

case "$1" in
    "up")
        echo "🚀 Starting development environment..."
        docker-compose $COMPOSE_FILES up --build
        ;;
    "down")
        echo "🛑 Stopping development environment..."
        docker-compose $COMPOSE_FILES down
        ;;
    "restart")
        echo "🔄 Restarting development environment..."
        docker-compose $COMPOSE_FILES restart
        ;;
    "logs")
        echo "📋 Showing logs..."
        docker-compose $COMPOSE_FILES logs -f "${2:-web}"
        ;;
    "shell")
        echo "🐚 Opening shell in web container..."
        docker-compose $COMPOSE_FILES exec web bash
        ;;
    "manage")
        echo "🛠️ Running Django management command: ${*:2}"
        docker-compose $COMPOSE_FILES exec web python manage.py "${@:2}"
        ;;
    "migrate")
        echo "🗄️ Running migrations..."
        docker-compose $COMPOSE_FILES exec web python manage.py migrate
        ;;
    "makemigrations")
        echo "📝 Creating migrations..."
        docker-compose $COMPOSE_FILES exec web python manage.py makemigrations
        ;;
    "createsuperuser")
        echo "👤 Creating superuser..."
        docker-compose $COMPOSE_FILES exec web python manage.py createsuperuser
        ;;
    "collectstatic")
        echo "📦 Collecting static files..."
        docker-compose $COMPOSE_FILES exec web python manage.py collectstatic --noinput
        ;;
    "test")
        echo "🧪 Running tests..."
        docker-compose $COMPOSE_FILES exec web python manage.py test
        ;;
    "lint")
        echo "🔍 Running linter..."
        docker-compose $COMPOSE_FILES exec web ruff check --show-fixes
        ;;
    "format")
        echo "🎨 Formatting code..."
        docker-compose $COMPOSE_FILES exec web ruff format
        ;;
    "reset")
        echo "🗑️ Resetting development environment..."
        docker-compose $COMPOSE_FILES down -v
        docker-compose $COMPOSE_FILES up --build -d
        docker-compose $COMPOSE_FILES exec web python manage.py migrate
        echo "✅ Environment reset complete!"
        ;;
    "backup")
        echo "💾 Creating database backup..."
        docker-compose $COMPOSE_FILES exec db pg_dump -U postgres stocks_dev > "backups/dev_backup_$(date +%Y%m%d_%H%M%S).sql"
        echo "✅ Backup created in backups/ directory"
        ;;
    *)
        echo "🐳 Development Docker Management Script"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  up              Start development environment"
        echo "  down            Stop development environment"
        echo "  restart         Restart development environment"
        echo "  logs [service]  Show logs (default: web)"
        echo "  shell           Open shell in web container"
        echo "  manage [cmd]    Run Django management command"
        echo "  migrate         Run database migrations"
        echo "  makemigrations  Create new migrations"
        echo "  createsuperuser Create Django superuser"
        echo "  collectstatic   Collect static files"
        echo "  test            Run tests"
        echo "  lint            Run code linter"
        echo "  format          Format code"
        echo "  reset           Reset environment (removes volumes)"
        echo "  backup          Create database backup"
        echo ""
        echo "Examples:"
        echo "  $0 up"
        echo "  $0 manage shell"
        echo "  $0 logs db"
        exit 1
        ;;
esac
