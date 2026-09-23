"""EXP-01 补全 — Interface 多态浏览源（list_individuals 接受 Interface rid）。

语义：Interface 源 → 实现类型 + 各自后代（与 ObjectSet/IR 查询路径同语义）；
具体 ObjectType 源保持精确匹配（既有行为不变）。PG repo + HTTP 级验证。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

import pytest

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.types import (
    Interface,
    ObjectType,
    Property,
    PropertyFormat,
)

PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql://meta:meta@localhost:5432/metaplatform_ont_test",
)


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore

        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(),
    reason=f"PG not reachable at {PG_DSN!r}",
)


@pytest.fixture
def pg_repo() -> Any:
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r.set_embedder(HashEmbedder())
    r._ensure_schema()
    return r


@pytest.fixture(autouse=True)
def _clean_pg(pg_repo) -> None:
    import psycopg2  # type: ignore

    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_link_instance")
            cur.execute("DELETE FROM ont_link_type")
            cur.execute("DELETE FROM ont_interface")
            cur.execute("DELETE FROM ont_property")
            cur.execute("DELETE FROM ont_axiom")
            cur.execute("DELETE FROM ont_function")
            cur.execute("DELETE FROM ont_individual")
            cur.execute("DELETE FROM ont_object_type")
            cur.execute("DELETE FROM ont_action_type")
            cur.execute("DELETE FROM ont_proposal")
        conn.commit()
    finally:
        conn.close()


def _prop(rid: str) -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id="string",
        nullable=False,
        primary_key=False,
        title=rid.split(".")[-2],
        format=PropertyFormat.STRING,
    )


def _ot(rid: str, *, interfaces: tuple[str, ...] = (), parent: str | None = None) -> ObjectType:
    tenant = rid.split(".")[1]
    slug = rid.split(".")[-2]
    pk = Property(
        rid=ClassRef(f"ont.{tenant}.prop.{slug}-id.v1"),
        type_id="string",
        nullable=False,
        primary_key=True,
        title="id",
        format=PropertyFormat.STRING,
    )
    props: list[Property] = [pk]
    if interfaces:
        # Interface 契约属性（同名同 rid 签名匹配）+ 本类型属性
        props.append(_prop(f"ont.{tenant}.prop.facility-code.v1"))
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(pk.rid,),
        properties=tuple(props),
        interfaces=tuple(ClassRef(i) for i in interfaces),
        display_name=slug,
        parent_class=ClassRef(parent) if parent else None,
    )


def _ind(rid: str, class_rid: str, pk: str) -> Individual:
    tenant = rid.split(".")[1]
    slug = class_rid.split(".")[-2]
    return Individual(
        rid=rid,
        class_rid=ClassRef(class_rid),
        props=((ClassRef(f"ont.{tenant}.prop.{slug}-id.v1"), pk),),
        primary_key=pk,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        tenant_id=tenant,
    )


IFC = "ont.acme.if.facility.v1"
PLANT = "ont.acme.obj.ops.plant.v1"
WAREHOUSE = "ont.acme.obj.ops.warehouse.v1"
VEHICLE = "ont.acme.obj.ops.vehicle.v1"  # 不实现 Interface
COLD_PLANT = "ont.acme.obj.ops.cold-plant.v1"  # PLANT 子类（后代）


@pytest.fixture(scope="module", autouse=True)
def _init_kernel_repo():
    from mate_tech_ont.main import app
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r.set_embedder(HashEmbedder())
    app.state.kernel_repo = r
    yield
    app.state.kernel_repo = None


@pytest.fixture
def client_with_ctx_module(monkeypatch):
    from fastapi.testclient import TestClient

    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId

    async def fake_dispatch(self, request, call_next):
        request.state.ctx = RequestContext(
            request_id="test-req",
            trace_id="test-trace",
            tenant_id=TenantId("acme"),
            user_id=UserId("alice"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    monkeypatch.setattr(auth_mw.AuthMiddleware, "dispatch", fake_dispatch)

    from mate_tech_ont.main import app as _app

    saved_stack = _app.middleware_stack
    _app.middleware_stack = None
    try:
        yield TestClient(_app)
    finally:
        _app.middleware_stack = saved_stack


def _seed(pg_repo) -> None:
    pg_repo.upsert_interface(
        Interface(
            rid=ClassRef(IFC),
            properties=(_prop("ont.acme.prop.facility-code.v1"),),
        )
    )
    pg_repo.upsert_object_type(_ot(PLANT, interfaces=(IFC,)))
    pg_repo.upsert_object_type(_ot(WAREHOUSE, interfaces=(IFC,)))
    pg_repo.upsert_object_type(_ot(VEHICLE))
    pg_repo.upsert_object_type(_ot(COLD_PLANT, interfaces=(IFC,), parent=PLANT))
    pg_repo.create_individual(_ind("ont.acme.ind.plant.P1", PLANT, "P1"))
    pg_repo.create_individual(_ind("ont.acme.ind.warehouse.W1", WAREHOUSE, "W1"))
    pg_repo.create_individual(_ind("ont.acme.ind.vehicle.V1", VEHICLE, "V1"))
    pg_repo.create_individual(_ind("ont.acme.ind.cold-plant.C1", COLD_PLANT, "C1"))


class TestInterfacePolymorphicListing:
    def test_repo_level_interface_expansion(self, pg_repo):
        _seed(pg_repo)
        rows = pg_repo.list_individuals(ClassRef(IFC))
        pks = sorted(i.primary_key for i in rows)
        # 实现类型（P1/W1）+ 后代（C1）；非实现（V1）排除
        assert pks == ["C1", "P1", "W1"]

    def test_object_type_listing_follows_subclass_closure(self, pg_repo):
        """ONT-QUERY-SEMANTICS：具体 ObjectType 与查询路径**同规则** —— 含后代闭包。

        本批把「浏览对具体类型只做精确匹配」改为与 ObjectSet / Agent 一致的闭包语义
        （父子类规则一处定义，见 ADR-0077）：PLANT 现在包含子类 C1 的实例；
        **叶子类型仍精确**（无后代可展开）。
        """
        _seed(pg_repo)
        rows = pg_repo.list_individuals(ClassRef(PLANT))
        assert sorted(i.primary_key for i in rows) == ["C1", "P1"]
        leaf = pg_repo.list_individuals(ClassRef(COLD_PLANT))
        assert [i.primary_key for i in leaf] == ["C1"]

    def test_interface_without_implementors_returns_empty(self, pg_repo):
        _seed(pg_repo)
        rows = pg_repo.list_individuals(ClassRef("ont.acme.if.ghost.v1"))
        assert rows == []

    def test_http_level_interface_listing(self, client_with_ctx_module, pg_repo):
        _seed(pg_repo)
        r = client_with_ctx_module.get(f"/api/v1/ont/v2/individuals?class_rid={IFC}")
        assert r.status_code == 200, r.text
        pks = sorted(x["primary_key"] for x in r.json())
        assert pks == ["C1", "P1", "W1"]
        # 混合类型：每行带自身 class_rid
        classes = {x["class_rid"] for x in r.json()}
        assert classes == {PLANT, WAREHOUSE, COLD_PLANT}

    def test_objectset_evaluate_via_interface_http(self, client_with_ctx_module, pg_repo):
        """查询路径（既有 EXP-01）端到端回归：Interface 源 evaluate 返回实现类型实例。"""
        _seed(pg_repo)
        r = client_with_ctx_module.post(
            "/api/v1/ont/v2/object-sets:evaluate",
            json={"class_rid": IFC, "filter_expr": "", "paging_limit": 50},
        )
        assert r.status_code == 200, r.text
        pks = sorted(x["primary_key"] for x in r.json())
        assert pks == ["C1", "P1", "W1"]
