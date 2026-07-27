@echo off
set DB_USER=meta
set DB_PASSWORD=meta
set MATE_AGENT_CONTEXT_SIGNING_SECRET=metaplatform-context-signing-secret-at-least-32-chars
cd /d D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-IAM
mvn spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.jvmArguments=-Dspring.cloud.compatibility-verifier.enabled=false 1>D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-IAM\iam-dev.log 2>&1
