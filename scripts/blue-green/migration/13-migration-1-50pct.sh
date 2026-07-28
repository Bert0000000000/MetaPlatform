#!/usr/bin/env bash
# ST-7.3.4: 迁移 #1 — tech-msg 切 50% 流量
set -euo pipefail
SERVICE="tech-msg"
bash "$(dirname "$0")/../05-weight-switch.sh" "$SERVICE" 50
bash "$(dirname "$0")/../06-auto-rollback.sh" "$SERVICE" "previous" "latest" 86400 0.1
echo "==> 24h 后如无问题继续到 100%"