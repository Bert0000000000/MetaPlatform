"""EXP-04 —— 治理/展示元数据（G16）：description / status / type_group / render_hints。

覆盖：dataclass 校验（status 枚举）、InMemory + PG round-trip、LinkType.description。
"""
from __future__ import annotations

import os
import sys

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "exp04"
OBJ = f"ont.{T}.obj.meta.annotated.v1"
P = f"ont.{T}.prop.meta-name.v1"


def _ot(**kw) -> ObjectType:
    base = {
        "rid": ClassRef(OBJ),
        "primary_key": (ClassRef(P),),
        "properties": (
            Property(rid=ClassRef(P), type_id="string", nullable=False,
                     primary_key=True, title="name", format=PropertyFormat.STRING),
        ),
        "display_name": "annotated",
    }
    base.update(kw)
    return ObjectType(**base)


class TestMetadata:
    def test_status_enum_validation(self) -> None:
        with pytest.raises(ValueError, match="status"):
            _ot(status="bogus")

    def test_inmemory_roundtrip(self) -> None:
        r = InMemoryOntologyRepository()
        ot = _ot(
            description="带注释的类型",
            status="draft",
            type_group="core",
            render_hints=(("icon", "hexagon"), ("color", "#60a5fa")),
        )
        r.upsert_object_type(ot)
        got = r.get_object_type(ClassRef(OBJ))
        assert got.description == "带注释的类型"
        assert got.status == "draft"
        assert got.type_group == "core"
        assert got.render_hints == (("icon", "hexagon"), ("color", "#60a5fa"))

    def test_defaults_backward_compatible(self) -> None:
        r = InMemoryOntologyRepository()
        r.upsert_object_type(_ot())
        got = r.get_object_type(ClassRef(OBJ))
        assert got.status == "active"
        assert got.description == ""
        assert got.render_hints == ()


PG_DSN = os.environ.get(
    "EXP04_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgSameSemantics:
    def test_pg_roundtrip(self) -> None:
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        try:
            with r.tenant_scope(T):
                r.upsert_object_type(_ot(
                    description="pg annotated",
                    status="deprecated",
                    type_group="legacy",
                    render_hints=(("unit", "CNY"),),
                ))
                got = r.get_object_type(ClassRef(OBJ))
                assert got.description == "pg annotated"
                assert got.status == "deprecated"
                assert got.type_group == "legacy"
                assert got.render_hints == (("unit", "CNY"),)
        finally:
            import psycopg2

            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ont_object_type WHERE tenant_id=%s", (T,))
                cur.execute(
                    "DELETE FROM ont_axiom WHERE tenant_id=%s", (T,))
            conn.commit()
            conn.close()
