@echo off
REM ============================================================================
REM metaplatform-api 停止脚本
REM Usage: 双击运行, 或 cmd /c stop-node-api.bat
REM ============================================================================

setlocal

set "PROJECT_ROOT=%~dp0.."
set "PID_FILE=%PROJECT_ROOT%\metaplatform-api\logs\node-api-3001.pid"

echo [stop-node-api] 停止 metaplatform-api (3001)...

REM 1. 通过 PID_FILE 杀进程
if exist "%PID_FILE%" (
    set /p PID=<"%PID_FILE%"
    if not "%PID%"=="" (
        tasklist /FI "PID eq %PID%" 2>nul | findstr "%PID%" >nul
        if %ERRORLEVEL% EQU 0 (
            taskkill /F /PID %PID% >nul 2>&1
            echo [stop-node-api] [OK] 杀 PID %PID%
        ) else (
            echo [stop-node-api] [WARN] PID %PID% 不存在
        )
    )
    del /F /Q "%PID_FILE%" >nul 2>&1
) else (
    echo [stop-node-api] [WARN] 无 PID_FILE
)

REM 2. 兜底: 通过端口 3001 杀进程
netstat -ano | findstr ":3001\s" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [stop-node-api] 端口 3001 仍被占用, 通过端口杀进程...
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3001\s" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%P >nul 2>&1
        echo [stop-node-api] [OK] 杀 PID %%P (端口 3001)
    )
) else (
    echo [stop-node-api] [OK] 端口 3001 已释放
)

endlocal
exit /b 0
