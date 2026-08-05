from pathlib import Path

import yaml

WORKSPACE=Path(__file__).parents[3]

def test_openapi_workflow_has_required_gates() -> None:
 workflow=yaml.safe_load((WORKSPACE/".github/workflows/openapi-ci.yml").read_text(encoding="utf-8"))
 jobs=workflow["jobs"]
 assert {"lint-and-bundle","traceability","runtime-parity","breaking-change"} <= set(jobs)
 text=(WORKSPACE/".github/workflows/openapi-ci.yml").read_text(encoding="utf-8")
 for command in ("npm ci","npm run check","git diff --exit-code","validate_contracts.py","validate_traceability.py","runtime_openapi.py","compare_runtime.py","pytest contracts/tests","oasdiff"):
  assert command in text
 assert "continue-on-error: true" not in text

def test_python_ci_uses_correct_pyright_workdir() -> None:
 text=(WORKSPACE/".github/workflows/python-ci.yml").read_text(encoding="utf-8")
 assert "uv run pyright mate-platform-backend/" not in text
 assert "uv run pyright" in text
