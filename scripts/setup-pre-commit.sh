#!/bin/bash

# Setup script for pre-commit hooks
# This script installs pre-commit hooks that will run automatically on git commit

set -e

echo "🔧 Setting up pre-commit hooks..."

# Check if uv is available
if ! command -v uv &> /dev/null; then
    echo "❌ Error: uv is not installed. Please install uv first."
    echo "   Run: pip install uv"
    exit 1
fi

# Install dependencies including pre-commit
echo "📦 Installing dependencies..."
uv sync --all-groups

# Install pre-commit git hooks
echo "🔗 Installing git hooks..."
uv run pre-commit install

echo "✅ Pre-commit hooks installed successfully!"
echo ""
echo "Pre-commit will now run automatically on every 'git commit'."
echo ""
echo "To test the hooks manually, run:"
echo "  uv run pre-commit run --all-files"
echo ""
echo "To update hooks when .pre-commit-config.yaml changes, run:"
echo "  uv run pre-commit autoupdate"
