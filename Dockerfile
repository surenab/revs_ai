# Base Dockerfile for Django application
# Multi-stage build for production optimization

# Build stage
FROM python:3.13-slim as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for faster Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set work directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN uv sync --frozen --no-dev

# Production stage
FROM python:3.13-slim as production

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# Create app user
RUN groupadd -r app && useradd -r -g app app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy project files
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/staticfiles /app/media /var/log/django && \
    chown -R app:app /app

# Switch to app user
USER app

# Collect static files
RUN python manage.py collectstatic --noinput --settings=config.settings.production

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/admin/', timeout=10)"

# Expose port
EXPOSE 8080

# Default command
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "3", "config.wsgi:application"]

# Development stage
FROM python:3.13-slim as development

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set work directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install all dependencies (including dev)
RUN uv sync --frozen

# Copy project files
COPY . .

# Create directories
RUN mkdir -p /app/staticfiles /app/media /app/logs /var/log/django

# Expose port
EXPOSE 8080

# Default command for development
CMD ["python", "manage.py", "runserver", "0.0.0.0:8080"]

# Testing stage
FROM development as testing

# Install additional testing dependencies
RUN uv add pytest pytest-django pytest-cov coverage

# Set testing environment
ENV DJANGO_SETTINGS_MODULE=config.settings.testing

# Run tests by default
CMD ["pytest", "--cov=.", "--cov-report=html", "--cov-report=term"]
