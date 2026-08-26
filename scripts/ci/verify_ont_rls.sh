#!/usr/bin/env bash
# Provision and execute the real PostgreSQL tenant-isolation acceptance suite.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DSN="${PG_DSN:-postgresql://mate_ont_test:mate_ont_test@localhost:5432/metaplatform_ont_test}"

export PG_DSN="$TEST_DSN"

cd "$ROOT_DIR"
uv run --directory mate-platform-backend python ../scripts/ci/prepare_ont_rls_test_db.py
uv run --directory mate-platform-backend \
  pytest packages/mate-tech-ont/tests/security/test_tenant_isolation_hard.py -q
