#!/bin/bash

# 🚀 Local Development Server Launcher (with uv)
# This script starts both Django backend and React frontend without Docker
# Uses uv (https://github.com/astral-sh/uv) for fast Python package management

# Note: We don't use 'set -e' because we want to continue even if Redis/Celery checks fail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

print_header "🚀 StockApp Local Development Server"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    print_status "uv is not installed. Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh

    # Try to source uv from common locations
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    elif [ -f "$HOME/.local/bin/uv" ]; then
        export PATH="$HOME/.local/bin:$PATH"
    fi

    if ! command -v uv &> /dev/null; then
        print_error "Failed to install uv. Please install it manually:"
        print_error "curl -LsSf https://astral.sh/uv/install.sh | sh"
        print_error "Or visit: https://github.com/astral-sh/uv"
        exit 1
    fi
    print_success "uv installed successfully"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "uv version: $(uv --version)"
print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    print_warning "Port $port is in use. Attempting to free it..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Check and free ports if needed
if check_port 8080; then
    kill_port 8080
fi

if check_port 3000; then
    kill_port 3000
fi

# Initialize uv project if needed
cd "$PROJECT_ROOT"

# Set Python version for uv if not set
if [ ! -f "$PROJECT_ROOT/.python-version" ]; then
    print_status "Setting Python version for uv..."
    echo "3.13" > .python-version
fi

# Initialize or sync uv project
if [ -f "$PROJECT_ROOT/pyproject.toml" ]; then
    print_status "Syncing Python dependencies with uv..."
    uv sync --dev
    print_success "Dependencies synced with uv"
elif [ -f "$PROJECT_ROOT/requirements.txt" ]; then
    print_status "Converting requirements.txt to uv project..."
    # Initialize uv project first
    uv init --no-readme --no-workspace --python 3.13
    # Add requirements
    uv add --requirements requirements.txt
    uv sync --dev
    print_success "Dependencies converted and synced with uv"
else
    print_status "Creating new uv project with Django dependencies..."
    uv init --no-readme --no-workspace --python 3.13
    uv add django djangorestframework django-cors-headers python-decouple
    uv add --dev ruff pytest pytest-django
    uv sync --dev
    print_success "New uv project created with Django dependencies"
fi

# Set up environment variables for Django
export DJANGO_SETTINGS_MODULE="config.settings.development"
export DEBUG=True
export SECRET_KEY="dev-secret-key-change-in-production"
export DATABASE_URL="sqlite:///db.sqlite3"

# Run Django migrations
print_status "Running Django migrations..."
uv run python manage.py migrate

# Create superuser if it doesn't exist (optional)
print_status "Checking for Django superuser..."
uv run python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    print('Creating superuser...')
    User.objects.create_superuser('admin@example.com', 'admin123')
    print('Superuser created: admin@example.com / admin123')
else:
    print('Superuser already exists')
" 2>/dev/null || print_warning "Could not check/create superuser"

# Install frontend dependencies
if [ -d "$FRONTEND_DIR" ]; then
    print_status "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install
    print_success "Frontend dependencies installed"
else
    print_error "Frontend directory not found at $FRONTEND_DIR"
    exit 1
fi

# Function to start Django server
start_django() {
    print_status "Starting Django development server on http://localhost:8080..."
    cd "$PROJECT_ROOT"
    export DJANGO_SETTINGS_MODULE="config.settings.development"
    uv run python manage.py runserver 0.0.0.0:8080
}

# Function to start React server
start_react() {
    print_status "Starting React development server on http://localhost:3000..."
    cd "$FRONTEND_DIR"
    npm run dev
}

# Function to check if Redis is running
check_redis() {
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping > /dev/null 2>&1; then
            return 0  # Redis is running
        fi
    fi
    return 1  # Redis is not running
}

# Function to start Redis in background
start_redis() {
    if check_redis; then
        print_success "Redis is already running"
        return 0
    fi

    if ! command -v redis-server &> /dev/null; then
        print_warning "Redis is not installed. Celery may not work properly."
        print_warning "Install Redis with: brew install redis (macOS) or apt-get install redis-server (Linux)"
        return 1
    fi

    print_status "Starting Redis server..."
    redis-server --daemonize yes 2>/dev/null || {
        # Try starting without daemonize (for some Redis versions)
        redis-server > /dev/null 2>&1 &
        sleep 2
    }

    # Wait and check if Redis started
    sleep 2
    if check_redis; then
        print_success "Redis started successfully"
        return 0
    else
        print_warning "Redis may not have started. Celery may not work properly."
        return 1
    fi
}

# Function to check if Celery worker is running
check_celery_worker() {
    if pgrep -f "celery.*worker" > /dev/null; then
        return 0  # Celery worker is running
    fi
    return 1  # Celery worker is not running
}

# Function to check if Celery beat is running
check_celery_beat() {
    if pgrep -f "celery.*beat" > /dev/null; then
        return 0  # Celery beat is running
    fi
    return 1  # Celery beat is not running
}

