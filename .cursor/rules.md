# Python Execution Rules

## Mandatory Python Runtime

- NEVER use `python`, `python3`, or `pip` directly.
- ALWAYS execute Python using `uv run python`.

## Package Management

- NEVER use `pip install`.
- ALWAYS use `uv add` or `uv pip install` when explicitly required.

## Examples (MANDATORY)

❌ Incorrect:
```bash
python main.py
pip install requests
```

✅ Correct:
```bash
uv run python main.py
uv add requests
```

Before using any django command alwyas run this before
```bash
export DJANGO_SETTINGS_MODULE=config.settings.development
```
