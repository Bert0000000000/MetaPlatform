@echo off
cd /D D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-LLMGW
d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-AGENT\.venv\Scripts\python.exe -m pytest -q tests/test_chat_completions.py tests/test_rate_limit_runtime.py tests/test_rate_limits.py > D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\logs\pytest-llmgw-r2.log 2>&1