#!/usr/bin/env bash
# ST-7.6.2: 迁移 #4 — agent + app-kb 流量分阶段切（1.5 周）
set -euo pipefail
SERVICE="tech-agent"
for STAGE in 10 50 100; do
    echo "==> ${SERVICE} → ${STAGE}%"
    bash "$(dirname "$0")/../05-weight-switch.sh" "$SERVICE" "$STAGE"
    bash "$(dirname "$0")/../06-auto-rollback.sh" "$SERVICE" "previous" "latest" 86400 0.1 || exit 1
done

SERVICE="app-kb"
for STAGE in 10 50 100; do
    bash "$(dirname "$0")/../05-weight-switch.sh" "$SERVICE" "$STAGE"
    bash "$(dirname "$0")/../06-auto-rollback.sh" "$SERVICE" "previous" "latest" 86400 0.1 || exit 1
done

echo "==> agent + app-kb 100% 切流完成"