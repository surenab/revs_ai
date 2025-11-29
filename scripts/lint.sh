#!/bin/bash

# Ruff linting and formatting script for the Stocks project

echo "🔍 Running Ruff linter..."
uv run ruff check --show-fixes

echo ""
echo "🔧 Auto-fixing issues..."
uv run ruff check --fix

echo ""
echo "🎨 Formatting code..."
uv run ruff format

echo ""
echo "✅ Linting and formatting complete!"

# Check if there are any remaining issues
echo ""
echo "📋 Final check for remaining issues..."
uv run ruff check --quiet
if [ $? -eq 0 ]; then
    echo "🎉 No issues found! Code is clean."
else
    echo "⚠️  Some issues remain. Please review the output above."
fi
