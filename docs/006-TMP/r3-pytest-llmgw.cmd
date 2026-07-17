@echo off
cd /D D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-LLMGW
"D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-AGENT\.venv\Scripts\python.exe" -m pytest -q tests/ > D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\logs\pytest-llmgw-r3.log 2>&1