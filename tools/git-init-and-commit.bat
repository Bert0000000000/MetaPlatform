@echo off
REM ============================================================================
REM Git 初始化 + 第一次提交 MetaPlatform
REM 用途: 项目无 .git/ 时, 双击此脚本初始化仓库并提交
REM ============================================================================

setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

REM 1. 检查 git
where git >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [git-init] [ERROR] git 不在 PATH. 请安装 Git for Windows
    echo   https://git-scm.com/download/win
    pause
    exit /b 1
)

REM 2. 询问是否初始化 (避免重复执行)
if exist "%PROJECT_ROOT%\.git" (
    echo [git-init] .git 已存在, 跳过 init
    goto :commit
)

git init -b main
if !ERRORLEVEL! NEQ 0 (
    echo [git-init] [ERROR] git init 失败
    pause
    exit /b 1
)

git config user.email "claude@metaplatform.local"
git config user.name "Claude (Trae IDE)"

:commit

REM 3. 看状态
echo [git-init] === git status (前 30 行) ===
git status --porcelain | findstr /n "^" | findstr /b "^[0-9]*: " > "%TEMP%\git-status.txt"
type "%TEMP%\git-status.txt"

REM 4. add + commit
echo.
echo [git-init] 即将 add + commit 所有文件
echo [git-init] (1 秒后开始, Ctrl+C 取消)
timeout /t 3 /nobreak >nul

git add .
if !ERRORLEVEL! NEQ 0 (
    echo [git-init] [ERROR] git add 失败
    pause
    exit /b 1
)

git commit -m "initial: MetaPlatform v1.0.2 sprint 1

- metaplatform-frontend: formily v0.2 + Sprint 1 全部任务 (F1.x)
  - F1.1 listpage formily 接入
  - F1.2 lookup 字段编辑风险提示
  - ObjectFieldPanel + ObjectFieldConfig 纯函数化
  - Pages 侧边栏 + 应用编辑器
  - 71 个单测全过 (tsx --test)
- metaplatform-api: Node.js + Express + SQLite/PostgreSQL
  - 49 个 routes 端点 (auth, apps, pages, knowledge, AI, ...)
  - Vitest 单测通过
- metaplatform-app-service: Spring Boot 8092
- metaplatform-ai-substrate: AI 基础设施 (Spring Boot)
- metaplatform-dialogue: 对话服务 (Spring Boot)
- metaplatform-capability-library: Java 库
- metaplatform-data-stack: Go 数据服务
- metaplatform-e2e: 5 个 shell 场景
- metaplatform-design: 84 个 HTML 页面 + design 文件
- bruno: MetaPlatform API 测试集合
- deploy: argocd + helm + kubernetes
- docs: v1.0.x + superpowers + tech-architecture
- tools: start/stop .bat 脚本 (node-api, docker-stack)
" -m "- co-authored-by: Claude (Trae IDE) <claude@metaplatform.local>"

if !ERRORLEVEL! NEQ 0 (
    echo [git-init] [ERROR] git commit 失败
    pause
    exit /b 1
)

echo.
echo [git-init] [DONE] 已初始化并首次提交
git log --oneline -5
pause
exit /b 0
