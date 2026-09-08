#!/usr/bin/env bash
# Start the Docker-backed local Task5 acceptance stack without rebuilding the
# full Python workspace. The task5 compose overlay reuses verified local
# runtime images and mounts the current backend packages.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(
  -f docker-compose.yml
)
if [ "${TASK5_USE_OVERRIDE:-0}" = "1" ]; then
  if [ ! -f docker-compose.override.yml ]; then
    echo "FAIL: TASK5_USE_OVERRIDE=1 but docker-compose.override.yml is missing" >&2
    exit 1
  fi
  COMPOSE+=(-f docker-compose.override.yml)
fi
COMPOSE+=(-f docker-compose.task5.yml)

WAIT_HEALTHY=0
for arg in "$@"; do
  case "$arg" in
    --wait) WAIT_HEALTHY=1 ;;
    --help|-h)
      echo "Usage: ./scripts/task5-up.sh [--wait]"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 1
      ;;
  esac
done

docker compose "${COMPOSE[@]}" config --quiet

# Agent is part of the Task5 acceptance surface. Build its dedicated runtime
# image on first use; other services continue to reuse their verified images.
if ! docker image inspect mate-tech-agent:task5 >/dev/null 2>&1; then
  echo "==> Building mate-tech-agent:task5"
  docker compose "${COMPOSE[@]}" build mate-tech-agent
fi

if ! docker image inspect a2a-external-agent:task5 >/dev/null 2>&1; then
  echo "==> Building a2a-external-agent:task5"
  docker compose "${COMPOSE[@]}" build a2a-external-agent
fi

# Existing local pgdata volumes predate the Keycloak PostgreSQL database
# declaration in infra/init-multiple-databases.sql. Ensure the database exists
# before Keycloak is started so an upgrade does not depend on a fresh volume.
docker compose "${COMPOSE[@]}" up -d --no-build --no-recreate postgres
echo "==> Waiting for PostgreSQL..."
postgres_deadline=$((SECONDS + 120))
postgres_state=""
while [ "$SECONDS" -lt "$postgres_deadline" ]; do
  postgres_state=$(docker inspect mate-postgres --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
  case "$postgres_state" in
    running\|healthy|running\|none) break ;;
  esac
  sleep 3
done
case "$postgres_state" in
  running\|healthy|running\|none) ;;
  *)
    echo "FAIL: PostgreSQL did not become ready before timeout" >&2
    exit 1
    ;;
esac

postgres_user=$(docker inspect mate-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed -n 's/^POSTGRES_USER=//p')
postgres_user="${postgres_user:-meta}"
if docker exec mate-postgres psql -U "$postgres_user" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='keycloak'" | grep -q '^1$'; then
  echo "==> Keycloak database is present"
else
  echo "==> Creating Keycloak database"
  docker exec mate-postgres createdb -U "$postgres_user" \
    --encoding=UTF8 --locale=en_US.UTF-8 --lc-collate=en_US.UTF-8 \
    --lc-ctype=en_US.UTF-8 --template=template0 keycloak
fi

# Upgrade an already-running pre-fix container instead of leaving the old
# dev-mem configuration in place because this local launcher intentionally
# avoids recreating unchanged services.
keycloak_db=$(docker inspect mate-keycloak --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
  | sed -n 's/^KC_DB=//p' || true)
if [ "$keycloak_db" = "dev-mem" ]; then
  echo "==> Recreating legacy dev-mem Keycloak/Auth/Gateway containers"
  docker compose "${COMPOSE[@]}" up -d --no-build --force-recreate \
    keycloak mate-auth-service mate-api-gateway
fi

# These services mount the backend source tree. Recreate them so Task5 runs
# the current worktree (rather than retaining an earlier checkout), and so
# their PostgreSQL bootstrap reconnects after a local database replacement.
# Start producer services first: mate-tech-ont can take time to apply durable
# DDL on Docker Desktop volumes, while the orchestrator and gateway depend on
# its health. Starting them as a single compose graph leaves an opaque wait.
docker compose "${COMPOSE[@]}" up -d --no-build --force-recreate \
  mate-app-copilot mate-tech-ont mate-tech-agent a2a-external-agent mate-app-wfe

wait_for_healthy() {
  local service="$1"
  local timeout_seconds="$2"
  local deadline=$((SECONDS + timeout_seconds))
  local state=""
  echo "==> Waiting up to ${timeout_seconds}s for ${service}..."
  while [ "$SECONDS" -lt "$deadline" ]; do
    state=$(docker inspect "$service" --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
    case "$state" in
      running\|healthy|running\|none) return 0 ;;
    esac
    sleep 3
  done
  echo "FAIL: ${service} did not become healthy (state=${state:-missing})" >&2
  return 1
}

# Ontology creates the durable semantic tables before downstream services are
# allowed to restore their state. The longer bound is intentional: local
# Docker Desktop volume sync can make first-time DDL materially slower.
wait_for_healthy mate-tech-ont 300
docker compose "${COMPOSE[@]}" up -d --no-build --force-recreate mate-tech-orchestrator
wait_for_healthy mate-tech-orchestrator 180
docker compose "${COMPOSE[@]}" up -d --no-build --force-recreate mate-api-gateway
# Metrics is part of the platform-governance acceptance surface. Start it
# explicitly because older local stacks may have been created before the
# service was included in the Task5 verification set.
docker compose "${COMPOSE[@]}" up -d --no-build --no-recreate mate-tech-metrics
docker compose "${COMPOSE[@]}" up -d --no-build --no-recreate

