#!/usr/bin/env bash
# =============================================================================
# local-up.sh — start mate-platform core services via docker compose.
#
# Modes:
#   ./scripts/local-up.sh          # core data plane (PG / Redis / MinIO / Milvus / Neo4j / Kafka / RabbitMQ / Nacos)
#   ./scripts/local-up.sh ai       # + RAGFlow + LightRAG
#   ./scripts/local-up.sh java     # + Flowable + KIE Server
#   ./scripts/local-up.sh edge     # + Traefik + Keycloak
#   ./scripts/local-up.sh monitor  # + Loki + Prometheus + Grafana + OTel
#   ./scripts/local-up.sh all      # everything (default)
#
# Notes:
#   - LightRAG / RAGFlow / DeerFlow need OPENAI_API_KEY in .env
#   - Resources: ~7.5 GB RAM WSL2 default → start core first
#   - For Windows: docker CLI must be in PATH. If not, run from a shell
#     that has it loaded.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
PROFILE="${1:-core}"

case "$PROFILE" in
    core)
        PROFILES=""
        echo "==> Starting core data plane (no profiles)"
        ;;
    ai)
        PROFILES="--profile ai"
        echo "==> Starting core + ai profile (RAGFlow + LightRAG)"
        ;;
    java)
        PROFILES="--profile java"
        echo "==> Starting core + java profile (Flowable + KIE Server)"
        ;;
    edge)
        PROFILES="--profile edge"
        echo "==> Starting core + edge profile (Traefik + Keycloak)"
        ;;
    monitor)
        PROFILES="--profile monitoring"
        echo "==> Starting core + monitoring profile (Loki + Prometheus + Grafana + OTel)"
        ;;
    all)
        PROFILES="--profile edge --profile monitoring --profile java --profile ai"
        echo "==> Starting ALL profiles"
        ;;
    *)
        echo "Unknown profile: $PROFILE"
        echo "Valid: core | ai | java | edge | monitor | all"
        exit 1
        ;;
esac

# Verify config is valid first
echo "==> Validating compose config"
docker compose config --quiet || { echo "compose config has errors"; exit 2; }

# Pull base images (best-effort; failures here only affect later start)
echo "==> Pulling base images"
docker compose pull --ignore-pull-failures || true

# Build local images
echo "==> Building local images"
docker compose build --pull || true

# Start services
echo "==> Starting services"
docker compose $PROFILES up -d

echo ""
echo "==> Running containers:"
docker compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Ports}}' || true