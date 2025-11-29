@echo off
REM 🚀 Local Development Server Launcher for Windows
REM This script starts both Django backend and React frontend without Docker

echo ================================
echo 🚀 StockApp Local Development Server
echo ================================

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed. Please install Python 3.13+ first.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Get the project root directory
set "PROJECT_ROOT=%~dp0.."
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"

echo [INFO] Python version:
python --version
echo [INFO] Node.js version:
node --version

REM Create virtual environment if it doesn't exist
if not exist "%PROJECT_ROOT%\venv" (
    echo [INFO] Creating Python virtual environment...
    cd /d "%PROJECT_ROOT%"
    python -m venv venv
    echo [SUCCESS] Virtual environment created
)

REM Activate virtual environment
echo [INFO] Activating virtual environment...
cd /d "%PROJECT_ROOT%"
call venv\Scripts\activate.bat

REM Install Python dependencies
if exist "%PROJECT_ROOT%\pyproject.toml" (
    echo [INFO] Installing Python dependencies...
    pip install -e .
) else if exist "%PROJECT_ROOT%\requirements.txt" (
    echo [INFO] Installing Python dependencies...
    pip install -r requirements.txt
) else (
    echo [WARNING] No Python requirements file found. Make sure dependencies are installed.
)

REM Set up environment variables for Django
set DJANGO_SETTINGS_MODULE=config.settings.development
set DEBUG=True
set SECRET_KEY=dev-secret-key-change-in-production
set DATABASE_URL=sqlite:///db.sqlite3

REM Run Django migrations
echo [INFO] Running Django migrations...
python manage.py migrate

REM Install frontend dependencies
if exist "%FRONTEND_DIR%" (
    echo [INFO] Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    npm install
    echo [SUCCESS] Frontend dependencies installed
) else (
    echo [ERROR] Frontend directory not found
    pause
    exit /b 1
)

echo ================================
echo 🎯 Starting Development Servers
echo ================================

REM Start Django server
echo [INFO] Starting Django development server...
cd /d "%PROJECT_ROOT%"
call venv\Scripts\activate.bat
start "Django Server" cmd /k "python manage.py runserver 0.0.0.0:8080"

REM Wait a moment for Django to start
timeout /t 3 /nobreak >nul

REM Start React server
echo [INFO] Starting React development server...
cd /d "%FRONTEND_DIR%"
start "React Server" cmd /k "npm run dev"

echo ================================
echo 🎉 Development Servers Starting
echo ================================
echo Frontend (React):     http://localhost:3000
echo Backend API (Django): http://localhost:8080
echo Django Admin:         http://localhost:8080/admin/
echo API Endpoints:        http://localhost:8080/api/v1/
echo.
echo Default Admin Credentials:
echo Email: admin@example.com
echo Password: admin123
echo.
echo Press any key to exit...
pause >nul
