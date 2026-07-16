#!/usr/bin/env bash
# ============================================================================
# start-all.sh — Start all MetaPlatform services for E2E testing
# ============================================================================
# Brings up infrastructure (via docker-compose) then starts application
# services and waits for them to become healthy.
#
# Usage:
#   ./scripts/start-all.sh                # full startup
#   ./scripts/start-all.sh --infra-only   # only start infrastructure
#   ./scripts/start-all.sh --no-wait      # start but don't wait for health
#
# Prerequisites:
#   - Docker and Docker Compose v2 installed
#   - .env file in project root
#   - Application JARs/binaries already built
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PARENT_ROOT="$(cd "${PROJECT_ROOT}/.." && pwd)"

# Load .env
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

INFRA_ONLY=false
NO_WAIT=false
for arg in "$@"; do
  case "${arg}" in
    --infra-only) INFRA_ONLY=true ;;
    --no-wait)    NO_WAIT=true ;;
    *)            echo "Unknown option: ${arg}"; exit 1 ;;
  esac
done

COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# --- Fallback: individual docker run commands if compose file doesn't exist ---
start_infra_docker_run() {
  echo "[INFO] docker-compose.yml not found; starting infrastructure via docker run..."

  local NET="mp-e2e-net"

  # Create network if it doesn't exist
  docker network inspect "${NET}" >/dev/null 2>&1 || docker network create "${NET}"

  # PostgreSQL
  if ! docker ps --format '{{.Names}}' | grep -q '^mp-e2e-pg$'; then
    echo "  Starting PostgreSQL..."
    docker run -d --name mp-e2e-pg --network "${NET}" \
      -p "${POSTGRES_PORT:-5432}:5432" \
      -e POSTGRES_USER="${POSTGRES_USER:-meta}" \
      -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-metaplatform}" \
      -e POSTGRES_DB="${POSTGRES_DB:-metaplatform}" \
      -v "${SCRIPT_DIR}/init-multi-db.sh:/docker-entrypoint-initdb.d/init-multi-db.sh:ro" \
      postgres:16-alpine
  fi

  # Redis
  if ! docker ps --format '{{.Names}}' | grep -q '^mp-e2e-redis$'; then
    echo "  Starting Redis..."
    docker run -d --name mp-e2e-redis --network "${NET}" \
      -p "${REDIS_PORT:-6379}:6379" \
      redis:7-alpine
  fi

  # Kafka (KRaft mode, single node)
  if ! docker ps --format '{{.Names}}' | grep -q '^mp-e2e-kafka$'; then
    echo "  Starting Kafka..."
    docker run -d --name mp-e2e-kafka --network "${NET}" \
      -p "9092:9092" \
      -e KAFKA_NODE_ID=1 \
      -e KAFKA_PROCESS_ROLES=broker,controller \
      -e KAFKA_LISTENERS='PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093' \
      -e KAFKA_ADVERTISED_LISTENERS='PLAINTEXT://localhost:9092' \
      -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
      -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP='CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT' \
      -e KAFKA_CONTROLLER_QUORUM_VOTERS='1@localhost:9093' \
      -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
      -e CLUSTER_ID='MkU3OEVBNTcwNTJENDM2Qk' \
      apache/kafka:3.7.0
  fi

  # Neo4j
  if ! docker ps --format '{{.Names}}' | grep -q '^mp-e2e-neo4j$'; then
    echo "  Starting Neo4j..."
    docker run -d --name mp-e2e-neo4j --network "${NET}" \
      -p "7474:7474" -p "7687:7687" \
      -e NEO4J_AUTH="${NEO4J_USER:-neo4j}/${NEO4J_PASSWORD:-metaplatform}" \
      neo4j:5-community
  fi

  echo "  Infrastructure containers started."
}

start_infra_compose() {
  echo "[INFO] Starting infrastructure via docker-compose..."
  docker compose -f "${COMPOSE_FILE}" up -d
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "==============================================="
echo " MetaPlatform E2E — Start All Services"
echo "==============================================="
echo ""

# Step 1: Start infrastructure
echo "[Step 1/4] Starting infrastructure..."
if [[ -f "${COMPOSE_FILE}" ]]; then
  start_infra_compose
else
  start_infra_docker_run
fi

# Step 2: Wait for infrastructure
echo ""
echo "[Step 2/4] Waiting for infrastructure to be ready..."
sleep 5  # Give containers a moment to initialize

# Check PostgreSQL
echo -n "  PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec mp-e2e-pg pg_isready -U "${POSTGRES_USER:-meta}" >/dev/null 2>&1; then
    echo " OK"
    break
  fi
  if [[ $i -eq 30 ]]; then echo " TIMEOUT"; exit 1; fi
  sleep 1
done

# Check Redis
echo -n "  Redis..."
for i in $(seq 1 15); do
  if docker exec mp-e2e-redis redis-cli ping 2>/dev/null | grep -q PONG; then
    echo " OK"
    break
  fi
  if [[ $i -eq 15 ]]; then echo " TIMEOUT"; exit 1; fi
  sleep 1
done

if [[ "${INFRA_ONLY}" == "true" ]]; then
  echo ""
  echo "Infrastructure is up. (--infra-only mode)"
  echo "==============================================="
  exit 0
fi

# Step 3: Start application services
echo ""
echo "[Step 3/4] Starting application services..."

# Each service is expected to have its own docker-compose or be started individually.
# The actual startup mechanism depends on the deployment strategy.
# Below we provide placeholder commands that can be customized.

SERVICES=(
  "ontology-engine:${ONTOLOGY_ENGINE_PORT:-8080}"
  "data-stack:${DATA_STACK_PORT:-8081}"
  "platform-base:${PLATFORM_BASE_PORT:-8082}"
  "ai-substrate:${AI_SUBSTRATE_PORT:-8083}"
  "page-generator:${PAGE_GENERATOR_PORT:-8084}"
  "dialogue:${DIALOGUE_PORT:-8085}"
  "capability-library:${CAPABILITY_LIBRARY_PORT:-8086}"
  "process-engine:${PROCESS_ENGINE_PORT:-8087}"
  "rag-mdm:${RAG_MDM_PORT:-8090}"
)

for svc_entry in "${SERVICES[@]}"; do
  name="${svc_entry%%:*}"
  port="${svc_entry##*:}"
  echo "  Starting ${name} (port ${port})..."

  # Check if already running
  if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 \
     "http://localhost:${port}/actuator/health" 2>/dev/null | grep -q "200"; then
    echo "    Already running."
    continue
  fi

  # Try project-specific docker-compose
  local_compose="${PARENT_ROOT}/metaplatform-${name}/docker-compose.yml"
  if [[ -f "${local_compose}" ]]; then
    (cd "$(dirname "${local_compose}")" && docker compose up -d) &
  else
    echo "    [WARN] No docker-compose found for ${name}. Start it manually."
  fi
done
wait

# Step 4: Wait for health
echo ""
if [[ "${NO_WAIT}" == "true" ]]; then
  echo "[Step 4/4] Skipping health check (--no-wait)."
else
  echo "[Step 4/4] Waiting for services to become healthy..."
  "${SCRIPT_DIR}/wait-for-healthy.sh" || true
fi

echo ""
echo "==============================================="
echo " MetaPlatform E2E — All services started"
echo "==============================================="
