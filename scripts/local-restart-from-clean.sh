#!/usr/bin/env bash
# =============================================================================
# local-restart-from-clean.sh
#
# One-shot recovery script for "Docker Desktop reinstalled" / "daemon dead" /
# "fresh start" scenarios. Performs, in order:
#
#   1. Detect docker CLI (auto-add Docker Desktop bin/ to PATH if missing)
#   2. Detect docker daemon (ping, retry, give a clear error if down)
#   3. Sanity check compose project files (.env, docker-compose.yml)
#   4. Backup current .env to .env.bak-<timestamp>
#   5. Verify the .env contains valid LLM endpoint (MiniMax-M3 or fallback)
#   6. Optionally reset stale containers / images
#   7. Pull base images + build local images
#   8. Start core + monitor + edge profiles (3-profile default, ~6.5 GB RAM)
#   9. Wait up to 600s for healthy
#  10. Run local-verify.sh with --llmgw probe
#
# Usage:
#   ./scripts/local-restart-from-clean.sh               # default: 3 profiles + llmgw probe
#   ./scripts/local-restart-from-clean.sh --no-llmgw    # skip the MiniMax-M3 probe
#   ./scripts/local-restart-from-clean.sh --no-wait     # don't wait for healthy
#   ./scripts/local-restart-from-clean.sh --skip-build  # use cached images
#   ./scripts/local-restart-from-clean.sh --clean       # remove volumes + containers first
#
# Notes:
#   - This script is idempotent: safe to re-run if it fails midway.
#   - It does NOT change Docker Desktop settings; that must be done in the GUI.
#   - If WSL2 vhdx files were preserved (D:\Docker\DockerDesktopWSL\disk\),
#     dockerd will reuse them automatically after daemon comes back up.
# =============================================================================
set -uo pipefail

cd "$(dirname "$0")/.."

PROFILES_DEFAULT="--profile edge --profile monitoring"
LLMGW_PROBE=1
WAIT_HEALTHY=1
SKIP_BUILD=0
CLEAN=0
QUIET=0

for arg in "$@"; do
    case "$arg" in
        --no-llmgw)    LLMGW_PROBE=0 ;;
        --no-wait)     WAIT_HEALTHY=0 ;;
        --skip-build)  SKIP_BUILD=1 ;;
        --clean)       CLEAN=1 ;;
        --quiet)       QUIET=1 ;;
        --help|-h)
            sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

log() {
    [ "$QUIET" -eq 0 ] && echo "==> $*"
}

# ============================================================
# Step 1: Detect docker CLI
# ============================================================
log "Step 1/10: detect docker CLI"
if ! command -v docker >/dev/null 2>&1; then
    FOUND=0
    for guess in \
        "/c/Users/$USER/AppData/Local/Programs/DockerDesktop/resources/bin" \
        "/c/Program Files/Docker/Docker/resources/bin"; do
        if [ -d "$guess" ]; then
            export PATH="$guess:$PATH"
            log "  added $guess to PATH"
            FOUND=1
            break
        fi
    done
    if [ "$FOUND" -eq 0 ]; then
        echo "ERROR: docker CLI not found. Install Docker Desktop first." >&2
        echo "  - macOS: https://docs.docker.com/desktop/install/mac-install/" >&2
        echo "  - Windows: https://docs.docker.com/desktop/install/windows-install/" >&2
        echo "  - Linux: install docker-ce per distro docs" >&2
        exit 1
    fi
fi
docker --version
docker compose version

# ============================================================
# Step 2: Detect docker daemon
# ============================================================
log "Step 2/10: detect docker daemon"
DAEMON_OK=0
for i in 1 2 3 4 5 6; do
    if docker info >/dev/null 2>&1; then
        DAEMON_OK=1
        break
    fi
    log "  retry $i/6: daemon not reachable yet, sleeping 5s..."
    sleep 5
done
if [ "$DAEMON_OK" -eq 0 ]; then
    echo "ERROR: docker daemon unreachable after 30s." >&2
    echo "  Possible causes:" >&2
    echo "   - Docker Desktop not running (start from GUI/Start Menu)" >&2
    echo "   - WSL2 distro 'docker-desktop' not registered (run 'wsl -l -v')" >&2
    echo "   - Disk image location points to a moved/deleted .vhdx (check Settings -> Resources -> Advanced)" >&2
    exit 1
fi
log "  daemon OK"

# ============================================================
# Step 3: Sanity check compose project files
# ============================================================
log "Step 3/10: sanity check compose files"
if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: docker-compose.yml not found in $(pwd)" >&2
    exit 1
