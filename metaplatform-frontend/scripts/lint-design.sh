#!/usr/bin/env bash
# lint-design.sh — 跨平台包装 lint_design.py
# 用法:
#   ./scripts/lint-design.sh          检查
#   ./scripts/lint-design.sh --fix    自动修复
#   ./scripts/lint-design.sh --strict 严格模式

cd "$(dirname "$0")/.."
python3 scripts/lint_design.py "$@"