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

# Recreate Agent explicitly so an older placeholder container cannot survive
# the overlay change with the wrong image/command.
docker compose "${COMPOSE[@]}" up -d --no-build --force-recreate mate-tech-agent
docker compose "${COMPOSE[@]}" up -d --no-build --force-recreate a2a-external-agent
# The local WFE owns the versioned Plan tables. Recreate it after PostgreSQL
# is confirmed ready so its development bootstrap creates the tables when a
# local database container has been replaced.
docker compose "${COMPOSE[@]}" up -d --no-build --force-recreate mate-app-wfe
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

docker exec mate-keycloak sh -eu -c '
  /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://localhost:8080 --realm master \
    --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null
'
service_user_id=$(docker exec mate-keycloak /opt/keycloak/bin/kcadm.sh get users \
  -r metaplatform -q username=service-account-metaplatform-backend --fields id \
  | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p')
if [ -z "$service_user_id" ]; then
  echo "FAIL: Keycloak service account for metaplatform-backend is unavailable" >&2
  exit 1
fi
docker cp infra/keycloak/service-account-tenant-default-user.json \
  mate-keycloak:/tmp/service-account-tenant-default-user.json >/dev/null
docker exec mate-keycloak /opt/keycloak/bin/kcadm.sh update \
  "users/$service_user_id" -r metaplatform \
  -f /tmp/service-account-tenant-default-user.json >/dev/null

if [ "$WAIT_HEALTHY" -eq 1 ]; then
  echo "==> Waiting up to 180s for Task5 services..."
  deadline=$((SECONDS + 180))
  while [ "$SECONDS" -lt "$deadline" ]; do
    pending=0
    for service in mate-tech-msg mate-tech-dw mate-tech-agent a2a-external-agent mate-app-kb mate-app-a2a mate-tech-orchestrator mate-tech-data mate-tech-metrics; do
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
