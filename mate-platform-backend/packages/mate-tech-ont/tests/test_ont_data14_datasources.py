"""DATA-14/15 —— 数据平面绑定：backing datasource 同步 / MDO 合并 / materialization。

真库门控：源表建在 metaplatform_ont 同库（ONT_SOURCE_DSN 指向它），
声明 → sync → Individual 落库 → materialization 行集回流。
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

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402

T = "data14"
PG_DSN = os.environ.get(
    "DATA14_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)
OBJ = f"ont.{T}.obj.crm.customer.v1"
P_ID = f"ont.{T}.prop.cid.v1"
P_NAME = f"ont.{T}.prop.cname.v1"
P_CITY = f"ont.{T}.prop.ccity.v1"
SRC1 = f"src_{T}_crm"
SRC2 = f"src_{T}_erp"


@pytest.fixture(scope="module")
def repo():
    pytest.importorskip("psycopg2")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    try:
        r._ensure_schema()
    except Exception as e:
        pytest.skip(f"PG unavailable: {e}")
    os.environ["ONT_SOURCE_DSN"] = PG_DSN
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {SRC1}")
        cur.execute(f"DROP TABLE IF EXISTS {SRC2}")
        cur.execute(f"CREATE TABLE {SRC1} (cid TEXT PRIMARY KEY, cname TEXT)")
        cur.execute(f"CREATE TABLE {SRC2} (cid TEXT PRIMARY KEY, cname TEXT, ccity TEXT)")
        cur.execute(f"INSERT INTO {SRC1} (cid, cname) VALUES ('c1', 'crm-name-1')")
        # ERP 的 cname 是旧数据（priority 高的 crm 不应被它覆盖）；city 是新增
        cur.execute(f"INSERT INTO {SRC2} (cid, cname, ccity) VALUES "
                    f"('c1', 'erp-name-1', '上海'), ('c2', 'erp-name-2', '广州')")
    conn.commit()
    conn.close()
    with r.tenant_scope(T):
        r.upsert_object_type(ObjectType(
            rid=ClassRef(OBJ),
            primary_key=(ClassRef(P_ID),),
            properties=(
                Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                         primary_key=True, title="id", format=PropertyFormat.STRING),
                Property(rid=ClassRef(P_NAME), type_id="string", nullable=True,
                         primary_key=False, title="name", format=PropertyFormat.STRING),
                Property(rid=ClassRef(P_CITY), type_id="string", nullable=True,
                         primary_key=False, title="city", format=PropertyFormat.STRING),
            ),
            display_name="customer",
        ))
        r.upsert_backing_datasource({
            "class_rid": OBJ, "name": "crm", "table": SRC1, "pk_column": "cid",
            "field_mapping": {P_ID: "cid", P_NAME: "cname"},
            "priority": 10, "tenant_id": T,
        })
        r.upsert_backing_datasource({
            "class_rid": OBJ, "name": "erp", "table": SRC2, "pk_column": "cid",
            "field_mapping": {P_ID: "cid", P_NAME: "cname", P_CITY: "ccity"},
            "priority": 20, "tenant_id": T,
        })
    yield r
    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {SRC1}")
        cur.execute(f"DROP TABLE IF EXISTS {SRC2}")
        for tbl in ("ont_individual", "ont_object_type", "ont_axiom",
                    "ont_backing_datasource"):
            cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
    conn.commit()
    conn.close()


class TestDataPlaneBinding:
    def test_sync_and_mdo_field_priority(self, repo) -> None:
        with repo.tenant_scope(T):
            stats = repo.sync_backing_datasources(OBJ)
            assert stats == {"crm": 1, "erp": 2}
            inds = {i.primary_key: i for i in repo.list_individuals(ClassRef(OBJ))}
            assert set(inds) == {"c1", "c2"}
            # MDO 字段级优先级：crm(10) 的 cname 不被 erp(20) 覆盖
            assert inds["c1"].get(ClassRef(P_NAME)) == "crm-name-1"
            # erp 独有字段正常并入
            assert inds["c1"].get(ClassRef(P_CITY)) == "上海"
            assert inds["c2"].get(ClassRef(P_NAME)) == "erp-name-2"

    def test_materialization_rows(self, repo) -> None:
        with repo.tenant_scope(T):
            mat = repo.materialize_object_type(OBJ)
            assert mat["count"] == 2
            pks = {r["cid"] for r in mat["rows"]}
            assert pks == {"c1", "c2"}
            assert P_ID in mat["schema"]

    def test_resync_idempotent(self, repo) -> None:
        with repo.tenant_scope(T):
            repo.sync_backing_datasources(OBJ)
            inds = repo.list_individuals(ClassRef(OBJ))
            assert len(inds) == 2