# Function to start Celery worker in background
start_celery_worker() {
    if check_celery_worker; then
        print_success "Celery worker is already running"
        return 0
    fi

    if ! check_redis; then
        print_warning "Redis is not running. Starting Redis first..."
        start_redis || {
            print_warning "Could not start Redis. Celery worker will not start."
            return 1
        }
    fi

    print_status "Starting Celery worker..."
    cd "$PROJECT_ROOT"
    export DJANGO_SETTINGS_MODULE="config.settings.development"
    uv run celery -A config worker --loglevel=info --queues=stock_data,celery > /tmp/celery-worker.log 2>&1 &
    CELERY_WORKER_PID=$!

    sleep 2

    if check_celery_worker; then
        print_success "Celery worker started successfully (PID: $CELERY_WORKER_PID)"
        return 0
    else
        print_warning "Celery worker may not have started properly. Check /tmp/celery-worker.log"
        return 1
    fi
}

# Function to start Celery beat in background
start_celery_beat() {
    if check_celery_beat; then
        print_success "Celery beat is already running"
        return 0
    fi

    if ! check_redis; then
        print_warning "Redis is not running. Starting Redis first..."
        start_redis || {
            print_warning "Could not start Redis. Celery beat will not start."
            return 1
        }
    fi

    print_status "Starting Celery beat scheduler..."
    cd "$PROJECT_ROOT"
    export DJANGO_SETTINGS_MODULE="config.settings.development"
    uv run celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler > /tmp/celery-beat.log 2>&1 &
    CELERY_BEAT_PID=$!

    sleep 2

    if check_celery_beat; then
        print_success "Celery beat started successfully (PID: $CELERY_BEAT_PID)"
        return 0
    else
        print_warning "Celery beat may not have started properly. Check /tmp/celery-beat.log"
        return 1
    fi
}

# Function to cleanup on exit
cleanup() {
    print_warning "\nShutting down servers..."

    # Kill Django and React
    if [ ! -z "$DJANGO_PID" ]; then
        kill $DJANGO_PID 2>/dev/null || true
        print_status "Stopped Django server"
    fi

    if [ ! -z "$REACT_PID" ]; then
        kill $REACT_PID 2>/dev/null || true
        print_status "Stopped React server"
    fi

    # Kill any remaining background jobs
    jobs -p | xargs -r kill 2>/dev/null || true

    # Kill Celery processes we started
    if [ ! -z "$CELERY_WORKER_PID" ]; then
        kill $CELERY_WORKER_PID 2>/dev/null || true
        print_status "Stopped Celery worker"
    fi

    if [ ! -z "$CELERY_BEAT_PID" ]; then
        kill $CELERY_BEAT_PID 2>/dev/null || true
        print_status "Stopped Celery beat"
    fi

    # Kill any remaining Celery processes
    pkill -f "celery.*worker" 2>/dev/null || true
    pkill -f "celery.*beat" 2>/dev/null || true

    # Note: We don't stop Redis as it might be used by other applications
    # If you want to stop Redis, uncomment the following:
    # if [ ! -z "$REDIS_PID" ]; then
    #     kill $REDIS_PID 2>/dev/null || true
    #     print_status "Stopped Redis"
    # fi

    print_success "Cleanup completed"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

print_header "🎯 Starting Development Servers"

# Start Redis if not running
print_status "Checking Redis..."
start_redis || print_warning "Redis check failed, continuing anyway..."

# Start Celery worker if not running
print_status "Checking Celery worker..."
start_celery_worker || print_warning "Celery worker check failed, continuing anyway..."

# Start Celery beat if not running
print_status "Checking Celery beat..."
start_celery_beat || print_warning "Celery beat check failed, continuing anyway..."

# Start Django server in background
start_django &
DJANGO_PID=$!

# Wait a moment for Django to start
sleep 3

# Check if Django started successfully
if ! check_port 8080; then
    print_error "Django server failed to start on port 8080"
    kill $DJANGO_PID 2>/dev/null || true
    exit 1
fi

print_success "Django server started successfully"

# Start React server in background
start_react &
REACT_PID=$!

# Wait a moment for React to start
sleep 5

# Check if React started successfully
if ! check_port 3000; then
    print_error "React server failed to start on port 3000"
    kill $DJANGO_PID $REACT_PID 2>/dev/null || true
    exit 1
fi

print_success "React server started successfully"

print_header "🎉 Development Servers Running"
echo -e "${CYAN}Frontend (React):${NC}     http://localhost:3000"
echo -e "${CYAN}Backend API (Django):${NC} http://localhost:8080"
echo -e "${CYAN}Django Admin:${NC}         http://localhost:8080/admin/"
echo -e "${CYAN}API Endpoints:${NC}        http://localhost:8080/api/v1/"
echo ""
if check_redis; then
    echo -e "${GREEN}✓ Redis:${NC}              Running"
else
    echo -e "${YELLOW}⚠ Redis:${NC}              Not running"
fi
if check_celery_worker; then
    echo -e "${GREEN}✓ Celery Worker:${NC}       Running"
else
    echo -e "${YELLOW}⚠ Celery Worker:${NC}       Not running"
fi
if check_celery_beat; then
    echo -e "${GREEN}✓ Celery Beat:${NC}         Running"
else
    echo -e "${YELLOW}⚠ Celery Beat:${NC}         Not running"
fi
echo ""
echo -e "${YELLOW}Default Admin Credentials:${NC}"
echo -e "Email: admin@example.com"
echo -e "Password: admin123"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop all servers${NC}"

# Wait for both processes
wait $DJANGO_PID $REACT_PID
