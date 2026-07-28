#!/usr/bin/env bash
# ST-7.7.2: 自动清理脚本 — 删 7 天前的镜像 + K8s 部署
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/mate}"
APP="${1:-tech-msg}"
DAYS_OLD="${2:-7}"
DRY_RUN="${DRY_RUN:-true}"

echo "==> 清理 ${APP} 超过 ${DAYS_OLD} 天的镜像与部署"

# 列出过期镜像
OLD_IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' | \
    awk -v cutoff="$(date -d "${DAYS_OLD} days ago" '+%Y-%m-%dT%H:%M:%S')" \
    '$2 < cutoff { print $1 }' | \
    grep "${APP}")

echo "  候选过期镜像:"
for img in $OLD_IMAGES; do
    echo "    - $img"
done

# 删除
for img in $OLD_IMAGES; do
    if [ "$DRY_RUN" = "false" ]; then
        echo "  Deleting $img"
        docker rmi "$img" || true
        docker push --delete "$img" 2>/dev/null || true
    else
        echo "  [DRY-RUN] Would delete $img"
    fi
done

# K8s 旧 deployment
if kubectl -n mate-prod get deployment "${APP}-v_old" >/dev/null 2>&1; then
    AGE=$(kubectl -n mate-prod get deployment "${APP}-v_old" -o jsonpath='{.metadata.creationTimestamp}' | \
        xargs -I {} date -d {} +%s | xargs -I {} expr \( $(date +%s) - {} \) / 86400)
    if (( AGE >= DAYS_OLD )); then
        if [ "$DRY_RUN" = "false" ]; then
            kubectl -n mate-prod delete deployment "${APP}-v_old"
        else
            echo "  [DRY-RUN] Would delete deployment ${APP}-v_old"
        fi
    fi
fi

echo "==> 清理完成"