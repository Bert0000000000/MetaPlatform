#!/usr/bin/env bash
# ST-7.1.4: 流量影子 — staging 接收 5% 影子流量（不写回）
set -euo pipefail

TRAEFIK_CONFIG="infra/traefik/dynamic"
STAGING_NS="mate-staging"

echo "==> 配置流量影子 (5% → staging)"

# Traefik 中间件 + 服务
cat > "$TRAEFIK_CONFIG/middlewares/mirror-staging.yaml" <<EOF
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: mirror-staging
spec:
  mirror:
    body: true
    maxBodySize: 10MiB
    services:
      - name: app-staging
        namespace: $STAGING_NS
        port: 80
  mirrorPercent: 5
EOF

# 应用到所有 app router
for app in portal dashboard ontstudio kb mcphub apphub arch dw superai; do
    cat >> "$TRAEFIK_CONFIG/routers/services.yaml" <<EOF
  ${app}-router-staging:
    rule: Host(\`${app}.mate.local\`) || PathPrefix(\`/api/v1/${app}\`)
    service: ${app}-service
    middlewares:
      - mirror-staging
EOF
done

echo "==> 流量影子配置完成（5% 流量到 staging）"