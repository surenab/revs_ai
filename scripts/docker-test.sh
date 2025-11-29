#!/bin/bash

# Testing Docker management script

set -e

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.testing.yml"

case "$1" in
    "run")
        echo "🧪 Running tests..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit test
        ;;
    "lint")
        echo "🔍 Running linter..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit lint
        ;;
    "safety")
        echo "🔒 Running security checks..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit safety
        ;;
    "mypy")
        echo "🔍 Running type checking..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit mypy
        ;;
    "all")
        echo "🚀 Running all checks..."
        echo "1/4 Running tests..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit test

        echo "2/4 Running linter..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit lint

        echo "3/4 Running security checks..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit safety

        echo "4/4 Running type checking..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit mypy

        echo "✅ All checks passed!"
        ;;
    "coverage")
        echo "📊 Generating coverage report..."
        docker-compose $COMPOSE_FILES up --build --abort-on-container-exit test
        echo "📋 Coverage report generated in htmlcov/"
        ;;
    "clean")
        echo "🧹 Cleaning up test environment..."
        docker-compose $COMPOSE_FILES down -v --remove-orphans
        docker system prune -f
        ;;
    *)
        echo "🧪 Testing Docker Management Script"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  run       Run tests with coverage"
        echo "  lint      Run code linting"
        echo "  safety    Run security checks"
        echo "  mypy      Run type checking"
        echo "  all       Run all checks"
        echo "  coverage  Generate coverage report"
        echo "  clean     Clean up test environment"
        echo ""
        echo "Examples:"
        echo "  $0 run"
        echo "  $0 all"
        echo "  $0 coverage"
        exit 1
        ;;
esac
