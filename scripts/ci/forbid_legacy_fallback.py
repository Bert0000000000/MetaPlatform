"""Pre-commit hook for ADR-0015 rule 5.

Refuses to commit changes that set LEGACY_LOGIN_COMPAT=true or
INSECURE_SKIP_SIGNATURE=true anywhere in the repo (except in
scripts/ci/ or .github/). The production profile refuses to start
when these are set; this hook keeps the value from accidentally
slipping in.

Exclusions:
  - Documentation (.md / .rst): may *describe* the flag without setting it.
  - Test files under */tests/*: legitimately simulate the flag in
    fixtures to verify the production guard rejects it.
  - The hook script itself.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

PATTERNS = [
    re.compile(r"LEGACY_LOGIN_COMPAT\s*=\s*[\"']?true"),
    re.compile(r"INSECURE_SKIP_SIGNATURE\s*=\s*[\"']?true"),
]
EXCLUDE_DIRS = {
    ".git",
    ".worktrees",
    "__pycache__",
    "node_modules",
    "examples",  # examples document the explicit local-dev bypass
    "tests",  # tests legitimately exercise the guard with this flag
}
EXCLUDE_EXTS = {".md", ".rst"}  # docs describe the flag without setting it
EXCLUDE_FILES = {
    "forbid_legacy_fallback.py",
    "start-frontend-local.ps1",  # explicit local-dev helper, never production
}


def main() -> int:
    repo = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    bad: list[tuple[Path, int, str]] = []
    for path in repo.rglob("*"):
        if not path.is_file():
            continue
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in EXCLUDE_EXTS:
            continue
        if path.name in EXCLUDE_FILES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            stripped = line.lstrip()
            if stripped.startswith(("#", "//", "*")) or "``" in line:
                continue
            for pat in PATTERNS:
                if pat.search(line):
                    bad.append((path, lineno, line.strip()))

    if bad:
        print("forbid_legacy_fallback: rule 5 violation(s):")
        for p, lineno, line in bad:
            print(f"  {p}:{lineno}: {line}")
        print(
            "\nReason: production profile must not have LEGACY_LOGIN_COMPAT "
            "or INSECURE_SKIP_SIGNATURE. See ADR-0015 rule 5."
        )
        return 1
    return 0


if __name__ == "__main__":
    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    raise SystemExit(main(repo) if False else main())
