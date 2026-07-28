#!/usr/bin/env bash
# ST-7.4.1: 迁移 #2 — ont + llmgw 预发布演练
set -euo pipefail

MODULES=("tech-ont" "tech-llmgw")
STAGING_NS="mate-staging"

for mod in "${MODULES[@]}"; do
    kubectl -n "$STAGING_NS" set image "deployment/${mod}" \
        "${mod}=ghcr.io/mate/${mod}:v_${mod}-staging" --record
    kubectl -n "$STAGING_NS" rollout status "deployment/${mod}" --timeout=5m
    kubectl -n "$STAGING_NS" exec "deployment/${mod}" -- \
        curl -fsS http://localhost:8080/healthz
done

echo "==> ont+llmgw 预发布就绪"