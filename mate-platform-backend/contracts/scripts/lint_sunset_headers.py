"""Sunset header lint for ``contracts/openapi/services/ont.yaml``.

GOVERN-03 (2026-08-07): every v1 ontology endpoint must carry:

* ``x-sunset: 2026-12-31``
* ``x-migration-target: /api/v1/ont/v2/<...>``

This script is wired into the ``openapi-ci`` workflow (``lint-sunset-headers``)
and exits non-zero on any missing or stale annotation.
"""
from __future__ import annotations

import argparse
import datetime
import sys
from pathlib import Path

import yaml

# Accept both ``"2026-12-31"`` (string) and ``2026-12-31`` (yaml parses
# into ``datetime.date``) — both forms are valid OpenAPI scalars.
DEFAULT_SUNSET = "2026-12-31"


def _is_sunset_match(value: object) -> bool:
    if isinstance(value, datetime.date):
        return value.isoformat() == DEFAULT_SUNSET
    return isinstance(value, str) and value == DEFAULT_SUNSET

# v2 replacement targets per v1 prefix. Keep in sync with
# ``docs/active/delivery/evidence/MP-ONT-V1-SUNSET-NOTICE.md``.
V1_TO_V2: dict[str, str] = {
    "/api/v1/ont": "/api/v1/ont/v2/object-types",  # classes/relations
    "/api/v1/ont/instances": "/api/v1/ont/v2/individuals",
    "/api/v1/ont/sparql": "/api/v1/ont/v2/object-sets:evaluate",
    "/api/v1/ont/explain": "/api/v1/ont/v2/object-sets:evaluate",
    "/api/v1/ont/versions": "/api/v1/ont/v2/versions",
    "/api/v1/ont/inference": "/api/v1/ont/v2/object-sets:evaluate",
    "/api/v1/ont/shacl": "/api/v1/ont/v2/axioms",
    "/api/v1/ont/federation": "/api/v1/ont/v2/object-sets:evaluate",
}

# v2 paths are the supported ones and must NOT carry sunset headers.
V2_PREFIXES = ("/api/v1/ont/v2/",)


def _v2_target(v1_prefix: str) -> str | None:
    return V1_TO_V2.get(v1_prefix)


def _is_v2(path: str) -> bool:
    return any(path.startswith(p) for p in V2_PREFIXES)


def _resolve_v2_target(path: str) -> str | None:
    """Match the longest v1 prefix in :data:``V1_TO_V2``.

    Ensures ``/api/v1/ont/sparql`` resolves to the sparql target rather
    than the generic ``/api/v1/ont`` (classes/relations) target.
    """
    candidates = [p for p in V1_TO_V2 if path == p or path.startswith(p + "/")]
    if not candidates:
        return None
    return V1_TO_V2[max(candidates, key=len)]


def lint(path: Path) -> int:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    paths = raw.get("paths", {}) if isinstance(raw, dict) else {}

    errors: list[str] = []

    for route, ops in paths.items():
        if _is_v2(route):
            # v2 endpoints must NOT carry sunset headers.
            for method, op in (ops or {}).items():
                if not isinstance(op, dict):
                    continue
                if "x-sunset" in op or "x-migration-target" in op:
                    errors.append(
                        f"{method.upper()} {route}: v2 endpoint must not carry sunset headers"
                    )
            continue

        # Determine v1 prefix → v2 target (longest match wins).
        target = _resolve_v2_target(route)
        if target is None:
            # Outside the v1 ontology surface; nothing to lint.
            continue

        for method, op in (ops or {}).items():
            if not isinstance(op, dict):
                continue
            sunset = op.get("x-sunset")
            mig = op.get("x-migration-target")
            if not _is_sunset_match(sunset):
                errors.append(
                    f"{method.upper()} {route}: x-sunset={sunset!r} != {DEFAULT_SUNSET!r}"
                )
            if target is not None and not (isinstance(mig, str) and mig.startswith(target)):
                errors.append(
                    f"{method.upper()} {route}: x-migration-target={mig!r} "
                    f"does not start with v2 target {target!r}"
                )

    if errors:
        print(f"Sunset lint FAILED for {path}", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print(f"Sunset lint OK for {path}: {len(paths)} paths checked")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--contract",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "openapi" / "services" / "ont.yaml",
        help="Path to ont.yaml (default: contracts/openapi/services/ont.yaml)",
    )
    args = p.parse_args()
    return lint(args.contract)


if __name__ == "__main__":
    raise SystemExit(main())
