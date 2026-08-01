"""G4 — real K8s kind e2e workflow static guards.

G4 is the last of the 13 hard rules that required a real cluster run.
The actual kind cluster e2e executes on the GitHub Actions Linux runner
(``.github/workflows/g4-kind-e2e.yml``); locally it can be replayed with
``scripts/ci/g4_kind_smoke.sh`` when the developer has kind installed.

This module is a **pure static** smoke: it proves the CI workflow and
the manual script exist, are wired with the expected helm install +
pod-readiness + NetworkPolicy default-deny steps, and that the script is
executable. It runs without kind / helm / kubectl so it is safe in CI
and on developer machines.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import yaml

from conftest import REPO_ROOT

WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "g4-kind-e2e.yml"
SMOKE_SCRIPT_PATH = REPO_ROOT / "scripts" / "ci" / "g4_kind_smoke.sh"


def _load_workflow() -> dict:
    with WORKFLOW_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


class TestG4KindWorkflow:
    def test_kind_workflow_exists(self) -> None:
        assert WORKFLOW_PATH.is_file(), f"missing CI workflow: {WORKFLOW_PATH}"

    def test_kind_workflow_name(self) -> None:
        wf = _load_workflow()
        assert wf.get("name") == "g4-kind-e2e"

    def test_kind_workflow_has_helm_install_step(self) -> None:
        wf = _load_workflow()
        steps = _flatten_step_names(wf)
        joined = "\n".join(steps).lower()
        assert "helm install" in joined, "workflow must run a helm install step"
        assert "values-local.yaml" in joined, "helm install must use local values"

    def test_kind_workflow_has_smoke_step(self) -> None:
        wf = _load_workflow()
        steps = _flatten_step_names(wf)
        joined = "\n".join(steps).lower()
        # pod readiness wait
        assert "condition=ready" in joined, "workflow must wait for pod Ready"
        assert "app.kubernetes.io/name=keycloak" in joined, "must wait on keycloak pod"
        assert "app.kubernetes.io/name=otel-collector" in joined, (
            "must wait on otel-collector pod"
        )
        # NetworkPolicy default-deny check
        assert "networkpolicy" in joined, "workflow must verify NetworkPolicy"
        assert "default-deny" in joined, "workflow must check default-deny NetworkPolicy"

    def test_kind_workflow_uses_kind_action(self) -> None:
        wf = _load_workflow()
        uses = [
            str(step.get("uses", "")).lower()
            for job in wf.get("jobs", {}).values()
            for step in job.get("steps", [])
            if step.get("uses")
        ]
        assert any("kind-action" in u for u in uses), "workflow must use helm/kind-action"

    def test_kind_workflow_has_cleanup(self) -> None:
        wf = _load_workflow()
        steps = _flatten_step_names(wf)
        joined = "\n".join(steps).lower()
        assert "helm uninstall" in joined, "workflow must uninstall on cleanup"


class TestG4SmokeScript:
    def test_kind_smoke_script_exists(self) -> None:
        assert SMOKE_SCRIPT_PATH.is_file(), f"missing script: {SMOKE_SCRIPT_PATH}"

    def test_kind_smoke_script_has_shebang(self) -> None:
        first = SMOKE_SCRIPT_PATH.read_text(encoding="utf-8").splitlines()[0]
        assert first.startswith("#!"), "script must start with a shebang"

    def test_kind_smoke_script_executable(self) -> None:
        # On POSIX the executable bit must be set (git tracks mode 100755).
        # On Windows the unix execute-permission concept does not apply; the
        # CI Linux runner enforces the real check once git materialises 0755.
        if sys.platform.startswith("win"):
            pytest.skip("executable bit not meaningful on Windows checkout")
        assert os.access(SMOKE_SCRIPT_PATH, os.X_OK), (
            f"{SMOKE_SCRIPT_PATH} is not executable; "
            "run: git update-index --chmod=+x scripts/ci/g4_kind_smoke.sh"
        )


# --- helpers -----------------------------------------------------------------

def _flatten_step_names(workflow: dict) -> list[str]:
    """Return the list of step descriptors across all jobs.

    Each step contributes its ``name``, its ``uses`` action and the full
    body of its ``run`` script so assertions can match on command text.
    """
    names: list[str] = []
    for job in workflow.get("jobs", {}).values():
        for step in job.get("steps", []):
            if step.get("name"):
                names.append(str(step["name"]))
            if step.get("uses"):
                names.append(str(step["uses"]))
            if step.get("run"):
                names.append(str(step["run"]))
    return names
