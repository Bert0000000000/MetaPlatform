"""Self-tests for ``contracts/scripts/lint_sunset_headers.py``.

GOVERN-03 / 03-05: the lint script must flag every v1 ontology endpoint
that is missing the sunset annotations, and must not flag v2 endpoints
that are free of sunset headers.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parents[4] / "contracts" / "scripts" / "lint_sunset_headers.py"
_spec = importlib.util.spec_from_file_location("lint_sunset_headers", _SCRIPT)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
sys.modules["lint_sunset_headers"] = _mod
_spec.loader.exec_module(_mod)


GOOD_YAML = """
openapi: 3.1.0
info: {title: t, version: 1.0.0}
paths:
  /healthz:
    get:
      operationId: ontGetHealthz
  /api/v1/ont/sparql:
    post:
      operationId: ontPostSparql
      x-sunset: 2026-12-31
      x-migration-target: "/api/v1/ont/v2/object-sets:evaluate"
  /api/v1/ont/v2/object-sets:evaluate:
    post:
      operationId: ontPostV2ObjectSetEvaluate
"""

BAD_YAML = """
openapi: 3.1.0
info: {title: t, version: 1.0.0}
paths:
  /api/v1/ont/sparql:
    post:
      operationId: ontPostSparql
"""

V2_BAD_YAML = """
openapi: 3.1.0
info: {title: t, version: 1.0.0}
paths:
  /api/v1/ont/v2/object-sets:evaluate:
    post:
      operationId: ontPostV2ObjectSetEvaluate
      x-sunset: 2026-12-31
"""


def _lint_text(yaml_text: str) -> int:
    """Run the lint helper against an in-memory yaml string."""
    import tempfile

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".yaml", delete=False, encoding="utf-8"
    ) as fh:
        fh.write(yaml_text)
        path = Path(fh.name)
    try:
        return _mod.lint(path)
    finally:
        path.unlink(missing_ok=True)


def test_lint_passes_when_all_v1_endpoints_annotated() -> None:
    assert _lint_text(GOOD_YAML) == 0


def test_lint_fails_when_v1_endpoint_missing_sunset() -> None:
    assert _lint_text(BAD_YAML) != 0


def test_lint_fails_when_v2_endpoint_has_sunset() -> None:
    assert _lint_text(V2_BAD_YAML) != 0


def test_is_sunset_match_accepts_string_and_date() -> None:
    import datetime

    assert _mod._is_sunset_match("2026-12-31") is True
    assert _mod._is_sunset_match(datetime.date(2026, 12, 31)) is True
    assert _mod._is_sunset_match("2027-01-01") is False
    assert _mod._is_sunset_match(None) is False


def test_ont_yaml_contract_passes() -> None:
    """The actual ont.yaml in the repo must satisfy the lint."""
    contract = (
        Path(__file__).resolve().parents[4]
        / "contracts"
        / "openapi"
        / "services"
        / "ont.yaml"
    )
    if not contract.exists():
        pytest.skip("ont.yaml not found (tests likely run from a partial checkout)")
    assert _mod.lint(contract) == 0