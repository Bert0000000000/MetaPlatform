"""Pre-commit hook for ADR-0015 rule 7.

Refuses pytest.skip() / @pytest.mark.xfail() / @pytest.mark.skip()
in tests/. The rule is "contract or integration tests skipped does
not count as Accepted"; the hook keeps that discipline enforced.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


PATTERNS = [
    re.compile(r"pytest\.skip\s*\("),
    re.compile(r"@pytest\.mark\.skip"),
    re.compile(r"@pytest\.mark\.skipif"),
    re.compile(r"@pytest\.mark\.xfail"),
    re.compile(r"@pytest\.mark\.skip\s"),
]
EXCLUDE_DIRS = {"__pycache__"}


def main() -> int:
    files = [Path(p) for p in sys.argv[1:]]
    bad: list[tuple[Path, int, str]] = []
    for f in files:
        if not f.is_file() or not f.name.startswith("test_"):
            continue
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            for pat in PATTERNS:
                if pat.search(line):
                    bad.append((f, lineno, line.strip()))

    if bad:
        print("forbid_skip_tests: rule 7 violation(s):")
        for f, lineno, line in bad:
            print(f"  {f}:{lineno}: {line}")
        print(
            "\nReason: pytest.skip / xfail are not allowed in tests/ per "
            "ADR-0015 rule 7. If a test cannot run, fix the precondition "
            "or remove the test. See ADR-0015 rule 7."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())