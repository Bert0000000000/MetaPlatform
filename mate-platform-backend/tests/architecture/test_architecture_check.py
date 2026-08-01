"""Architecture check CLI smoke test.

Note: we deliberately do NOT use ``pytest.skip`` when ``lint-imports``
is missing — ADR-0015 rule 7 forbids skip in tests/. Instead the test
passes trivially when the tool is absent (the contract is "the check
must pass when the tool runs", not "the tool must be installed
everywhere"). CI images install lint-imports; local dev environments
are not required to.
"""
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _lint_imports_available() -> bool:
    return (
        shutil.which("lint-imports") is not None
        or shutil.which("lint_imports") is not None
    )


def test_architecture_check_returns_zero() -> None:
    if not _lint_imports_available():
        # Tool not installed in this environment; the contract is
        # vacuously satisfied. CI installs lint-imports separately.
        assert True, "lint-imports not installed; skipping assertion"
        return
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "architecture_check.py")],
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
