"""Pre-commit hook for GOVERN-07 (2026-08-07).

Forbids Spring-Boot-era artefacts that should no longer appear at the
repository root or in ``acceptance/scripts`` / ``acceptance/logs``:

  * ``acceptance/scripts/e2e_smoke.ps1`` (Spring smoke, hardcodes 8101/8201/8210)
  * ``acceptance/logs/TECH-*.log`` (Spring boot logs, 9 services)
  * ``start-{dashboard-dev,swagger,tech-services}.ps1`` at the repo root
  * ``build-all-7.bat`` at the repo root
  * ``Dockerfile.agent`` / ``Dockerfile.app-kb`` (replaced by the unified
    multi-stage build in ``mate-platform-backend/Dockerfile``)
  * bare ``services/{agent,rag}/`` directories (without a README pointer
    to the corresponding ``packages/mate-tech-*`` package)

Allowed escape hatches:

  * Anything under ``acceptance/scripts/_archive_spring_2026-07-27/``
  * Anything under ``acceptance/logs/_archive_spring_2026-07-27/``
  * Anything under ``scripts/_archive/build-scripts-2026-08-07/``
  * ``services/agent/README.md`` and ``services/rag/README.md`` themselves

Exit code 0 ⇒ clean. Exit code 1 ⇒ at least one offender printed.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Each entry: (must_not_exist_relative_to_repo, why)
FORBIDDEN_PATHS = [
    ("acceptance/scripts/e2e_smoke.ps1", "Spring smoke script"),
    ("start-dashboard-dev.ps1", "Spring-era start script"),
    ("start-swagger.ps1", "Spring-era start script"),
    ("start-tech-services.ps1", "Spring-era start script"),
    ("build-all-7.bat", "Spring-era build script"),
    ("mate-platform-backend/Dockerfile.agent", "Replaced by unified Dockerfile"),
    ("mate-platform-backend/Dockerfile.app-kb", "Replaced by unified Dockerfile"),
]

# Directories where the listed names are allowed (escape hatches).
ALLOWED_PARENT_PARTS = (
    "acceptance/scripts/_archive_spring_2026-07-27",
    "acceptance/logs/_archive_spring_2026-07-27",
    "scripts/_archive/build-scripts-2026-08-07",
    "docs/archive/acceptance-2026-07-27-spring",
)

# Glob patterns for things that must not exist at all (or only under archive).
FORBIDDEN_GLOBS = [
    ("acceptance/logs/TECH-*.log", "Spring-era service log"),
]


def _is_archived(path: Path) -> bool:
    s = path.as_posix()
    return any(part in s for part in ALLOWED_PARENT_PARTS)


def collect_offenders() -> list[tuple[str, str]]:
    offenders: list[tuple[str, str]] = []
    for rel, why in FORBIDDEN_PATHS:
        p = REPO_ROOT / rel
        if not p.exists():
            continue
        if _is_archived(p):
            continue
        offenders.append((rel, why))
    for pattern, why in FORBIDDEN_GLOBS:
        for p in REPO_ROOT.glob(pattern):
            if _is_archived(p.relative_to(REPO_ROOT)):
                continue
            offenders.append((p.relative_to(REPO_ROOT).as_posix(), why))
    return offenders


def main() -> int:
    offenders = collect_offenders()
    if not offenders:
        return 0
    print("GOVERN-07: Spring-era artefacts must be moved to _archive/.", file=sys.stderr)
    print("Offenders:", file=sys.stderr)
    for path, why in offenders:
        print(f"  {path}  ({why})", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
