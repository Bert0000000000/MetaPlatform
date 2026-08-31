"""Regression tests for the GA-002 canonical service inventory gate."""
from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "ci" / "validate_requirement_coverage.py"


def _load_script():
    spec = importlib.util.spec_from_file_location("validate_requirement_coverage", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_current_manifest_covers_all_service_contracts() -> None:
    module = _load_script()
    errors = module.validate(
        REPO / "mate-platform-backend/contracts/openapi/manifest.yaml",
        REPO / "mate-platform-backend/contracts/openapi/services",
    )
    assert errors == []
    assert len(module.manifest_contracts(REPO / "mate-platform-backend/contracts/openapi/manifest.yaml")) == 21


def test_missing_requirement_id_is_reported(tmp_path: Path) -> None:
    module = _load_script()
    manifest = tmp_path / "manifest.yaml"
    services = tmp_path / "services"
    services.mkdir()
    manifest.write_text("version: 1\n    contract: services/example.yaml\n", encoding="utf-8")
    (services / "example.yaml").write_text("openapi: 3.1.0\npaths: {}\n", encoding="utf-8")

    errors = module.validate(manifest, services)

    assert errors == [
        "services/example.yaml has no requirement ID metadata"
    ]
