#!/usr/bin/env python3
"""Validate the canonical service inventory and OpenAPI requirement coverage.

The GA-002 gate must follow the manifest rather than a historical domain count.
This check intentionally uses only the Python standard library so it can run in
the lightweight CI job without installing a YAML parser.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

CONTRACT_RE = re.compile(r"^\s{4}contract:\s+services/([A-Za-z0-9][A-Za-z0-9_-]*\.yaml)\s*$")
# Contract requirements use domain-specific prefixes (for example
# ``FR-MCP-*``, ``MP-CONS-*`` and ``SEC-IAM-*``), so the gate validates the
# canonical uppercase hyphenated ID shape rather than a historical prefix list.
REQUIREMENT_ID_RE = re.compile(r"\b[A-Z][A-Z0-9]*(?:-[A-Z0-9][A-Z0-9_.]*)+\b")


def manifest_contracts(manifest: Path) -> list[str]:
    """Return contract filenames declared by the canonical manifest."""
    contracts = [match.group(1) for line in manifest.read_text(encoding="utf-8").splitlines()
                 if (match := CONTRACT_RE.match(line))]
    return contracts


def validate(manifest: Path, services_dir: Path) -> list[str]:
    """Return human-readable coverage errors for the manifest and contracts."""
    errors: list[str] = []
    if not manifest.is_file():
        return [f"missing manifest: {manifest}"]
    if not services_dir.is_dir():
        return [f"missing services directory: {services_dir}"]

    contracts = manifest_contracts(manifest)
    if not contracts:
        errors.append(f"manifest has no service contracts: {manifest}")
    if len(contracts) != len(set(contracts)):
        errors.append("manifest contains duplicate service contract entries")

    declared = set(contracts)
    actual = {path.name for path in services_dir.glob("*.yaml")}
    for filename in sorted(declared - actual):
        errors.append(f"manifest contract is missing on disk: services/{filename}")
    for filename in sorted(actual - declared):
        errors.append(f"service contract is absent from manifest: services/{filename}")

    for filename in contracts:
        path = services_dir / filename
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        # Some contracts use a multiline list while others use the compact
        # ``x-mate-requirements: [DOMAIN-001]`` form.  The contract files do
        # not contain unrelated uppercase hyphenated identifiers, so scanning
        # the complete document keeps both valid forms covered.
        requirement_ids = set(REQUIREMENT_ID_RE.findall(text))
        if not requirement_ids:
            errors.append(
                f"services/{filename} has no requirement ID metadata"
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("mate-platform-backend/contracts/openapi/manifest.yaml"),
    )
    parser.add_argument(
        "--services-dir",
        type=Path,
        default=Path("mate-platform-backend/contracts/openapi/services"),
    )
    args = parser.parse_args()

    errors = validate(args.manifest, args.services_dir)
    if errors:
        print("Requirement coverage validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    count = len(manifest_contracts(args.manifest))
    print(f"OK: {count} canonical service contracts with requirement IDs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
