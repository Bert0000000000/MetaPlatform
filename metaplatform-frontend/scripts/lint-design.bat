@echo off
REM lint-design.bat — 包装 lint_design.py, 支持命令行参数
REM 用法:
REM   npm run lint:design          检查
REM   npm run lint:design -- --fix 自动修复
REM   npm run lint:design -- --strict 严格模式

REM 切换到 frontend 根目录 (npm run 自动处理 cwd)
python scripts\lint_design.py %*