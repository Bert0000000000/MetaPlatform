@echo off
cd /D D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-ONT
"C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe" -jar target\tech-ont-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev --server.port=8201 > D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\logs\tech-ont-r2.log 2>&1