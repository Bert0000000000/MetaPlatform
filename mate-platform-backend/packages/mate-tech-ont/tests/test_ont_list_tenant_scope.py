"""F8 回归：`list_individuals` / `list_link_instances` 必须按租户过滤。

背景（2026-09-14 实测确认的跨租户读取泄漏）：

1. `pg_repo.list_individuals` / `list_link_instances` 是 `SELECT *`（**无租户谓词**），
   而同族的 `list_object_types` 有 `WHERE tenant_id = %s`；
2. `tenant_scope` 设的是 `threading.local`，**不跨 `asyncio.to_thread`** ——
   API 路径下 repo 方法跑在工作线程，`_current_tenant()` 恒为 `None`；
3. 本环境 PG RLS 未生效（`alembic_version` 表都不存在，迁移从未执行）。

三者叠加 → `GET /api/v1/ont/v2/individuals` 与 `/link-instances` 会返回
**其他租户**的数据。本文件锁死第 1 条（显式 tenant_id 必须过滤），
第 2/3 条见 docs/active/specs/2026-09-14-ontology-engine-defect-fix-plan.md 的 F7/F8。
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.instances.link_instance import LinkInstance
from mate_kernel.ontology.types.link_type import (
    Cardinality,
    Directionality,
    LinkType,
)
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

TENANT_A = "f8-alpha"
TENANT_B = "f8-beta"
PG_DSN = os.environ.get("F8_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform")

P_NAME = "prop.f8name.v1"


def _ot(rid: str, tenant: str) -> ObjectType:
    p = f"ont.{tenant}.{P_NAME}"
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(ClassRef(p),),
        properties=(
            Property(
                rid=ClassRef(p),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="name",
                format=PropertyFormat.STRING,
            ),
        ),
        display_name=f"F8 {tenant}",
    )


def _lt(rid: str, tenant: str) -> LinkType:
    return LinkType(
        rid=ClassRef(rid),
        src=ClassRef(f"ont.{tenant}.obj.f8.thing.v1"),
        dst=ClassRef(f"ont.{tenant}.obj.f8.thing.v1"),
        cardinality=Cardinality.MANY_TO_MANY,
        directionality=Directionality.DIRECTED,
    )


def _ind(rid: str, tenant: str, class_rid: str, name: str) -> Individual:
    now = datetime.now(UTC)
    return Individual(
        rid=rid,
        class_rid=ClassRef(class_rid),
        props=((ClassRef(f"ont.{tenant}.{P_NAME}"), name),),
        primary_key=name,
        tenant_id=tenant,
        created_at=now,
        updated_at=now,
    )


def _li(rid: str, tenant: str, lt: str, a: str, b: str) -> LinkInstance:
    return LinkInstance(
        rid=rid,
        link_type_rid=ClassRef(lt),
        src=a,
        dst=b,
        props=(),
        tenant_id=tenant,
        created_at=datetime.now(UTC),
    )


@pytest.fixture()
def pg_repo():
    pytest.importorskip("psycopg2")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    try:
        r._ensure_schema()
    except Exception as e:  # pragma: no cover
        pytest.skip(f"PG unavailable: {e}")

    for i, tenant in enumerate((TENANT_A, TENANT_B)):
        obj = f"ont.{tenant}.obj.f8.thing.v1"
        lt = f"ont.{tenant}.link.f8.self.v1"
        a = f"ont.{tenant}.ind.f8.thing.n{i}a"
        b = f"ont.{tenant}.ind.f8.thing.n{i}b"
        with r.tenant_scope(tenant):
            r.upsert_object_type(_ot(obj, tenant))
            r.upsert_link_type(_lt(lt, tenant))
            r.create_individual(_ind(a, tenant, obj, "na"))
            r.create_individual(_ind(b, tenant, obj, "nb"))
            r.create_link_instance(_li(f"ont.{tenant}.lnk.f8.self.{i}", tenant, lt, a, b))
    yield r
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        for tbl in (
            "ont_individual",
            "ont_link_instance",
            "ont_object_type",
            "ont_link_type",
            # upsert_object_type 会自动生成 ax.parent.<slug> 公理 —— 不清理会留库
            # （实测泄漏到共享 metaplatform 库，并显示在建模页公理列表里）
            "ont_axiom",
        ):
            cur.execute(f"DELETE FROM {tbl} WHERE tenant_id IN (%s, %s)", (TENANT_A, TENANT_B))
    conn.commit()
    conn.close()


class TestListTenantScope:
    def test_list_individuals_scoped_by_tenant(self, pg_repo) -> None:
        """显式 tenant_id 必须过滤掉他租户实例（F8 回归）。"""
        with pg_repo.tenant_scope(TENANT_A):
            rows = pg_repo.list_individuals(
                ClassRef(f"ont.{TENANT_A}.obj.f8.thing.v1"), tenant_id=TENANT_A
            )
            assert rows, "本租户实例不应为空"
            leaked = [x for x in rows if x.tenant_id != TENANT_A]
            assert leaked == [], f"跨租户泄漏：{leaked}"

    def test_list_link_instances_scoped_by_tenant(self, pg_repo) -> None:
        """显式 tenant_id 必须过滤掉他租户链接实例（F8 回归）。"""
        with pg_repo.tenant_scope(TENANT_A):
            rows = pg_repo.list_link_instances(tenant_id=TENANT_A)
            assert rows, "本租户链接不应为空"
            leaked = [x for x in rows if x.tenant_id != TENANT_A]
            assert leaked == [], f"跨租户泄漏：{leaked}"
