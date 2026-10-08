"""The two required migration cases cannot disappear or skip silently."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "verify_migration_browser.py"


@pytest.mark.parametrize(
    "cases",
    [
        "",
        '<testcase classname="ontology-migration-plan.spec.ts" name="flow"><skipped/></testcase>',
        '<testcase classname="other.spec.ts" name="one"/><testcase classname="other.spec.ts" name="two"/>',
    ],
)
def test_invalid_browser_evidence_is_rejected(tmp_path, cases):
    report = tmp_path / "result.xml"
    report.write_text(f"<testsuites><testsuite>{cases}</testsuite></testsuites>")
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--junit", str(report)], capture_output=True, text=True
    )
    assert "Migration browser gate FAILED" in result.stderr
    assert result.returncode == 1


def test_both_real_browser_cases_are_accepted(tmp_path):
    report = tmp_path / "result.xml"
    report.write_text(
        '<testsuites><testsuite><testcase classname="ontology-migration-plan.spec.ts" name="flow"/><testcase classname="ontology-migration-plan.spec.ts" name="nokey"/></testsuite></testsuites>'
    )
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--junit", str(report)], capture_output=True, text=True
    )
    assert result.returncode == 0
    assert "2 executed, 0 skipped" in result.stdout


def test_missing_cases_in_playwright_execution_list_are_rejected(tmp_path):
    listing = tmp_path / "list.json"
    listing.write_text(json.dumps({"suites": []}))
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--list", str(listing)], capture_output=True, text=True
    )
    assert "Migration browser gate FAILED" in result.stderr
    assert result.returncode == 1
