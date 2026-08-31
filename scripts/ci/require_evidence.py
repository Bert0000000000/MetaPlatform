"""Pre-commit hook for ADR-0015 rule 10.

The Program Board is a Markdown document with several table shapes.  The
evidence cell is the source of truth: a display name or a commit hash is not a
stable evidence reference.  This checker deliberately stays dependency-free
so it can run from a pre-commit hook on Windows and CI alike.
"""
from __future__ import annotations

import re
from pathlib import Path

ACCEPTED_MARKER = re.compile(r"\baccepted\b", re.IGNORECASE)
REPO = Path(__file__).resolve().parents[2]
PROGRAM_BOARD = REPO / "docs" / "active" / "delivery" / "PROGRAM-BOARD.md"
EVIDENCE = Path("docs/active/delivery/evidence")
BRACE = re.compile(r"\{([^{}]+)\}")
REFERENCE_TOKEN = re.compile(
    r"\[[^\]]*\]\((?P<link>[^)]+)\)"
    r"|(?P<path>(?:docs/|evidence/)[A-Za-z0-9._~+{},\-/.]+\.md)"
)


def _table_cells(line: str) -> list[str] | None:
    stripped = line.strip()
    if not (stripped.startswith("|") and "|" in stripped[1:]):
        return None
    body = stripped[1:]
    if body.endswith("|"):
        body = body[:-1]
    return [cell.strip() for cell in body.split("|")]


def _is_separator(line: str) -> bool:
    cells = _table_cells(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def _expand_reference(reference: str) -> list[str]:
    """Expand shell-free ``{a,b}`` and numeric ``{start..end}`` forms."""

    match = BRACE.search(reference)
    if match is None:
        return [reference]
    contents = match.group(1)
    if re.fullmatch(r"-?\d+\.\.-?\d+", contents):
        start_text, end_text = contents.split("..", 1)
        start, end = int(start_text), int(end_text)
        step = 1 if end >= start else -1
        choices = [str(value) for value in range(start, end + step, step)]
    else:
        choices = [choice.strip() for choice in contents.split(",") if choice.strip()]
    if not choices:
        return [reference]
    expanded: list[str] = []
    for choice in choices:
        expanded.extend(
            _expand_reference(
                reference[: match.start()] + choice + reference[match.end() :]
            )
        )
    return expanded


def parse_evidence_references(cell: str) -> tuple[str, ...]:
    """Return normalized repository-relative evidence paths from one cell."""

    candidates: list[str] = []
    for token in REFERENCE_TOKEN.finditer(cell):
        candidate = token.group("link") or token.group("path")
        if candidate is not None:
            candidates.append(candidate.split("#", 1)[0].split("?", 1)[0])

    references: list[str] = []
    for raw_candidate in candidates:
        candidate = raw_candidate.strip().replace("\\", "/")
        if not candidate or candidate.startswith("/") or ".." in Path(candidate).parts:
            continue
        if not (candidate.startswith("docs/") or candidate.startswith("evidence/")):
            continue
        for expanded in _expand_reference(candidate):
            if expanded not in references:
                references.append(expanded)
    return tuple(references)


def _resolve_evidence(reference: str, repo_root: Path) -> Path:
    if reference.startswith("evidence/"):
        return repo_root / EVIDENCE / reference.removeprefix("evidence/")
    return repo_root / reference


def _accepted_table_rows(board_text: str):
    lines = board_text.splitlines()
    line_number = 0
    while line_number + 1 < len(lines):
        header = _table_cells(lines[line_number])
        if header is None or not _is_separator(lines[line_number + 1]):
            line_number += 1
            continue
        status_columns = [
            index
            for index, name in enumerate(header)
            if "状态" in name or "status" in name.lower()
        ]
        evidence_columns = [
            index
            for index, name in enumerate(header)
            if "证据" in name or "evidence" in name.lower()
        ]
        row_number = line_number + 2
        while row_number < len(lines):
            row = _table_cells(lines[row_number])
            if row is None:
                break
            if status_columns and any(
                index < len(row) and ACCEPTED_MARKER.search(row[index])
                for index in status_columns
            ):
                yield row_number + 1, row, evidence_columns
            row_number += 1
        line_number = row_number


def check_program_board(board_text: str, repo_root: Path = REPO) -> list[str]:
    """Return ASCII-only violations for accepted rows in a Program Board."""

    violations: list[str] = []
    for line_number, cells, evidence_columns in _accepted_table_rows(board_text):
        if not evidence_columns:
            violations.append(
                f"L{line_number}: Accepted row has no evidence column"
            )
            continue
        references: list[str] = []
        for index in evidence_columns:
            if index < len(cells):
                references.extend(parse_evidence_references(cells[index]))
        if not references:
            violations.append(
                f"L{line_number}: Accepted row has no repository evidence reference"
            )
            continue
        missing: list[str] = []
        empty: list[str] = []
        for reference in references:
            path = _resolve_evidence(reference, repo_root)
            if not path.is_file():
                missing.append(reference)
            elif not path.read_text(encoding="utf-8").strip():
                empty.append(reference)
        if missing:
            violations.append(
                f"L{line_number}: missing evidence: {', '.join(missing)}"
            )
        if empty:
            violations.append(f"L{line_number}: empty evidence: {', '.join(empty)}")
    return violations


def main() -> int:
    if not PROGRAM_BOARD.exists():
        return 0
    bad = check_program_board(PROGRAM_BOARD.read_text(encoding="utf-8"), REPO)

    if bad:
        print("require_evidence: rule 10 violation(s):")
        for b in bad:
            print(b)
        print(
            "\nReason: every Accepted table row must reference a non-empty "
            "repository evidence file in its evidence cell. See ADR-0015 rule 10."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
