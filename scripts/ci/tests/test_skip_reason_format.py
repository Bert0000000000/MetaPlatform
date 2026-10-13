import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize(
    "source,expected",
    [
        ('import pytest\npytest.skip("PG unavailable: missing isolated fixture")\n', 0),
        ('import pytest\npytest.skip(\n    "PG unavailable: missing isolated fixture"\n)\n', 0),
        (
            'import pytest\n@pytest.mark.skipif(True, reason="broken assertion")\ndef test_case(): pass\n',
            1,
        ),
        (
            'import pytest\n@pytest.mark.xfail(reason="temporary failure")\ndef test_case(): pass\n',
            1,
        ),
    ],
)
def test_skip_guard_checks_whole_reason_without_ignoring_failures(tmp_path, source, expected):
    target = tmp_path / "test_fixture.py"
    target.write_text(source, encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/ci/forbid_skip_tests.py"), str(target)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == expected, result.stdout + result.stderr
