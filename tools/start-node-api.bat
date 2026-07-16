@echo off
REM ============================================================================
REM metaplatform-api (Node.js + Express + SQLite) 后端服务启动脚本
REM Port: 3001
REM Usage: 双击运行, 或 cmd /c start-node-api.bat
REM ============================================================================

setlocal

set "PROJECT_ROOT=%~dp0.."
set "API_DIR=%PROJECT_ROOT%\metaplatform-api"
set "LOG_DIR=%PROJECT_ROOT%\metaplatform-api\logs"
set "LOG_FILE=%LOG_DIR%\node-api-3001.log"
set "ERR_FILE=%LOG_DIR%\node-api-3001.err.log"
set "PID_FILE=%LOG_DIR%\node-api-3001.pid"

REM 0. 检查端口 3001 是否已被占用
echo [start-node-api] 检查端口 3001...
netstat -ano | findstr ":3001\s" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [start-node-api] [WARN] 端口 3001 已被占用
    echo [start-node-api] 尝试用 PID_FILE 杀掉旧进程...
    if exist "%PID_FILE%" (
        set /p OLD_PID=<"%PID_FILE%"
        if not "%OLD_PID%"=="" (
            taskkill /F /PID %OLD_PID% >nul 2>&1
            echo [start-node-api] 已杀 PID %OLD_PID%
        )
    )
    timeout /t 2 /nobreak >nul
)

REM 1. 进入项目目录
cd /d "%API_DIR%"
if %ERRORLEVEL% NEQ 0 (
    echo [start-node-api] [ERROR] 无法进入 %API_DIR%
    pause
    exit /b 1
)

REM 2. 创建日志目录
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM 3. 启动 Node API (隐藏窗口 + 后台运行)
echo [start-node-api] 启动 node src/index.js ...
echo [start-node-api] 日志: %LOG_FILE%

start /B "" cmd /c "node src/index.js > %LOG_FILE% 2> %ERR_FILE%"

REM 4. 记录 PID
for /f "tokens=2" %%P in ('tasklist /FI "IMAGENAME eq node.exe" /NH 2^>nul ^| findstr "node.exe"') do (
    if not defined NODE_PID set "NODE_PID=%%P"
)

if defined NODE_PID (
    echo %NODE_PID%> "%PID_FILE%"
    echo [start-node-api] PID: %NODE_PID%
) else (
    echo [start-node-api] [WARN] 无法获取 PID
)

REM 5. 等待启动 + 验证
timeout /t 3 /nobreak >nul
echo [start-node-api] 验证端口 3001...
netstat -ano | findstr ":3001\s" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [start-node-api] [OK] 端口 3001 监听中
    echo [start-node-api] 浏览器: http://localhost:3001/health
) else (
    echo [start-node-api] [ERROR] 端口 3001 未启动, 检查日志:
    echo [start-node-api]   stdout: %LOG_FILE%
    echo [start-node-api]   stderr: %ERR_FILE%
    pause
    exit /b 1
)

endlocal
exit /b 0
