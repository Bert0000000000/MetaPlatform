#!/usr/bin/env bash
# ST-7.7.1: 保留期提醒 — v_{n-1} 镜像保留 7 天
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/mate}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

echo "==> 启动保留期提醒任务"

# 找所有 recent previous tags
PREVIOUS_TAGS=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep "previous$" | sort -u)

for tag in $PREVIOUS_TAGS; do
    APP="${tag%:previous}"
    AGE_DAYS=$(docker inspect --format '{{.Created}}' "$tag" 2>/dev/null | \
        xargs -I {} date -d {} +%s | \
        xargs -I {} expr \( $(date +%s) - {} \) / 86400)

    echo "  ${APP}:previous 龄期: ${AGE_DAYS} 天"

    if (( AGE_DAYS >= 7 )); then
        echo "==> ${APP}:previous 超过 7 天，发送提醒"
        if [ -n "$SLACK_WEBHOOK" ]; then
            curl -sS -X POST "$SLACK_WEBHOOK" \
                -H "Content-Type: application/json" \
                -d "{\"text\": \":warning: ${APP}:previous 保留超过 7 天（${AGE_DAYS} 天）\n准备清理：bash $(dirname \"$0\")/52-cleanup-old-releases.sh ${APP}\"}"
        fi
    fi
done