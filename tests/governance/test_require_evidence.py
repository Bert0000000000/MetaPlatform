"""Regression tests for the Hard Rule #10 Program Board guard."""
from __future__ import annotations

from pathlib import Path

from scripts.ci.require_evidence import (
    check_program_board,
    parse_evidence_references,
)


def test_parse_evidence_references_supports_code_links_and_multiple_paths() -> None:
    cell = (
        "`evidence/ONE-ACCEPTANCE.md` + "
        "[second](evidence/TWO-ACCEPTANCE.md)"
    )

    assert parse_evidence_references(cell) == (
        "evidence/ONE-ACCEPTANCE.md",
        "evidence/TWO-ACCEPTANCE.md",
    )


def test_parse_evidence_references_expands_brace_lists_and_ranges() -> None:
    cell = "evidence/M{1,2}-ACCEPTANCE.md + evidence/D{0..2}-ACCEPTANCE.md"

    assert parse_evidence_references(cell) == (
        "evidence/M1-ACCEPTANCE.md",
        "evidence/M2-ACCEPTANCE.md",
        "evidence/D0-ACCEPTANCE.md",
        "evidence/D1-ACCEPTANCE.md",
        "evidence/D2-ACCEPTANCE.md",
    )


def test_check_uses_explicit_evidence_cell_not_batch_name(tmp_path: Path) -> None:
    evidence = tmp_path / "docs" / "active" / "delivery" / "evidence"
    evidence.mkdir(parents=True)
    (evidence / "ORDER-ACCEPTANCE.md").write_text(
        "# Order\n\nConclusion: Accepted\n", encoding="utf-8"
    )
    board = """\
| Batch | Status | Evidence |
|---|---|---|
| **different display name** | **Accepted** | `evidence/ORDER-ACCEPTANCE.md` |
"""

    assert check_program_board(board, tmp_path) == []


def test_check_rejects_missing_evidence_and_missing_evidence_column(
    tmp_path: Path,
) -> None:
    board = """\
| Batch | Status | Evidence |
|---|---|---|
| missing-file | Accepted | `evidence/MISSING.md` |

| Batch | Status |
|---|---|
| no-evidence-column | Accepted |
"""

    violations = check_program_board(board, tmp_path)

    assert len(violations) == 2
    assert "MISSING.md" in violations[0]
    assert "no evidence column" in violations[1]
