"""Real oasdiff regression tests; run explicitly with OASDIFF_BIN set.

These tests require the reviewed commits in local Git history and the pinned
1.33.0 executable. Missing prerequisites fail rather than skip.
"""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[4]
SCRIPT = ROOT / "mate-platform-backend/contracts/scripts/check_mp11_oasdiff.py"
MANIFEST = ROOT / "mate-platform-backend/contracts/openapi/oasdiff-mp11-diagnostics-review.yaml"
ARTIFACT = "mate-platform-backend/contracts/openapi/generated/bundled.yaml"
BASE_COMMIT = "303d3ca69cbe0d4f817cf2f4ca3294c8c9f0b7e5"
REVISION_COMMIT = "a2d0aa8695ebf2fd67aa8c6ddcf3e703a8a32c98"
WINDOWS_TOOL_SHA = "f450465c0f4bd35ec49ba35b436820730843c5b21b5499e618963803bd8da919"
LEGACY_SHA = "661058b35062d8fea8f9f2828db708cd14f40a5d39b08ff0a560d7722230f2af"


@pytest.fixture(scope="module")
def reviewed_pair(tmp_path_factory):
    directory = tmp_path_factory.mktemp("mp11-oasdiff-fixed-pair")
    paths = {}
    git = shutil.which("git")
    assert git is not None
    for label, commit in (("base", BASE_COMMIT), ("revision", REVISION_COMMIT)):
        result = subprocess.run(
            [git, "show", f"{commit}:{ARTIFACT}"],
            cwd=ROOT,
            capture_output=True,
            check=True,
        )
        path = directory / f"{label}.yaml"
        path.write_bytes(result.stdout)
        paths[label] = path
    tool_value = os.environ.get("OASDIFF_BIN")
    assert tool_value, "Set OASDIFF_BIN to the independently verified oasdiff 1.33.0 binary."
    paths["tool"] = Path(tool_value).resolve(strict=True)
    paths["tool_sha"] = os.environ.get("OASDIFF_SHA256", WINDOWS_TOOL_SHA)
    assert hashlib.sha256(paths["tool"].read_bytes()).hexdigest() == paths["tool_sha"]
    paths["manifest"] = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    return paths


def approved_copy(reviewed_pair):
    manifest = copy.deepcopy(reviewed_pair["manifest"])
    for row in manifest["diagnostics"]:
        if row["severity"] == "ERR":
            row["reviewDecision"] = "approved"
            row["ignoreEnabled"] = True
    return manifest


