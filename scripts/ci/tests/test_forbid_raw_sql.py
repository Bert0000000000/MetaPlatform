"""Unit tests for scripts/ci/forbid_raw_sql.py (G2 rule 3 guard)."""
from __future__ import annotations

import tempfile
from pathlib import Path

import forbid_raw_sql as frs  # type: ignore[import-not-found]
from forbid_raw_sql import check_file, check_line  # type: ignore[import-not-found]


# --------------------------------------------------------------------------- #
# check_line: detection of every raw-SQL entry point
# --------------------------------------------------------------------------- #
def test_forbid_raw_sql_detects_session_execute_text() -> None:
    hits = check_line('rows = session.execute(text("SELECT * FROM users"))')
    assert "session.execute(text(...))" in hits


def test_forbid_raw_sql_detects_exec_driver_sql() -> None:
    hits = check_line('session.exec_driver_sql("SELECT 1")')
    assert "session.exec_driver_sql(...)" in hits


def test_forbid_raw_sql_detects_engine_execute() -> None:
    hits = check_line('engine.execute("SELECT * FROM orders")')
    assert "engine.execute(...)" in hits


def test_forbid_raw_sql_detects_bind_execute() -> None:
    hits = check_line('session.bind.execute("DELETE FROM audit_log")')
    assert "session.bind.execute(...)" in hits


def test_forbid_raw_sql_detects_bare_text_in_src() -> None:
    # A src/ file (not under tests/) constructing a raw text() clause.
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "src" / "app" / "repo.py"
        f.parent.mkdir(parents=True)
        f.write_text('stmt = text("SELECT * FROM users")\n', encoding="utf-8")
        violations = check_file(f)
    assert violations, "bare text(...) in src/ must be flagged"
    matched = [desc for _, _, descs in violations for desc in descs]
    assert frs.BARE_TEXT_DESC in matched


# --------------------------------------------------------------------------- #
# check_line / check_file: allow-lists
# --------------------------------------------------------------------------- #
def test_forbid_raw_sql_allows_orm_select() -> None:
    hits = check_line("stmt = select(User).where(User.tenant_id == tenant_id)")
    assert hits == []


def test_forbid_raw_sql_allows_tests_dir() -> None:
    # Under tests/ a bare text(...) is legitimate (fixture setup).
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "tests" / "test_repo.py"
        f.parent.mkdir(parents=True)
        f.write_text('stmt = text("SELECT * FROM users")\n', encoding="utf-8")
        assert check_file(f) == []


def test_forbid_raw_sql_excludes_comments() -> None:
    # Both a full-line and a trailing comment must be ignored.
    assert check_line('# session.execute(text("SELECT * FROM users"))') == []
    assert check_line('x = 1  # session.execute(text("SELECT 1"))') == []
