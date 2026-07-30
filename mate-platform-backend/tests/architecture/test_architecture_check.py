"""Architecture check CLI smoke test."""
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def _lint_imports_available() -> bool:
    return shutil.which("lint-imports") is not None or shutil.which("lint_imports") is not None


def test_architecture_check_returns_zero() -> None:
    if not _lint_imports_available():
        pytest.skip("lint-imports is not installed in this environment")
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "architecture_check.py")],
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
