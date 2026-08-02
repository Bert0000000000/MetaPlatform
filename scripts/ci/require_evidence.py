"""Pre-commit hook for ADR-0015 rule 10.

When PROGRAM-BOARD.md changes, ensure that any batch moved to
'Accepted' has a corresponding docs/active/delivery/evidence/<BATCH>-ACCEPTANCE.md
file in the same commit (or earlier).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


ACCEPTED_MARKER = re.compile(r"\*\*Accepted\*\*")
EVIDENCE = Path("docs/active/delivery/evidence")


def main() -> int:
    pb = Path("docs/active/delivery/PROGRAM-BOARD.md")
    if not pb.exists():
        return 0
    text = pb.read_text(encoding="utf-8")
    bad: list[str] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        if "**Accepted**" in line:
            # Look at the same line for the batch name (first `|` cell).
            cells = [c.strip() for c in line.split("|") if c.strip()]
            if not cells:
                continue
            batch_name = cells[0].replace("**", "").strip()
            # Map common batch names to evidence file.
            evidence = EVIDENCE / f"{batch_name}-ACCEPTANCE.md"
            if not evidence.exists():
                bad.append(
                    f"  L{lineno}: '{batch_name}' is Accepted but no "
                    f"{evidence} found"
                )

    if bad:
        print("require_evidence: rule 10 violation(s):")
        for b in bad:
            print(b)
        print(
            "\nReason: PROGRAM-BOARD says Accepted; an evidence file at "
            "docs/active/delivery/evidence/<BATCH>-ACCEPTANCE.md must "
            "exist. See ADR-0015 rule 10."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())