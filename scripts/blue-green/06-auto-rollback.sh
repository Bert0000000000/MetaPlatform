#!/usr/bin/env bash
# ST-7.2.3: 健康检查 + 自动回滚 — v_n 切 100% 后 60s 内 5xx > 1% → 回滚
set -euo pipefail

SERVICE="${1:-tech-msg}"
OLD_TAG="${2:-previous}"
NEW_TAG="${3:-latest}"
WAIT_SECS="${4:-60}"
THRESHOLD="${5:-1}"  # 1% 5xx

PROM_URL="${PROM_URL:-http://localhost:9090}"
ROUTER_NAME="${SERVICE//-/_}"

echo "==> 监控 ${SERVICE} 切流后 ${WAIT_SECS}s 内 5xx 率"
echo "  Threshold: ${THRESHOLD}%"
echo "  Auto rollback to: ${OLD_TAG}"

END=$((SECONDS + WAIT_SECS))
MAX_ERROR_PCT=0
while [ $SECONDS -lt $END ]; do
    ERROR_PCT=$(curl -sG "$PROM_URL/api/v1/query" \
        --data-urlencode "query=sum(rate(http_requests_total{service=\"$SERVICE\",status=~\"5..\"}[1m])) / sum(rate(http_requests_total{service=\"$SERVICE\"}[1m])) * 100" \
        | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")

    if (( $(echo "$ERROR_PCT > $MAX_ERROR_PCT" | bc -l) )); then
        MAX_ERROR_PCT=$ERROR_PCT
    fi

    echo "  [t=$((SECONDS))s] 5xx rate: ${ERROR_PCT}%"

    if (( $(echo "$ERROR_PCT > $THRESHOLD" | bc -l) )); then
        echo "==> 5xx 率超阈值！触发自动回滚到 ${OLD_TAG}"
        bash "$(dirname "$0")/05-weight-switch.sh" "$SERVICE" 0
        bash "$(dirname "$0")/04-dual-tag.sh" "$SERVICE" "$OLD_TAG"
        exit 1
    fi

    sleep 5
done

if (( $(echo "$MAX_ERROR_PCT > $THRESHOLD" | bc -l) )); then
    echo "==> ${WAIT_SECS}s 内最大 5xx = ${MAX_ERROR_PCT}% (超阈值)"
    bash "$(dirname "$0")/05-weight-switch.sh" "$SERVICE" 0
    exit 1
fi

echo "==> 健康检查通过 (max 5xx = ${MAX_ERROR_PCT}%)"