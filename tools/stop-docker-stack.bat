@echo off
REM ============================================================================
REM MetaPlatform 完整 Docker 栈停止
REM ============================================================================

setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0.."
set "LOG_FILE=%PROJECT_ROOT%\tools\stop-docker-stack.log"

if exist "%LOG_FILE%" del /F /Q "%LOG_FILE%" >nul 2>&1

cd /d "%PROJECT_ROOT%"

REM 0. 探测 docker.exe (同 start)
set "DOCKER_EXE="
if exist "%LOCALAPPDATA%\Programs\Docker\Docker\resources\bin\docker.exe" (
    set "DOCKER_EXE=%LOCALAPPDATA%\Programs\Docker\Docker\resources\bin\docker.exe"
)
if not defined DOCKER_EXE if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
)
if not defined DOCKER_EXE (
    if exist "%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe" (
        set "DOCKER_EXE=%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe"
    )
)
if not defined DOCKER_EXE (
    where docker >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "DOCKER_EXE=docker"
)
if not defined DOCKER_EXE (
    echo [stop-docker] [ERROR] docker.exe 找不到 >> "%LOG_FILE%" 2>&1
    type "%LOG_FILE%"
    pause
    exit /b 1
)

echo [stop-docker] docker: !DOCKER_EXE! >> "%LOG_FILE%" 2>&1
echo [stop-docker] 停止所有容器... >> "%LOG_FILE%" 2>&1
"!DOCKER_EXE!" compose down >> "%LOG_FILE%" 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [stop-docker] [ERROR] compose down 失败 >> "%LOG_FILE%" 2>&1
    type "%LOG_FILE%"
    pause
    exit /b 1
)

echo [stop-docker] [DONE] 栈已停止 >> "%LOG_FILE%" 2>&1
echo [stop-docker] 数据卷保留 (pgdata, redisdata, esdata...) >> "%LOG_FILE%" 2>&1
echo [stop-docker] 清理: docker compose down -v >> "%LOG_FILE%" 2>&1

type "%LOG_FILE%"
echo.
echo 停止完成, 按任意键关闭窗口
pause >nul
exit /b 0
