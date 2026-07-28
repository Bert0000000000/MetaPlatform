#!/usr/bin/env bash
# ST-7.2.1: 镜像双 tag — v_n + previous
set -euo pipefail

APP="${1:-tech-msg}"
NEW_VERSION="${2:-$(date +%Y%m%d-%H%M%S)}"

REGISTRY="${REGISTRY:-ghcr.io/mate}"

echo "==> Tagging ${APP} as v_${NEW_VERSION} + previous"

# 主 tag
docker build -t "${REGISTRY}/${APP}:v_${NEW_VERSION}" \
  -f "mate-platform-backend/packages/mate-${APP}/Dockerfile" \
  "mate-platform-backend/packages/mate-${APP}"

# 旧 latest → previous
docker tag "${REGISTRY}/${APP}:latest" "${REGISTRY}/${APP}:previous" 2>/dev/null || true
docker tag "${REGISTRY}/${APP}:v_${NEW_VERSION}" "${REGISTRY}/${APP}:latest"

docker push "${REGISTRY}/${APP}:v_${NEW_VERSION}"
docker push "${REGISTRY}/${APP}:latest"

echo "==> Tagged: ${REGISTRY}/${APP}:v_${NEW_VERSION} (current) + :previous (kept)"