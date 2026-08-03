#!/usr/bin/env bash
# =============================================================================
# local-down.sh — stop mate-platform services and remove volumes.
#
# Modes:
#   ./scripts/local-down.sh           # stop + remove containers (keep volumes)
#   ./scripts/local-down.sh --clean   # stop + remove containers + volumes (DESTROYS DATA)
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

CLEAN=""
if [[ "${1:-}" == "--clean" ]]; then
    CLEAN="--volumes"
    echo "==> Stopping and removing volumes (DESTROYS DATA)"
else
    echo "==> Stopping services (volumes preserved)"
fi

docker compose down $CLEAN

echo ""
echo "==> Remaining containers:"
docker compose ps --format 'table {{.Service}}\t{{.State}}' || true