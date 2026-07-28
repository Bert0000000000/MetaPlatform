#!/usr/bin/env bash
# ST-7.6.1: 迁移 #4 — agent + app-kb 预发布 + S1-S4 场景
set -euo pipefail

MODULES=("tech-agent" "app-kb")

for mod in "${MODULES[@]}"; do
    kubectl -n mate-staging set image "deployment/${mod}" \
        "${mod}=ghcr.io/mate/${mod}:v_${mod}-staging" --record
    kubectl -n mate-staging rollout status "deployment/${mod}" --timeout=5m
done

# 跑 4 个 agent 场景
echo "==> 跑 S1-S4 场景"
for scenario in S1 S2 S3 S4; do
    echo "  - ${scenario}:"
    curl -fsS -X POST "http://localhost:8080/api/v1/agent/${scenario,,}/test" \
        -H "Content-Type: application/json" \
        -d '{"input": "test"}' | jq -r ".scenario, .status"
done