"""Pre-commit hook for ADR-0015 rule 3.

Forbids `session.execute(text("..."))` in app-* sources. The
SQLAlchemy event listener in mate-platform.tenancy.db_filter only
fires for ORM-constructed statements; raw text() bypasses it and
silently skips the tenant_id predicate. This hook keeps that
path closed.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


PATTERN = re.compile(r"""\bsession\.execute\s*\(\s*text\s*\(""")
EXCLUDE_DIRS = {"tests", "__pycache__"}


def main() -> int:
    files = [Path(p) for p in sys.argv[1:]]
    bad: list[tuple[Path, int, str]] = []
    for f in files:
        if not f.is_file():
            continue
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if PATTERN.search(line):
                bad.append((f, lineno, line.strip()))

    if bad:
        print("forbid_raw_sql: rule 3 violation(s):")
        for f, lineno, line in bad:
            print(f"  {f}:{lineno}: {line}")
        print(
            "\nReason: session.execute(text(...)) bypasses the SQLAlchemy "
            "tenant-id event listener (mate-platform.tenancy.db_filter).\n"
            "Use the ORM select()/update()/delete() or run raw SQL through "
            "the listener-aware helpers. See ADR-0015 rule 3."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())