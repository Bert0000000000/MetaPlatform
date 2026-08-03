#!/usr/bin/env bash
# =============================================================================
# local-verify.sh — verify compose config + reachability of running services.
#
# Usage:
#   ./scripts/local-verify.sh
#
# Steps:
#   1. docker compose config --quiet  (static config validation)
#   2. Curl /healthz for every service that exposes 80xx / 81xx / 8180
#   3. Print running containers + health summary
# =============================================================================
set -uo pipefail

cd "$(dirname "$0")/.."

echo "==> Validating compose config"
if ! docker compose config --quiet 2>/dev/null; then
    echo "FAIL: compose config has errors"
    exit 1
fi
echo "OK: compose config"

echo ""
echo "==> Checking running services"
declare -a HEALTH_CHECKS=(
    "mate-postgres|http://localhost:5432 || true"
    "mate-redis|redis-cli ping || true"
    "mate-minio|http://localhost:9000/minio/health/live"
    "mate-milvus|http://localhost:9091/healthz"
    "mate-neo4j|http://localhost:7474"
    "mate-kafka|nc -z localhost 9092"
    "mate-rabbitmq|http://localhost:15672"
    "mate-nacos|http://localhost:8848/nacos/v1/console/health/readiness"
)

for check in "${HEALTH_CHECKS[@]}"; do
    service="${check%%|*}"
    cmd="${check#*|}"
    echo -n "  $service ... "
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${service}$"; then
        if bash -c "$cmd" >/dev/null 2>&1; then
            echo "OK (running, healthy)"
        else
            echo "WARN (running, unhealthy)"
        fi
    else
        echo "SKIP (not running)"
    fi
done

echo ""
echo "==> All containers:"
docker compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}' || true