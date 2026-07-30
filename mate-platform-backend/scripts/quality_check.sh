#!/usr/bin/env bash
# ARCH-CORE-01 quality gate. Runs ruff, pyright, architecture tests and the
# import-linter contract check. The script exits non-zero on any failure.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${BACKEND_DIR}"

PY=".venv/Scripts/python.exe"
if [[ ! -x "${PY}" ]]; then
    PY="python"
fi

echo "[quality] ruff check"
"${PY}" -m ruff check \
    packages/mate-kernel packages/mate-platform packages/mate-clients \
    tests/architecture scripts/architecture_check.py scripts/tests \
    scripts/arch_template.py

echo "[quality] pyright (kernel + platform + clients + tests + scripts)"
"${PY}" -m pyright \
    packages/mate-kernel packages/mate-platform packages/mate-clients \
    tests/architecture scripts/architecture_check.py scripts/arch_template.py

echo "[quality] pytest tests/architecture"
"${PY}" -m pytest tests/architecture -q

echo "[quality] architecture_check.py"
"${PY}" scripts/architecture_check.py
