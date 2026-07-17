@echo off
cd /D D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MCP
"C:\ProgramData\chocolatey\lib\maven\apache-maven-3.9.16\bin\mvn.cmd" -B -DskipTests package > D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\logs\mvn-mcp-r3-package.log 2>&1