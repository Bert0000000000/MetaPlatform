"""D1 — staging smoke static guards (v3.2-α W3).

Mirrors the G4 pattern (``test_g4_kind_workflow.py``): the actual
staging-cluster run executes via ``scripts/ci/d1_staging_smoke.sh``
on a runner with kind + helm; this module is the *pure static* guard
that proves the script + the staging values file exist and are
shaped correctly.

The check is intentionally lightweight so it runs on every CI
machine (Linux / macOS / Windows) without a real cluster.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

from conftest import REPO_ROOT

SMOKE_SCRIPT_PATH = REPO_ROOT / "scripts" / "ci" / "d1_staging_smoke.sh"
VALUES_STAGING_PATH = REPO_ROOT / "infra" / "helm" / "values-staging.yaml"


class TestD1StagingSmokeScript:
    def test_smoke_script_exists(self) -> None:
        assert SMOKE_SCRIPT_PATH.is_file(), f"missing script: {SMOKE_SCRIPT_PATH}"

    def test_smoke_script_has_shebang(self) -> None:
        first = SMOKE_SCRIPT_PATH.read_text(encoding="utf-8").splitlines()[0]
        assert first.startswith("#!"), "script must start with a shebang"

    def test_smoke_script_executable(self) -> None:
        if sys.platform.startswith("win"):
            pytest.skip("executable bit not meaningful on Windows checkout")
        assert os.access(SMOKE_SCRIPT_PATH, os.X_OK), (
            f"{SMOKE_SCRIPT_PATH} is not executable; "
            "run: git update-index --chmod=+x scripts/ci/d1_staging_smoke.sh"
        )

    def test_smoke_script_runs_helm_install(self) -> None:
        body = SMOKE_SCRIPT_PATH.read_text(encoding="utf-8")
        assert "helm install" in body, "smoke must install the umbrella chart"
        assert "values-staging.yaml" in body, "smoke must use staging values"

    def test_smoke_script_waits_for_lineage_stack(self) -> None:
        body = SMOKE_SCRIPT_PATH.read_text(encoding="utf-8")
        for component in ("debezium", "marquez", "datahub", "ge"):
            assert component in body, f"smoke must wait for {component} pod"

    def test_smoke_script_uses_kind(self) -> None:
        body = SMOKE_SCRIPT_PATH.read_text(encoding="utf-8")
        assert "kind create cluster" in body, "smoke must create a kind cluster"
        assert "kind delete cluster" in body, "smoke must clean up the cluster"

    def test_smoke_script_pins_tenant_id(self) -> None:
        body = SMOKE_SCRIPT_PATH.read_text(encoding="utf-8")
        assert "TENANT_ID" in body, "smoke must pin a tenant_id for assertions"
        assert "data_staging_t1" in body, "smoke must use staging tenant default"

    def test_smoke_script_has_lineage_assertions(self) -> None:
        body = SMOKE_SCRIPT_PATH.read_text(encoding="utf-8")
        assert "expect-events" in body or "expect_datasets" in body or (
            "events" in body and "datasets" in body
        ), "smoke must run lineage assertions"


class TestD1StagingValues:
    def test_values_staging_file_exists(self) -> None:
        assert VALUES_STAGING_PATH.is_file(), (
            f"missing values-staging: {VALUES_STAGING_PATH}"
        )

    def test_values_staging_uses_independent_storage(self) -> None:
        body = VALUES_STAGING_PATH.read_text(encoding="utf-8")
        # Staging must use isolated storage (ADR-0015 §5):
        # prefixed bucket / database / topic names so dev data does
        # not bleed into staging.
        assert "stg" in body.lower(), (
            "values-staging must use an isolated storage prefix"
        )