#!/usr/bin/env bash
# =============================================================================
# local-down.sh — stop mate-platform services and optionally remove volumes.
#
# Usage:
#   ./scripts/local-down.sh                # stop + remove containers (keep volumes)
#   ./scripts/local-down.sh --clean        # stop + remove containers + volumes (DESTROYS DATA)
#   ./scripts/local-down.sh --clean-all    # --clean + also remove pulled images
#   ./scripts/local-down.sh --quiet        # suppress non-essential output
#   ./scripts/local-down.sh --rmi local    # remove locally-built images
#
# Notes:
#   - Stop is graceful: SIGTERM, then SIGKILL after 10s (docker compose default).
#   - `--clean` removes named/anonymous volumes. The .env file is preserved.
#   - `--clean-all` additionally removes locally-tagged `mate-tech-*:dev` images.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

CLEAN=0
CLEAN_ALL=0
RMI=""
QUIET=0

for arg in "$@"; do
    case "$arg" in
        --clean)       CLEAN=1 ;;
        --clean-all)   CLEAN_ALL=1; CLEAN=1; RMI="local" ;;
        --rmi)         shift; RMI="${1:-local}" ;;
        --quiet)       QUIET=1 ;;
        --help|-h)
            sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

# Auto-add docker CLI to PATH on Windows
if ! command -v docker >/dev/null 2>&1; then
    for guess in \
        "/c/Users/$USER/AppData/Local/Programs/DockerDesktop/resources/bin" \
        "/c/Program Files/Docker/Docker/resources/bin"; do
        if [ -d "$guess" ]; then
            export PATH="$guess:$PATH"
            break
        fi
    done
fi

DOWN_FLAGS=()
if [ "$CLEAN" -eq 1 ]; then
    [ "$QUIET" -eq 0 ] && echo "==> Stopping + removing containers + volumes (DESTROYS DATA)"
    DOWN_FLAGS+=("--volumes")
else
    [ "$QUIET" -eq 0 ] && echo "==> Stopping services (volumes preserved)"
fi

if [ -n "$RMI" ]; then
    [ "$QUIET" -eq 0 ] && echo "==> Also removing images (--rmi $RMI)"
    DOWN_FLAGS+=("--rmi" "$RMI")
fi

docker compose down "${DOWN_FLAGS[@]}"

echo ""
echo "==> Remaining containers (excluding stopped):"
docker compose ps --format 'table {{.Service}}\t{{.State}}' || true