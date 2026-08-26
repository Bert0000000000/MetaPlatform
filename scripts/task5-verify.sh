#!/usr/bin/env bash
# System-level smoke verification for the local Task5 Docker stack.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(
  -f docker-compose.yml
  -f docker-compose.override.yml
  -f docker-compose.task5.yml
)

docker compose "${COMPOSE[@]}" config --quiet

failures=0

printf '  %-25s ... ' "mate-keycloak storage"
keycloak_db="$(docker inspect mate-keycloak --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n 's/^KC_DB=//p')"
if [ -n "$keycloak_db" ] && [ "$keycloak_db" != "dev-mem" ]; then
  echo "OK ($keycloak_db)"
else
  echo "FAIL (KC_DB=${keycloak_db:-missing}; dev-mem is not restart-safe)"
  failures=1
fi

printf '  %-25s ... ' "mate-keycloak realm"
if curl -fsS --max-time 8 "http://localhost:8180/realms/metaplatform/.well-known/openid-configuration" >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAIL (realm is unavailable)"
  failures=$((failures + 1))
fi

printf '  %-25s ... ' "login flow"
if curl -fsS --max-time 15 -X POST "http://localhost:8100/api/v1/iam/auth/login" \
  -H "Content-Type: application/json" \
  --data-raw '{"username":"admin","password":"admin123","tenantId":"tenant-default"}' >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAIL (admin login is unavailable)"
  failures=$((failures + 1))
fi

checks=(
  "mate-api-gateway|http://localhost:8100/healthz"
  "mate-tech-rag|http://localhost:8001/healthz"
  "mate-tech-agent|http://localhost:8002/healthz"
  "a2a-external-agent|http://localhost:8702/healthz"
  "mate-tech-ont|http://localhost:8007/healthz"
  "mate-tech-llmgw|http://localhost:8008/healthz"
  "mate-tech-mcp|http://localhost:8081/healthz"
  "mate-tech-msg|http://localhost:8082/healthz"
  "mate-app-kb|http://localhost:8003/healthz"
  "mate-tech-dw|http://localhost:8021/healthz"
  "mate-tech-etl|http://localhost:8022/api/v1/etl/health"
  "mate-tech-scheduler|http://localhost:8023/api/v1/scheduler/health"
  "mate-tech-metrics|http://localhost:8024/api/v1/metrics/health"
  "mate-auth-service|http://localhost:8101/healthz"
  "mate-app-a2a|http://localhost:8502/api/v1/a2a/health"
  "mate-tech-orchestrator|http://localhost:8505/healthz"
  "mate-tech-data|http://localhost:8701/api/v1/data/health"
)

for item in "${checks[@]}"; do
  service="${item%%|*}"
  url="${item#*|}"
  printf '  %-25s ... ' "$service"
  if curl -fsS --max-time 8 "$url" >/dev/null 2>&1; then
    echo "OK"
  else
    echo "FAIL ($url)"
    failures=$((failures + 1))
  fi
done

printf '  %-25s ... ' "a2a-external-agent card"
if curl -fsS --max-time 8 "http://localhost:8702/.well-known/agent-card.json" >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAIL (http://localhost:8702/.well-known/agent-card.json)"
  failures=$((failures + 1))
fi

container_checks=(
  "mate-postgres"
  "mate-redis"
  "mate-minio"
)

for container in "${container_checks[@]}"; do
  printf '  %-25s ... ' "$container container health"
  container_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || true)"
  if [ "$container_health" = "healthy" ]; then
    echo "OK"
  else
    echo "FAIL (health=$container_health)"
    failures=$((failures + 1))
  fi
done

if [ "${RLS_TEST_DB:-0}" = "1" ]; then
  rls_dsn="${PG_DSN:-postgresql://mate_ont_test:mate_ont_test@localhost:5432/metaplatform_ont_test}"
  printf '  %-25s ... ' "Ontology RLS acceptance"
  echo "running against database=metaplatform_ont_test role=mate_ont_test"
  if PG_DSN="$rls_dsn" bash scripts/ci/verify_ont_rls.sh; then
    echo "  Ontology RLS acceptance ... OK (database=metaplatform_ont_test)"
  else
    echo "  Ontology RLS acceptance ... FAIL (database=metaplatform_ont_test)"
    failures=$((failures + 1))
  fi
fi

printf '  %-25s ... ' "mate-kafka"
kafka_health="$(docker inspect --format '{{.State.Health.Status}}' mate-kafka 2>/dev/null || true)"
if [ "$kafka_health" = "healthy" ]; then
  echo "OK"
else
  echo "FAIL (health=$kafka_health)"
  failures=$((failures + 1))
fi

echo
docker compose "${COMPOSE[@]}" ps --all

if [ "$failures" -ne 0 ]; then
  echo "FAIL: $failures endpoint(s) failed" >&2
  exit 1
fi

echo "OK: Task5 backend smoke verification passed"