# The service account is a first-class tenant principal, not a wildcard
# caller. Keycloak creates it dynamically, so its tenant attribute must be
# applied after the imported realm is ready. The regular user-attribute
# mapper then includes this value in service tokens without overriding the
# tenant claim of ordinary users.
echo "==> Binding the Task5 service account to tenant-default"
keycloak_deadline=$((SECONDS + 120))
keycloak_state=""
while [ "$SECONDS" -lt "$keycloak_deadline" ]; do
  keycloak_state=$(docker inspect mate-keycloak --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
  case "$keycloak_state" in
    running\|healthy|running\|none) break ;;
  esac
  sleep 3
done
case "$keycloak_state" in
  running\|healthy|running\|none) ;;
  *)
    echo "FAIL: Keycloak did not become ready before tenant binding" >&2
    exit 1
    ;;
esac

if docker exec mate-keycloak sh -eu -c '
  /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://localhost:8080 --realm master \
    --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null
'; then
  client_id=$(docker exec mate-keycloak /opt/keycloak/bin/kcadm.sh get clients \
    -r metaplatform -q clientId=metaplatform-backend --fields id \
    | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')
  service_user_id=$(docker exec mate-keycloak /opt/keycloak/bin/kcadm.sh get users \
    -r metaplatform -q username=service-account-metaplatform-backend --fields id \
    | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')
  if [ -z "$client_id" ] || [ -z "$service_user_id" ]; then
    echo "FAIL: Keycloak client or service account for metaplatform-backend is unavailable" >&2
    exit 1
  fi
  # A short-lived local workaround once put this claim mapper on the client.
  # Remove it from existing Keycloak databases: the generic user-attribute
  # mapper must be the only source of tenant_id, otherwise every human token
  # could be overwritten as tenant-default.
  legacy_mapper_id=$(docker exec mate-keycloak /opt/keycloak/bin/kcadm.sh get \
    "clients/$client_id/protocol-mappers/models" -r metaplatform --fields id,name \
    | awk -F '"' '$2 == "id" { id = $4 } $2 == "name" && $4 == "service-account-tenant-default" { print id; exit }')
  if [ -n "$legacy_mapper_id" ]; then
    echo "==> Removing legacy fixed-tenant claim mapper"
    docker exec mate-keycloak /opt/keycloak/bin/kcadm.sh delete \
      "clients/$client_id/protocol-mappers/models/$legacy_mapper_id" -r metaplatform >/dev/null
  fi
  docker cp infra/keycloak/service-account-tenant-default-user.json \
    mate-keycloak:/tmp/service-account-tenant-default-user.json >/dev/null
  docker exec mate-keycloak /opt/keycloak/bin/kcadm.sh update \
    "users/$service_user_id" -r metaplatform \
    -f /tmp/service-account-tenant-default-user.json >/dev/null
else
  # An existing local Keycloak database can retain bootstrap credentials from
  # a former compose override. Do not reset identity data just to reapply an
  # already-safe configuration. Verify the two security invariants instead.
  echo "==> Keycloak bootstrap credentials differ; verifying existing tenant binding"
  legacy_mapper_exists=$(docker exec mate-postgres sh -eu -c '
    PGPASSWORD="$POSTGRES_PASSWORD" psql -w -U "$POSTGRES_USER" -d keycloak -tAc \
      "SELECT 1 FROM protocol_mapper WHERE name = '\''service-account-tenant-default'\'' LIMIT 1"
  ')
  if [ "$legacy_mapper_exists" = "1" ]; then
    echo "FAIL: legacy fixed-tenant mapper exists but Keycloak admin credentials are unavailable" >&2
    exit 1
  fi
  if docker compose "${COMPOSE[@]}" exec -T mate-app-wfe sh -eu -c '
    response=$(curl -fsS -X POST "http://keycloak:8080/realms/metaplatform/protocol/openid-connect/token" \
      -d "grant_type=client_credentials" \
      -d "client_id=$SERVICE_CLIENT_ID" \
      -d "client_secret=$SERVICE_CLIENT_SECRET")
    token=$(printf "%s" "$response" | python -c "import json,sys; print(json.load(sys.stdin)[\"access_token\"])")
    TOKEN="$token" python -c "import os,json,base64; part=os.environ[\"TOKEN\"].split(\".\")[1]; part += \"=\" * (-len(part)%4); assert json.loads(base64.urlsafe_b64decode(part))[\"tenant_id\"] == \"tenant-default\""
  ' >/dev/null 2>&1; then
    echo "==> Existing service account tenant binding verified"
  else
    echo "FAIL: service account is not tenant-bound and Keycloak admin credentials are unavailable" >&2
    exit 1
  fi
fi

if [ "$WAIT_HEALTHY" -eq 1 ]; then
  echo "==> Waiting up to 180s for Task5 services..."
  deadline=$((SECONDS + 180))
  while [ "$SECONDS" -lt "$deadline" ]; do
    pending=0
    for service in mate-api-gateway mate-app-copilot mate-tech-ont mate-app-wfe mate-tech-msg mate-tech-dw mate-tech-agent a2a-external-agent mate-app-kb mate-app-a2a mate-tech-orchestrator mate-tech-data mate-tech-metrics; do
      state=$(docker inspect "$service" --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
      case "$state" in
        running\|healthy|running\|none) ;;
        *) pending=$((pending + 1)) ;;
      esac
    done
    [ "$pending" -eq 0 ] && break
    sleep 3
  done
  if [ "$pending" -ne 0 ]; then
    echo "FAIL: Task5 services did not become healthy before timeout" >&2
    exit 1
  fi
fi

docker compose "${COMPOSE[@]}" ps --all
