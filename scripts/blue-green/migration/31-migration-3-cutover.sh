#!/usr/bin/env bash
# ST-7.5.2: 迁移 #3 — rag 流量分阶段切
set -euo pipefail
SERVICE="tech-rag"
for STAGE in 10 50 100; do
    echo "==> ${SERVICE} → ${STAGE}%"
    bash "$(dirname "$0")/../05-weight-switch.sh" "$SERVICE" "$STAGE"
    bash "$(dirname "$0")/../06-auto-rollback.sh" "$SERVICE" "previous" "latest" 86400 0.1 || exit 1
done
echo "==> tech-rag 100% 切流完成"