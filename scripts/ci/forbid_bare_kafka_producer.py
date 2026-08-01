"""Pre-commit hook for ADR-0015 rule 4 (Kafka ACL enforcement).

Forbids directly constructing ``kafka.KafkaProducer`` (or importing it)
in business code. Producers must go through ``mate-clients.kafka`` so
the SEC-IAM-01 / SEC-TENANT-01 ACL (Bearer + X-Tenant-Id +
tenant-scoped topic naming per ``messaging.kafka_tenant``) is applied
uniformly.

Excluded locations:
  - ``mate-clients/`` (the ACL client itself)
  - ``tests/`` (fixtures may construct producers directly)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("KafkaProducer(...)", re.compile(r"\bKafkaProducer\s*\(")),
    (
        "from kafka import KafkaProducer",
        re.compile(r"\bfrom\s+kafka\s+import.*\bKafkaProducer\b"),
    ),
]

# Path segments that mark a location where a bare producer is legitimate.
EXCLUDE_PARTS = {"tests", "__pycache__", "mate-clients", "mate_clients"}


def is_excluded(path: Path) -> bool:
    parts = {p.lower() for p in path.parts}
    if parts & EXCLUDE_PARTS:
        return True
    return path.name.startswith("test_")


def check_line(line: str) -> list[str]:
    return [desc for desc, pat in PATTERNS if pat.search(line)]


def check_file(path: Path) -> list[tuple[int, str, list[str]]]:
    if not path.is_file() or is_excluded(path):
        return []
    out: list[tuple[int, str, list[str]]] = []
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []
    for lineno, line in enumerate(content.splitlines(), start=1):
        hits = check_line(line)
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
        print("forbid_bare_kafka_producer: rule 4 violation(s):")
        for f, lineno, line, why in bad:
            print(f"  {f}:{lineno}: {why}")
            print(f"      {line}")
        print(
            "\nReason: a bare kafka.KafkaProducer bypasses the SEC-IAM-01 "
            "+ SEC-TENANT-01 ACL (Bearer + X-Tenant-Id + tenant-scoped "
            "topic). Use the mate_clients.kafka producer helpers. "
            "See ADR-0015 rule 4."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
