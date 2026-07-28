#!/usr/bin/env bash
# ST-7.3.3: 迁移 #1 — tech-msg 切 10% 流量
set -euo pipefail

SERVICE="tech-msg"
NEW_PERCENT="${1:-10}"  # 切流量
OLD_PERCENT=$((100 - NEW_PERCENT))

echo "==> 切 ${SERVICE} 流量到 v_n: ${NEW_PERCENT}% / v_old: ${OLD_PERCENT}%"

# 调用 ST-7.2.2 权重切换脚本
bash "$(dirname "$0")/../05-weight-switch.sh" "$SERVICE" "$NEW_PERCENT"

# 24h 监控
echo "==> 24h 监控启动"
bash "$(dirname "$0")/../06-auto-rollback.sh" \
    "$SERVICE" "previous" "latest" \
    86400 0.1  # 24h, 0.1% threshold

echo "==> 24h 后如无问题继续到 50% → 100%"