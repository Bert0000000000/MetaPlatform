#!/usr/bin/env bash
# ST-7.3.1: 迁移 #1 — msg + obs + mcp 预发布演练
# W7-3 4 模块 (msg/obs/mcp) 联合演练 1 周
set -euo pipefail

MODULES=("tech-msg" "tech-obs" "tech-mcp")
STAGING_NS="mate-staging"

echo "==> 启动 3 模块联合演练（1 周观察期）"

# 部署 staging 版本
for mod in "${MODULES[@]}"; do
    echo "  - Deploying ${mod} to ${STAGING_NS}"
    kubectl -n "$STAGING_NS" set image "deployment/${mod}" \
        "${mod}=ghcr.io/mate/${mod}:v_${mod}-staging" \
        --record
done

# 等待所有 deployment ready
for mod in "${MODULES[@]}"; do
    echo "  - Waiting for ${mod}..."
    kubectl -n "$STAGING_NS" rollout status "deployment/${mod}" --timeout=5m
done

# 跑端到端 smoke
echo "==> 端到端 smoke 测试"
for mod in "${MODULES[@]}"; do
    echo "  - ${mod} /healthz:"
    kubectl -n "$STAGING_NS" exec "deployment/${mod}" -- \
        curl -fsS http://localhost:8080/healthz | jq .
done

echo "==> 演练开始：观察 7 天健康检查 + 错误率"
echo "  - 监控面板：http://localhost:3000/d/msg-obs-mcp-staging"
echo "  - 任何错误率 > 0.5% 立即回滚"