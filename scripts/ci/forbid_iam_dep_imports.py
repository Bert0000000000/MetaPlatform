"""Pre-commit hook for ADR-0011 / GOVERN-02 (2026-08-07).

Forbids production code from importing the deprecated ``mate_tech_iam``
package. The new IAM lives in ``mate-auth-service`` (port 8101) and the
internal ACL layer in ``mate-platform.auth`` / ``mate-clients.security``.

Allowed escape hatches:
  * ``acceptance/ARCHIVE`` — historical smoke scripts pinned to v2.5
  * ``scripts/ci/forbid_iam_dep_imports.py`` — this file (self-reference)
  * ``**/DEPRECATED.md`` — deprecation notices

Exit code 0  ⇒ clean.
Exit code 1 ⇒ at least one offender printed with relative path.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Match either form of the legacy IAM import.
PATTERN = re.compile(r"(?m)^(?:from\s+mate_tech_iam\s+import|import\s+mate_tech_iam)\b")

# Directories excluded from the scan. ``acceptance/ARCHIVE`` is reserved for
# v2.5 Spring Boot smoke evidence; future GOvERN-07 cleanup removes those.
EXCLUDE_DIR_PARTS = {
    "acceptance/ARCHIVE",
    "docs/archive",
    ".git",
    ".pytest_cache",
    "node_modules",
    "dist",
    "build",
    ".venv",
    "__pycache__",
}

# File path substrings excluded from scanning.
EXCLUDE_FILE_PARTS = (
    "scripts/ci/forbid_iam_dep_imports.py",
    "DEPRECATED.md",
)

# File extensions to scan.
SCAN_EXTS = {".py", ".toml", ".cfg", ".ini"}


def _is_excluded(path: Path) -> bool:
    s = path.as_posix()
    for part in EXCLUDE_DIR_PARTS:
        if part in s:
            return True
    for part in EXCLUDE_FILE_PARTS:
        if part in s:
            return True
    return False


def scan(root: Path) -> list[str]:
    offenders: list[str] = []
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix not in SCAN_EXTS:
            continue
        if _is_excluded(p.relative_to(root)):
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if PATTERN.search(text):
            offenders.append(p.relative_to(root).as_posix())
    return offenders


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    offenders = scan(root)
    if not offenders:
        return 0
    print("mate_tech_iam is DEPRECATED (GOVERN-02 / ADR-0011).", file=sys.stderr)
    print("Migrate to mate-auth-service:8101 + mate-platform.auth.", file=sys.stderr)
    print("Offenders:", file=sys.stderr)
    for o in offenders:
        print(f"  {o}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
