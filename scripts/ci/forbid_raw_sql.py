"""Pre-commit hook for ADR-0015 rule 3.

Forbids raw-SQL entry points in app-* / mate-platform sources. The
SQLAlchemy tenant-id event listener (``mate-platform.tenancy.db_filter``)
only fires for ORM-constructed statements; every pattern below bypasses
it and silently skips the ``tenant_id`` predicate. This hook keeps all
those paths closed.

Detected patterns (G2 hardening, 2026-08-01):

1. ``session.execute(text("..."))``     - the original bypass
2. ``session.exec_driver_sql(...)``     - raw driver-level SQL
3. ``engine.execute(...)``              - deprecated legacy raw execute
4. ``session.bind.execute(...)``        - reaches the engine directly
5. bare ``text("...")`` in ``src/``     - constructing a raw SQL clause
                                         (allowed under ``tests/``)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


# Each entry: (description, compiled regex).
PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("session.execute(text(...))", re.compile(r"\bsession\.execute\s*\(\s*text\s*\(")),
    ("session.exec_driver_sql(...)", re.compile(r"\bsession\.exec_driver_sql\s*\(")),
    ("engine.execute(...)", re.compile(r"\bengine\.execute\s*\(")),
    ("session.bind.execute(...)", re.compile(r"\bsession\.bind\.execute\s*\(")),
    # Bare text("...") construction. The negative look-behind avoids
    # matching ``context.text(`` / ``subtext(`` while still catching a
    # standalone ``text("SELECT ...")`` (the char before ``text`` is
    # then ``(`` / whitespace, not a word char or dot).
    ("bare text('...') in src/", re.compile(r"(?<![\w.])text\s*\(\s*['\"]")),
]

BARE_TEXT_DESC = "bare text('...') in src/"

# Modules that structurally require raw SQL / only reference it in
# documentation, and are therefore exempt from the rule-3 guard. This
# mirrors the EXCLUDE_FILES approach in forbid_bare_httpx.py:
#   db_filter.py    - the tenant-id enforcement module; its module
#                     docstring describes the forbidden pattern and its
#                     code uses ORM Table objects (no text() execution).
#   migrations.py   - DDL bootstrap runner; migrations inherently issue
#                     raw DDL that the ORM cannot express.
#   pg.py           - DB connectivity client; health() runs a constant
#                     "SELECT 1" ping (no tenant-scoped table access).
#   db.py           - legacy health probe (db_health SELECT 1); lives in
#                     the deprecated mate-tech-iam package.
EXCLUDE_FILES = {"db_filter.py", "migrations.py", "pg.py", "db.py"}


def strip_comment(line: str) -> str:
    """Strip a trailing ``#`` comment.

    Naive w.r.t. ``#`` inside string literals; sufficient for a
    pre-commit guard whose goal is to avoid flagging commented-out code.
    """
    in_single = False
    in_double = False
    for i, ch in enumerate(line):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            return line[:i]
    return line


def is_test_file(path: Path) -> bool:
    """True if the file lives under a ``tests/`` tree or is a test module."""
    parts = {p.lower() for p in path.parts}
    if "tests" in parts:
        return True
    return path.name.startswith("test_") or path.name == "conftest.py"


def check_line(line: str, *, is_test: bool = False) -> list[str]:
    """Return the matched pattern descriptions for a single line.

    ``is_test`` disables the bare-``text()`` rule (tests legitimately
    build raw SQL fixtures); the four session/engine patterns still fire.
    """
    code = strip_comment(line)
    hits: list[str] = []
    for desc, pat in PATTERNS:
        if desc == BARE_TEXT_DESC and is_test:
            continue
        if pat.search(code):
            hits.append(desc)
    return hits


def check_file(path: Path) -> list[tuple[int, str, list[str]]]:
    """Return ``(lineno, raw_line, descriptions)`` for every violating line."""
    if not path.is_file() or path.name in EXCLUDE_FILES:
        return []
    is_test = is_test_file(path)
    out: list[tuple[int, str, list[str]]] = []
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []
    for lineno, line in enumerate(content.splitlines(), start=1):
        hits = check_line(line, is_test=is_test)
        if hits:
            out.append((lineno, line.strip(), hits))
    return out


def main() -> int:
    files = [Path(p) for p in sys.argv[1:]]
    bad: list[tuple[Path, int, str, str]] = []
    for f in files:
        for lineno, line, hits in check_file(f):
            bad.append((f, lineno, line, "; ".join(hits)))

    if bad:
        print("forbid_raw_sql: rule 3 violation(s):")
        for f, lineno, line, why in bad:
            print(f"  {f}:{lineno}: {why}")
            print(f"      {line}")
        print(
            "\nReason: raw-SQL entry points bypass the SQLAlchemy "
            "tenant-id event listener (mate-platform.tenancy.db_filter) "
            "and silently skip the tenant_id predicate.\n"
            "Use ORM select()/update()/delete() or the listener-aware "
            "helpers. See ADR-0015 rule 3."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
