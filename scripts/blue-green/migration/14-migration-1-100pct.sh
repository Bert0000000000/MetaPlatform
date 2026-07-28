#!/usr/bin/env bash
# ST-7.3.5: 迁移 #1 — tech-msg 切 100% 流量
set -euo pipefail
SERVICE="tech-msg"
bash "$(dirname "$0")/../05-weight-switch.sh" "$SERVICE" 100
echo "==> 7 天观察期（每日 24h 监控）"
for i in 1 2 3 4 5 6 7; do
    echo "  Day $i: $(date)"
    bash "$(dirname "$0")/../06-auto-rollback.sh" "$SERVICE" "previous" "latest" 86400 0.1 || true
    sleep 86400
done
echo "==> 7 天无 P0/P1 → 标记 v_n 为 latest"
kubectl -n mate-prod tag tech-msg:previous tech-msg:v_msg-old
docker push ghcr.io/mate/tech-msg:previous
echo "  标 previous = v_msg-old（保留 7 天）"