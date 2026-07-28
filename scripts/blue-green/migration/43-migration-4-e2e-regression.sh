#!/usr/bin/env bash
# ST-7.6.3: E2E 全量回归 — W6-6 所有 E2E 跑 staging
set -euo pipefail

E2E_DIR="metaplatform-frontend/tests/e2e"
STAGING_BASE="${STAGING_BASE:-http://localhost:5173}"

echo "==> W6-6 E2E 全量回归（针对 staging）"
echo "  Base URL: $STAGING_BASE"

cd "$E2E_DIR/.." || exit 1

# 9 apps × ≥5 case = 至少 45 E2E
E2E_BASE_URL="$STAGING_BASE" pnpm exec playwright test \
    --reporter=list \
    --workers=2 \
    --retries=2 \
    --timeout=30000 \
    2>&1 | tee /tmp/e2e-staging.log

# 验证
if grep -q "passed\|failed" /tmp/e2e-staging.log; then
    PASSED=$(grep -oE "[0-9]+ passed" /tmp/e2e-staging.log | head -1 | awk '{print $1}')
    FAILED=$(grep -oE "[0-9]+ failed" /tmp/e2e-staging.log | head -1 | awk '{print $1}')
    echo "==> E2E 回归: ${PASSED:-0} passed / ${FAILED:-0} failed"
    if [ "${FAILED:-0}" -gt 0 ]; then
        echo "==> 有 E2E 失败！回滚"
        bash scripts/blue-green/05-weight-switch.sh tech-agent 0
        bash scripts/blue-green/05-weight-switch.sh app-kb 0
        exit 1
    fi
fi

echo "==> E2E 全量回归通过"