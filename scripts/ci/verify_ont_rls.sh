#!/usr/bin/env bash
# Provision and execute the real PostgreSQL tenant-isolation acceptance suite.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DSN="${PG_DSN:?Set PG_DSN to the dedicated RLS test database}"
PYTHON="${ONT_TEST_PYTHON:-$ROOT_DIR/mate-platform-backend/.venv/bin/python}"

export PG_DSN="$TEST_DSN"

cd "$ROOT_DIR"
"$PYTHON" scripts/ci/prepare_ont_rls_test_db.py
"$PYTHON" scripts/ci/verify_ont_postgres.py --rls --junit .ci/ont-rls.xml
