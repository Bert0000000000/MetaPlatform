@echo off
cd /D D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MCP
"C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe" -jar target\tech-mcp-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev --server.port=8502 > D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\logs\tech-mcp-r2.log 2>&1