fi
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "WARN: .env missing; copying from .env.example"
        cp .env.example .env
    else
        echo "ERROR: .env missing and no .env.example to copy from" >&2
        exit 1
    fi
fi

# ============================================================
# Step 4: Backup current .env
# ============================================================
log "Step 4/10: backup .env"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
BAK=".env.bak-${TS}"
cp .env "$BAK"
log "  saved $BAK"

# ============================================================
# Step 5: Verify .env LLM endpoint
# ============================================================
log "Step 5/10: verify .env LLM endpoint"
PROVIDER=$(grep -E '^OPENAI_BASE_URL=' .env | cut -d'=' -f2- | tr -d '"' || true)
ANTHROPIC=$(grep -E '^ANTHROPIC_BASE_URL=' .env | cut -d'=' -f2- | tr -d '"' || true)
KEY_OPENAI=$(grep -E '^OPENAI_API_KEY=' .env | cut -d'=' -f2- | tr -d '"' || true)
KEY_ANTHROPIC=$(grep -E '^ANTHROPIC_API_KEY=' .env | cut -d'=' -f2- | tr -d '"' || true)
log "  OPENAI_BASE_URL=$PROVIDER"
log "  ANTHROPIC_BASE_URL=$ANTHROPIC"
[ -z "$KEY_OPENAI" ] && log "  WARN: OPENAI_API_KEY is empty (some services will fail)"
[ -z "$KEY_ANTHROPIC" ] && log "  WARN: ANTHROPIC_API_KEY is empty (mate-tech-llmgw anthropic provider will fail)"

# ============================================================
# Step 6: Optionally reset stale containers
# ============================================================
if [ "$CLEAN" -eq 1 ]; then
    log "Step 6/10: cleaning stale containers + volumes (DESTROYS DATA)"
    docker compose down --volumes --remove-orphans || true
else
    log "Step 6/10: stopping any stale containers (volumes preserved)"
    docker compose down --remove-orphans || true
fi

# ============================================================
# Step 7: Pull + Build
# ============================================================
log "Step 7/10: pull + build images"
docker compose pull --ignore-pull-failures || true
if [ "$SKIP_BUILD" -eq 0 ]; then
    if ! docker compose build --pull 2>/dev/null; then
        log "  build failed (likely WSL2 + .pytest_cache ACL); falling back to cached images"
        log "  TODO: rebuild stale images manually after restart"
    fi
fi

# ============================================================
# Step 8: Start services (3 profiles: edge + monitoring)
# ============================================================
log "Step 8/10: start services (profiles: $PROFILES_DEFAULT)"
docker compose up -d $PROFILES_DEFAULT

# ============================================================
# Step 9: Wait for healthy
# ============================================================
if [ "$WAIT_HEALTHY" -eq 1 ]; then
    log "Step 9/10: wait up to 600s for healthy"
    timeout=600
    elapsed=0
    while [ $elapsed -lt $timeout ]; do
        total=$(docker compose ps --format '{{.Service}}' | wc -l)
        healthy=$(docker compose ps --format '{{.State}}' | grep -c 'healthy' || true)
        running=$(docker compose ps --format '{{.State}}' | grep -cE 'Up|running' || true)
        log "  [$elapsed s] total=$total running=$running healthy=$healthy"
        if [ "$healthy" -ge "$total" ] && [ "$total" -gt 0 ]; then
            log "  all $total services healthy"
            break
        fi
        sleep 10
        elapsed=$((elapsed+10))
    done
    if [ $elapsed -ge $timeout ]; then
        echo "WARN: timed out after ${timeout}s" >&2
    fi
else
    log "Step 9/10: skipped (--no-wait)"
fi

# ============================================================
# Step 10: Verify + LLMGW probe
# ============================================================
log "Step 10/10: run local-verify.sh"
VERIFY_FLAGS="--skip-config"
[ "$LLMGW_PROBE" -eq 1 ] && VERIFY_FLAGS="$VERIFY_FLAGS --llmgw"
bash scripts/local-verify.sh $VERIFY_FLAGS || log "WARN: verify reported issues (see above)"

echo ""
echo "============================================================"
echo "DONE. Next steps:"
echo "  - Inspect: docker compose ps"
echo "  - Logs:    docker compose logs -f mate-tech-llmgw"
echo "  - Test:    bash scripts/local-verify.sh --llmgw"
echo "  - Restore .env from backup if needed: mv $BAK .env"
echo "============================================================"