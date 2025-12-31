"""
Development settings for stocks project.
"""

from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]  # noqa: S104

# Database for development
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Email Configuration for development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "noreply@localhost"

# Development-specific middleware (includes CORS)
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Development apps (add debug toolbar, etc.)
INSTALLED_APPS += [
    # Add development-specific apps here
    # 'debug_toolbar',
]

# Ensure corsheaders is included
if "corsheaders" not in INSTALLED_APPS:
    INSTALLED_APPS.append("corsheaders")

# Disable security features for development
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False

# CORS settings for development (if using frontend)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Cache configuration for development
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

# Override Celery configuration for development to use localhost
CELERY_BROKER_URL = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = "redis://localhost:6379/0"

# Logging for development - reduce verbosity
# Set console handler to INFO to reduce noise
LOGGING["handlers"]["console"]["level"] = "INFO"
# Keep Django at INFO but suppress SQL queries
LOGGING["loggers"]["django"]["level"] = "INFO"
# Suppress SQL query debug messages - only show WARNING and above
LOGGING["loggers"]["django.db.backends"]["level"] = "WARNING"
LOGGING["loggers"]["django.db.backends"]["handlers"] = ["console"]
LOGGING["loggers"]["django.db.backends"]["propagate"] = False
# Set app loggers to INFO
LOGGING["loggers"]["users"]["level"] = "INFO"
# Add bot_simulations logger if not already present
if "bot_simulations" not in LOGGING["loggers"]:
    LOGGING["loggers"]["bot_simulations"] = {
        "handlers": ["console", "file"],
        "level": "INFO",
        "propagate": False,
    }

# Development-specific settings
INTERNAL_IPS = [
    "127.0.0.1",
    "localhost",
]