def run_checker(tmp_path, reviewed_pair, manifest, *, revision=None, extra_args=()):
    review_path = tmp_path / "review.yaml"
    review_path.write_text(yaml.safe_dump(manifest, sort_keys=False), encoding="utf-8")
    report_path = tmp_path / "report.json"
    command = [
        sys.executable,
        "-B",
        str(SCRIPT),
        "--base",
        str(reviewed_pair["base"]),
        "--revision",
        str(revision or reviewed_pair["revision"]),
        "--manifest",
        str(review_path),
        "--repo-root",
        str(ROOT),
        "--oasdiff",
        str(reviewed_pair["tool"]),
        "--oasdiff-sha256",
        reviewed_pair["tool_sha"],
        "--report",
        str(report_path),
        *extra_args,
    ]
    env = {
        **os.environ,
        "PYTHONUTF8": "1",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    result = subprocess.run(
        command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=60, check=False
    )
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    return result, report


def first_error(manifest):
    return next(row for row in manifest["diagnostics"] if row["severity"] == "ERR")


def test_pending_review_cannot_suppress_the_real_270_errors(tmp_path, reviewed_pair):
    result, report = run_checker(tmp_path, reviewed_pair, reviewed_pair["manifest"])
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "pending-review"
    assert report["rawErrors"] == 270
    assert report["toolRuns"] == 1


def test_explicit_approval_reruns_real_oasdiff_and_preserves_all_warnings(tmp_path, reviewed_pair):
    result, report = run_checker(tmp_path, reviewed_pair, approved_copy(reviewed_pair))
    assert result.returncode == 0, result.stderr
    assert report["rawExitCode"] == 1
    assert report["reviewedExitCode"] == 0
    assert report["ignoredReviewedErrors"] == 270
    assert report["remainingErrors"] == 0
    assert report["remainingWarnings"] == 37
    assert report["toolRuns"] == 2
    assert report["legacyApprovalSha256"] == LEGACY_SHA


def test_an_unrelated_new_breaking_operation_stays_blocked(tmp_path, reviewed_pair):
    revision_doc = yaml.safe_load(reviewed_pair["revision"].read_text(encoding="utf-8"))
    del revision_doc["paths"]["/api/v1/ont/v2/object-types"]["get"]
    revision = tmp_path / "new-breaking-revision.yaml"
    revision.write_text(yaml.safe_dump(revision_doc, sort_keys=False), encoding="utf-8")
    result, report = run_checker(
        tmp_path, reviewed_pair, approved_copy(reviewed_pair), revision=revision
    )
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "unknown-diagnostic"
    assert report["rawErrors"] > 270
    assert report["toolRuns"] == 1


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("method", "PATCH"),
        ("basePath", "/api/v1/apphub/not-reviewed"),
        ("id", "response-property-type-changed"),
        ("fingerprint", "000000000000"),
        ("exactDiagnostic", "GET /api/v1/apphub/apps unrelated error"),
        ("operationId", "notTheReviewedOperation"),
    ],
)
def test_exact_matching_rejects_a_changed_diagnostic_field(tmp_path, reviewed_pair, field, value):
    manifest = approved_copy(reviewed_pair)
    first_error(manifest)[field] = value
    result, report = run_checker(tmp_path, reviewed_pair, manifest)
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "unknown-diagnostic"
    assert report["toolRuns"] == 1


def test_a_single_disabled_error_keeps_the_gate_closed(tmp_path, reviewed_pair):
    manifest = approved_copy(reviewed_pair)
    first_error(manifest)["ignoreEnabled"] = False
    result, report = run_checker(tmp_path, reviewed_pair, manifest)
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "pending-review"
    assert report["toolRuns"] == 1


@pytest.mark.parametrize("side", ["baseline", "revision"])
def test_whole_bundle_hash_drift_cannot_use_an_approved_list(tmp_path, reviewed_pair, side):
    manifest = approved_copy(reviewed_pair)
    manifest[side]["semanticSha256"] = "0" * 64
    result, report = run_checker(tmp_path, reviewed_pair, manifest)
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "bundle-hash-drift"
    assert report["toolRuns"] == 1


@pytest.mark.parametrize(
    "field", ["baselineOperationSemanticSha256", "revisionOperationSemanticSha256"]
)
def test_each_operation_hash_is_checked_independently(tmp_path, reviewed_pair, field):
    manifest = approved_copy(reviewed_pair)
    first_error(manifest)[field] = "0" * 64
    result, report = run_checker(tmp_path, reviewed_pair, manifest)
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "operation-hash-drift"
    assert report["toolRuns"] == 1


def test_warning_operation_identity_cannot_reuse_an_error_hash(tmp_path, reviewed_pair):
    manifest = approved_copy(reviewed_pair)
    manifest["diagnostics"].sort(key=lambda row: row["severity"] != "ERR")
    warning = next(row for row in manifest["diagnostics"] if row["severity"] == "WARN")
    warning["operationId"] = "notTheReviewedOperation"
    result, report = run_checker(tmp_path, reviewed_pair, manifest)
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "operation-hash-drift"
    assert report["toolRuns"] == 1


@pytest.mark.parametrize("side", ["baseline", "revision"])
def test_source_ast_evidence_drift_cannot_use_an_approved_list(tmp_path, reviewed_pair, side):
    manifest = approved_copy(reviewed_pair)
    manifest["evidenceGroups"]["C-ERROR-ENVELOPE"]["sourceEvidence"][0][side]["astSha256"] = (
        "0" * 64
    )
    result, report = run_checker(tmp_path, reviewed_pair, manifest)
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "source-hash-drift"
    assert report["toolRuns"] == 1


