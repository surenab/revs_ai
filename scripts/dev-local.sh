#!/bin/bash

# 🚀 Local Development Server Launcher (with uv)
# This script starts both Django backend and React frontend without Docker
# Uses uv (https://github.com/astral-sh/uv) for fast Python package management

set -e  # Exit on any error

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

# Function to cleanup on exit
cleanup() {
    print_warning "\nShutting down servers..."
    jobs -p | xargs -r kill 2>/dev/null || true
    print_success "Cleanup completed"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

print_header "🎯 Starting Development Servers"

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
echo -e "${YELLOW}Default Admin Credentials:${NC}"
echo -e "Email: admin@example.com"
echo -e "Password: admin123"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop all servers${NC}"

# Wait for both processes
wait $DJANGO_PID $REACT_PID
