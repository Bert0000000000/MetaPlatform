#!/usr/bin/env bash
# ST-7.4.2: 迁移 #2 — ont + llmgw 流量分阶段切
# 10% → 50% → 100%，每阶段 24h
set -euo pipefail

for STAGE in 10 50 100; do
    for SERVICE in tech-ont tech-llmgw; do
        echo "==> ${SERVICE} → ${STAGE}%"
        bash "$(dirname "$0")/../05-weight-switch.sh" "$SERVICE" "$STAGE"
        bash "$(dirname "$0")/../06-auto-rollback.sh" "$SERVICE" "previous" "latest" 86400 0.1 || exit 1
    done
    echo "==> Stage ${STAGE}% 24h 监控通过"
done

echo "==> ont + llmgw 切 100% 完成"