def test_the_original_eight_approval_lines_cannot_be_extended(tmp_path, reviewed_pair):
    legacy = tmp_path / "expanded-legacy.txt"
    original = ROOT / reviewed_pair["manifest"]["legacyApproval"]["file"]
    legacy.write_text(
        original.read_text(encoding="utf-8") + "GET /new removed an endpoint\n",
        encoding="utf-8",
    )
    result, report = run_checker(
        tmp_path,
        reviewed_pair,
        approved_copy(reviewed_pair),
        extra_args=("--legacy-ignore", str(legacy)),
    )
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "legacy-approval-drift"
    assert report["toolRuns"] == 0


def test_wrong_binary_pin_prevents_any_tool_execution(tmp_path, reviewed_pair):
    result, report = run_checker(
        tmp_path,
        reviewed_pair,
        approved_copy(reviewed_pair),
        extra_args=("--oasdiff-sha256", "0" * 64),
    )
    assert result.returncode == 1, result.stderr
    assert report["failure"] == "tool-pin-mismatch"
    assert report["toolRuns"] == 0


def test_zero_error_future_comparison_does_not_apply_the_stale_audit(tmp_path, reviewed_pair):
    revision_doc = yaml.safe_load(reviewed_pair["base"].read_text(encoding="utf-8"))
    revision_doc["info"]["description"] = "A future documentation-only revision"
    revision = tmp_path / "future.yaml"
    revision.write_text(yaml.safe_dump(revision_doc, sort_keys=False), encoding="utf-8")
    result, report = run_checker(tmp_path, reviewed_pair, None, revision=revision)
    assert result.returncode == 0, result.stderr
    assert report["rawErrors"] == 0
    assert report["auditApplied"] is False
    assert report["toolRuns"] == 1


def test_local_oasdiff_configuration_cannot_expand_the_exact_approvals(
    tmp_path, reviewed_pair, monkeypatch
):
    config = tmp_path / ".oasdiff.yaml"
    config.write_text("fail-on: [\n", encoding="utf-8")
    monkeypatch.setenv("OASDIFF_CONFIG", str(config))
    result, report = run_checker(tmp_path, reviewed_pair, approved_copy(reviewed_pair))
    assert result.returncode == 0, result.stderr
    assert report["remainingWarnings"] == 37
    assert report["toolRuns"] == 2


@pytest.fixture(scope="module")
def checker():
    spec = importlib.util.spec_from_file_location("mp11_oasdiff_review", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_business_property_named_summary_stays_in_the_semantic_hash(checker):
    before = {"properties": {"summary": {"type": "string"}}}
    after = {"properties": {"summary": {"type": "integer"}}}
    assert checker.semantic_sha(checker.normalize(before)) != checker.semantic_sha(
        checker.normalize(after)
    )


def test_anyof_cannot_erase_a_sibling_type_constraint(checker):
    schema = {"type": "string", "anyOf": [{"type": "string"}, {"type": "integer"}]}
    assert checker.normalize(schema) == {
        "type": "string",
        "anyOf": [{"type": "string"}, {"type": "integer"}],
    }


def test_nullable_spelling_keeps_validation_constraints_pinned(checker):
    union = {"type": ["null", "string"], "maxLength": 64}
    branches = {"anyOf": [{"type": "string"}, {"type": "null"}], "maxLength": 64}
    changed = {"type": ["null", "string"], "maxLength": 65}
    assert checker.semantic_sha(checker.normalize(union)) == checker.semantic_sha(
        checker.normalize(branches)
    )
    assert checker.semantic_sha(checker.normalize(union)) != checker.semantic_sha(
        checker.normalize(changed)
    )


def test_duplicate_spec_keys_fail_instead_of_replacing_an_operation(tmp_path, checker):
    path = tmp_path / "duplicate.yaml"
    path.write_text("paths:\n  /example: {get: {}}\n  /example: {delete: {}}\n", encoding="utf-8")
    with pytest.raises(checker.ReviewFailure) as failure:
        checker.read_yaml(path)
    assert failure.value.reason == "duplicate-yaml-key"
