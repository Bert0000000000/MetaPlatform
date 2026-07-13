@echo off
REM ============================================================================
REM MetaPlatform 完整 Docker 栈启动 (9 服务)
REM
REM 注意: Trae IDE 沙箱拦截 docker, 必须 system cmd 启动
REM 调试 (双击闪退时):
REM   cmd /k "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\start-docker-stack.bat"
REM   或看日志: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\start-docker-stack.log
REM ============================================================================

setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0.."
set "LOG_FILE=%PROJECT_ROOT%\tools\start-docker-stack.log"

if exist "%LOG_FILE%" del /F /Q "%LOG_FILE%" >nul 2>&1

cd /d "%PROJECT_ROOT%"

REM ============================================================
REM 0. 探测 docker.exe (Docker Desktop 默认不在 PATH)
REM 注意: cmd 不支持 in ( ... (x86)\... ... ) 语法, 因为 (x86) 中的圆括号
REM 会被当作列表边界. 所以用逐个 if exist 而非 for 列表.
REM ============================================================
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
    echo [start-docker] [ERROR] docker.exe 找不到 >> "%LOG_FILE%" 2>&1
    echo [start-docker] 请安装 Docker Desktop >> "%LOG_FILE%" 2>&1
    type "%LOG_FILE%"
    pause
    exit /b 1
)

echo [start-docker] docker: !DOCKER_EXE! >> "%LOG_FILE%" 2>&1

REM 0.5 检查 daemon
"!DOCKER_EXE!" info >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [start-docker] [ERROR] Docker daemon 未运行 >> "%LOG_FILE%" 2>&1
    echo [start-docker] 启动 Docker Desktop 后重试 >> "%LOG_FILE%" 2>&1
    type "%LOG_FILE%"
    pause
    exit /b 1
)

echo [start-docker] Docker daemon: OK >> "%LOG_FILE%" 2>&1
"!DOCKER_EXE!" info --format "Server Version: {{.ServerVersion}}" >> "%LOG_FILE%" 2>&1

REM 1. 启动 9 服务
echo [start-docker] docker compose up -d ... >> "%LOG_FILE%" 2>&1
"!DOCKER_EXE!" compose up -d >> "%LOG_FILE%" 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [start-docker] [ERROR] docker compose up 失败 >> "%LOG_FILE%" 2>&1
    type "%LOG_FILE%"
    pause
    exit /b 1
)

REM 2. 等待 healthcheck
echo [start-docker] 等待 healthcheck (90 秒) ... >> "%LOG_FILE%" 2>&1
timeout /t 90 /nobreak >nul

REM 3. 容器状态
echo [start-docker] 容器状态: >> "%LOG_FILE%" 2>&1
"!DOCKER_EXE!" compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" >> "%LOG_FILE%" 2>&1

REM 4. 端口检查
echo [start-docker] 关键端口: >> "%LOG_FILE%" 2>&1
if netstat -ano | findstr ":3001\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 3001 >> "%LOG_FILE%"
if netstat -ano | findstr ":5432\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 5432 >> "%LOG_FILE%"
if netstat -ano | findstr ":6379\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 6379 >> "%LOG_FILE%"
if netstat -ano | findstr ":7687\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 7687 >> "%LOG_FILE%"
if netstat -ano | findstr ":9200\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 9200 >> "%LOG_FILE%"
if netstat -ano | findstr ":9092\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 9092 >> "%LOG_FILE%"
if netstat -ano | findstr ":8081\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 8081 >> "%LOG_FILE%"
if netstat -ano | findstr ":8123\s" | findstr "LISTENING" >nul 2>&1 echo   [OK]   port 8123 >> "%LOG_FILE%"

echo. >> "%LOG_FILE%" 2>&1
echo [start-docker] [DONE] 完整栈已启动 >> "%LOG_FILE%" 2>&1
echo [start-docker] 停止: tools\stop-docker-stack.bat >> "%LOG_FILE%" 2>&1
echo [start-docker] 浏览器: http://localhost >> "%LOG_FILE%" 2>&1

REM 输出日志
type "%LOG_FILE%"
echo.
echo ============================================
echo 启动完成, 按任意键关闭窗口
echo ============================================
pause >nul
exit /b 0
