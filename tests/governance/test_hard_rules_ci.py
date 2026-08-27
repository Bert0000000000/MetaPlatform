"""GOVERN-10 — 13 硬规则 × CI workflow 对位矩阵机检。

枚举每条硬规则的期望触发 job 与 workflow，校验：
1. ``HARD-RULES-MATRIX.md`` 行数 ≥ 13
2. ga-acceptance.yml 含全部 ``ga-NNN-*`` job 名（按 GOVERN-10 拆 job 后）
3. 5 个 forbid_* / require_evidence 脚本存在
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATRIX = REPO / "docs" / "active" / "governance" / "HARD-RULES-MATRIX.md"
GA_WF = REPO / ".github" / "workflows" / "ga-acceptance.yml"

REQUIRED_GA_JOBS = {
    "ga-001-openapi",
    "ga-002-requirement-ids",
    "ga-003-tenant",
    "ga-004-acl",
    "ga-005-fallback",
    "ga-006-static",
    "ga-007-skip-tests",
    "ga-008-helm",
    "ga-009-observability",
    "ga-010-evidence",
    "ga-011-helm-docs",
    "ga-012-secret-scan",
    "ga-013-networkpolicy",
}


def test_matrix_doc_exists() -> None:
    assert MATRIX.is_file(), f"missing matrix doc at {MATRIX}"


def test_matrix_doc_has_at_least_13_rule_rows() -> None:
    content = MATRIX.read_text(encoding="utf-8")
    rule_rows = [
        line
        for line in content.splitlines()
        if line.startswith("| ")
        and "硬规则" not in line
        and ("✅" in line or "🟡" in line or "⏳" in line or "🔧" in line)
    ]
    assert len(rule_rows) >= 13, (
        f"matrix has {len(rule_rows)} rows, expected ≥ 13"
    )


def test_ga_workflow_has_all_required_jobs() -> None:
    content = GA_WF.read_text(encoding="utf-8")
    job_lines: set[str] = set()
    for line in content.splitlines():
        stripped = line.lstrip()
        if not stripped.startswith("ga-"):
            continue
        if ":" not in stripped:
            continue
        head = stripped.split(":", 1)[0].strip()
        job_lines.add(head)
    missing = REQUIRED_GA_JOBS - job_lines
    assert not missing, f"ga-acceptance.yml missing jobs: {missing}"


def test_forbid_and_evidence_scripts_exist() -> None:
    for script in [
        "forbid_raw_sql.py",
        "forbid_bare_httpx.py",
        "forbid_legacy_fallback.py",
        "forbid_skip_tests.py",
        "require_evidence.py",
        "validate_requirement_coverage.py",
    ]:
        assert (REPO / "scripts" / "ci" / script).is_file(), (
            f"{script} missing"
        )


def test_requirement_coverage_job_uses_canonical_manifest() -> None:
    content = GA_WF.read_text(encoding="utf-8")

    assert "ga-002-requirement-ids" in content
    assert "validate_requirement_coverage.py" in content
    assert "17 service contracts" not in content


def test_networkpolicy_job_runs_inventory_and_rendered_coverage_guard() -> None:
    content = GA_WF.read_text(encoding="utf-8")

    assert "ga-013-networkpolicy" in content
    assert "values-$env.yaml" in content
    assert "validate_networkpolicy_coverage.py" in content
    assert "applicationServices" in content or "--rendered" in content
    assert (REPO / "scripts" / "ci" / "validate_networkpolicy_coverage.py").is_file()


def test_ga_jobs_count_is_at_least_13() -> None:
    content = GA_WF.read_text(encoding="utf-8")
    job_count = 0
    for line in content.splitlines():
        stripped = line.lstrip()
        if not stripped.startswith("ga-"):
            continue
        if ":" not in stripped:
            continue
        head = stripped.split(":", 1)[0].strip()
        if head.startswith("ga-"):
            job_count += 1
    assert job_count >= 13, f"found {job_count} ga-* jobs, expected ≥ 13"
