"""OWL v1 → KERNEL-01 v2 迁移脚本测试。"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from mate_kernel.ontology.migrate_v1_v2 import migrate, parse_ntriples


FIXTURE = Path(__file__).parent / "fixtures" / "owl_sample.nt"
SRC_ROOT = Path(__file__).resolve().parents[1] / "src"


def test_parse_ntriples_counts() -> None:
    triples = parse_ntriples(FIXTURE.read_text(encoding="utf-8"))
    assert len(triples) >= 10


def test_migrate_produces_v2_records() -> None:
    triples = parse_ntriples(FIXTURE.read_text(encoding="utf-8"))
    out = migrate(triples)
    assert "object_type" in out
    assert "property" in out
    assert "link_type" in out
    assert "axiom" in out
    # Order + Customer = 2 object_types
    assert len(out["object_type"]) == 2
    # 3 datatype properties
    assert len(out["property"]) == 3
    # hasCustomer
    assert len(out["link_type"]) == 1
    # transitive axiom (relatedTo)
    assert any(
        ax["kind"] == "transitivity" for ax in out["axiom"]
    )


def test_object_types_have_pk() -> None:
    triples = parse_ntriples(FIXTURE.read_text(encoding="utf-8"))
    out = migrate(triples)
    for ot in out["object_type"]:
        assert ot["primary_key"], f"{ot['rid']} missing pk"


def test_link_type_has_src_dst() -> None:
    triples = parse_ntriples(FIXTURE.read_text(encoding="utf-8"))
    out = migrate(triples)
    for lt in out["link_type"]:
        assert lt["src"].startswith("ont.legacy.obj.")
        assert lt["dst"].startswith("ont.legacy.obj.")


def test_cli_invocation(tmp_path: Path) -> None:
    """整段 CLI 跑通——确认可作为独立脚本用。"""
    out = tmp_path / "v2.json"
    env = {**os.environ, "PYTHONPATH": str(SRC_ROOT)}
    result = subprocess.run(
        [sys.executable, "-m", "mate_kernel.ontology.migrate_v1_v2",
         str(FIXTURE), str(out)],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert "object_type" in payload
    assert "migrated" in result.stdout