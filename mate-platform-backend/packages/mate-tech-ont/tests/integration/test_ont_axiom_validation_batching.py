"""ONT-QUERY-SEMANTICS §5 —— Axiom 校验的批量加载 + 版本化缓存。

背景：`validate_axioms` 此前**每个实例、每级父类**都回查一次 `get_object_type`
（类链 O(深度)），且每条规则各自 `list_individuals` 全量扫一遍 —— N 实例 × D 深度
= O(N·D) 次查询。本套件钉死：

1. 语句数与**实例数无关**（模型/实例各加载一次 + 类链查表）；
2. 模型未变 → 缓存复用（同一投影对象）；
3. 模型一变（新增类型/改 parent）→ **缓存失效**，结果反映新模型。
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime
from typing import Any

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import mate_tech_ont.v2_kernel.axiom_validation as av
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

PG_DSN = os.getenv("AXB_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont_test")
T = "axbatch"
BASE = f"ont.{T}.obj.org.base.v1"
MID = f"ont.{T}.obj.org.mid.v1"
LEAF = f"ont.{T}.obj.org.leaf.v1"
P_ID = f"ont.{T}.prop.oid.v1"


def _available() -> bool:
    try:
        import psycopg2

        c = psycopg2.connect(PG_DSN, connect_timeout=3)
        c.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _available(), reason=f"PG not reachable at {PG_DSN!r}")


def _ot(rid: str, parent: str = "") -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(ClassRef(P_ID),),
        properties=(
            Property(
                rid=ClassRef(P_ID),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
        ),
        display_name=rid.split(".")[-2],
        parent_class=ClassRef(parent) if parent else None,
    )


def _ind(pk: str, cls: str) -> Individual:
    now = datetime.now(UTC)
    return Individual(
        rid=f"ont.{T}.ind.{cls.split('.')[4]}.{pk}",
        class_rid=ClassRef(cls),
        props=((ClassRef(P_ID), pk),),
        primary_key=pk,
        created_at=now,
        updated_at=now,
        tenant_id=T,
    )


def _clean(r: Any) -> None:
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            for tbl in (
                "ont_individual",
                "ont_object_type",
                "ont_axiom",
            ):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
    finally:
        conn.close()


def _repo() -> Any:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    return r


@pytest.fixture()
def repo():
    r = _repo()
    _clean(r)
    av._CACHE.pop(T, None)  # 用例间隔离缓存
    with r.tenant_scope(T):
        # 三级层级：leaf ⊑ mid ⊑ base（类链深度 3）
        r.upsert_object_type(_ot(BASE))
        r.upsert_object_type(_ot(MID, BASE))
        r.upsert_object_type(_ot(LEAF, MID))
        # disjoint(base, other) —— 用于"违规命中"断言
        r.upsert_object_type(_ot(f"ont.{T}.obj.org.other.v1"))
        r.upsert_axiom_record(
            f"ont.{T}.ax.disj.v1",
            "disjoint",
            [BASE, f"ont.{T}.obj.org.other.v1"],
            tenant_id=T,
            enabled=True,
        )
        r.upsert_axiom_record(f"ont.{T}.ax.key.v1", "has_key", [LEAF], tenant_id=T, enabled=True)
    yield r
    _clean(r)
    av._CACHE.pop(T, None)


class _CountingCursor:
    def __init__(self, inner: Any, counter: dict[str, int]) -> None:
        self._inner = inner
        self._counter = counter

    def execute(self, *a: Any, **k: Any) -> Any:
        self._counter["n"] += 1
        return self._inner.execute(*a, **k)

    def __enter__(self) -> Any:
        self._inner.__enter__()
        return self

    def __exit__(self, *a: Any) -> Any:
        return self._inner.__exit__(*a)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._inner, name)


def _seed_instances(repo: Any, n: int) -> None:
    with repo.tenant_scope(T):
        for i in range(n):
            repo.create_individual(_ind(f"L{i:03d}", LEAF))


def _count_statements(repo: Any, fn: Any) -> tuple[Any, int]:
    counter = {"n": 0}
    real = repo._cursor
    repo._cursor = lambda conn: _CountingCursor(real(conn), counter)  # type: ignore[method-assign]
    try:
        with repo.tenant_scope(T):
            out = fn()
    finally:
        repo._cursor = real  # type: ignore[method-assign]
    return out, counter["n"]


class TestAxiomValidationBatching:
    def test_statement_count_is_independent_of_instance_count(self, repo) -> None:
        _seed_instances(repo, 30)
        _, n30 = _count_statements(repo, lambda: av.validate_axioms(repo, T))
        _seed_instances(repo, 30)  # 再来 30 条 → 共 60
        _, n60 = _count_statements(repo, lambda: av.validate_axioms(repo, T))
        assert n30 == n60, f"语句数随实例数增长：{n30} → {n60}（疑似逐实例回查）"
        assert n30 <= 6, f"语句数过多（{n30}）：批量加载护栏"
        print(f"\n[AXB] validate_axioms SQL: 30 实例={n30} 条 / 60 实例={n60} 条（常量级）")

    def test_cache_reused_when_model_unchanged(self, repo) -> None:
        _seed_instances(repo, 3)
        with repo.tenant_scope(T):
            av.validate_axioms(repo, T)
            first = av._CACHE[T]
            av.validate_axioms(repo, T)
            second = av._CACHE[T]
        assert first is second, "模型未变却重建了投影（缓存未生效）"

    def test_cache_invalidated_when_model_changes(self, repo) -> None:
        _seed_instances(repo, 3)
        with repo.tenant_scope(T):
            av.validate_axioms(repo, T)
            v1 = av._CACHE[T].version
            # 模型变更：other 也挂到 base 之下 → 同一 disjoint 公理现在命中
            repo.upsert_object_type(_ot(f"ont.{T}.obj.org.other.v1", BASE))
            av.validate_axioms(repo, T)
            v2 = av._CACHE[T].version
        assert v1 != v2, "模型已变但版本指纹未变 → 缓存不会失效"

    def test_chain_map_drives_violation_after_refactor(self, repo) -> None:
        """回归：违规判定由**一次建成的类链映射**驱动。

        leaf ⊑ mid ⊑ base；声明 disjoint(mid, base) 后，leaf 实例的类链同时含
        两侧 → 必须命中 violation（证明查表链与旧 `_class_chain` 语义一致）。
        """
        _seed_instances(repo, 1)
        with repo.tenant_scope(T):
            assert av.validate_axioms(repo, T)["conforms"] is True  # mid/base 未声明互斥
            repo.upsert_axiom_record(
                f"ont.{T}.ax.disj-mid-base.v1",
                "disjoint",
                [MID, BASE],
                tenant_id=T,
                enabled=True,
            )
            report = av.validate_axioms(repo, T)
        assert report["conforms"] is False
        assert any(v["kind"] == "disjoint" for v in report["violations"]), report
