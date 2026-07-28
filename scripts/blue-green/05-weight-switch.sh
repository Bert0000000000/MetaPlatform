#!/usr/bin/env bash
# ST-7.2.2: Traefik 权重切换 — 5s 内生效
set -euo pipefail

SERVICE="${1:-tech-msg}"
WEIGHT="${2:-100}"  # 0-100

TRAEFIK_CONFIG="infra/traefik/dynamic"
ROUTER_NAME="${SERVICE//-/_}-router"

echo "==> Switching ${SERVICE} router to weight=${WEIGHT}%"

# Traefik 动态更新 router
cat > "$TRAEFIK_CONFIG/routers/${SERVICE}-weight.yaml" <<EOF
http:
  routers:
    ${SERVICE}-router:
      rule: Host(\`${SERVICE}.mate.local\`)
      service: ${SERVICE}-service
      priority: 100
  services:
    ${SERVICE}-service:
      weighted:
        services:
          - name: ${SERVICE}-v_old
            weight: $((100 - WEIGHT))
          - name: ${SERVICE}-v_new
            weight: ${WEIGHT}
EOF

# 触发 reload
curl -X POST http://localhost:8080/api/providers/rest

echo "==> ${SERVICE} → v_new ${WEIGHT}% / v_old $((100 - WEIGHT))%"