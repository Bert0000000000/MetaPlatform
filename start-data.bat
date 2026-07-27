@echo off
set DB_USER=meta
set DB_PASSWORD=meta
cd /d D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-DATA
mvn spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.jvmArguments=-Dspring.cloud.compatibility-verifier.enabled=false 1>D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\acceptance\logs\TECH-DATA.log 2>&1
