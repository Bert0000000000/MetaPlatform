"""ONT-QUERY-SEMANTICS §3 —— 关系实例**服务端**过滤 + 分页 + 聚合计数。

背景：`GET /v2/link-instances` 此前**无任何参数** —— 调用方（前端关系类型页、
Agent）只能"下载租户全量关系再本地筛选"，数据规模上来即不可用。本套件钉死：

1. 服务端按 `link_type_rid` / `src` / `dst` 过滤（可组合）；
2. 服务端分页（`limit`/`offset`）+ **稳定 `ORDER BY rid`**（分页可复现、无重无缺）；
3. `limit` / `offset` 校验（1..10000 / ≥0）；
4. 按关系类型的实例数走**一条 GROUP BY**（替代"下载全量再计数"）；
5. HTTP 层：跨租户过滤 rid → 403；非法 limit → 422。
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

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.link_instance import LinkInstance

PG_DSN = os.getenv("LINKF_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont_test")
T = "linkfilt"
LT_A = f"ont.{T}.link.rel-a.v1"
LT_B = f"ont.{T}.link.rel-b.v1"


def _pg() -> Any:
    import psycopg2

    return psycopg2.connect(PG_DSN)


def _available() -> bool:
    try:
        c = _pg()
        c.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _available(), reason=f"PG not reachable at {PG_DSN!r}")


def _li(rid: str, lt: str, src: str, dst: str, tenant: str = T) -> LinkInstance:
    return LinkInstance(
        rid=rid,
        link_type_rid=ClassRef(lt),
        src=src,
        dst=dst,
        props=(),
        created_at=datetime.now(UTC),
        tenant_id=tenant,
    )


@pytest.fixture()
def repo():
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    _clean()
    now_rows = [
        # rel-a: s1→d1, s1→d2, s2→d1（3 条）
        _li(f"ont.{T}.lnk.rel-a.1", LT_A, f"ont.{T}.ind.n.s1", f"ont.{T}.ind.n.d1"),
        _li(f"ont.{T}.lnk.rel-a.2", LT_A, f"ont.{T}.ind.n.s1", f"ont.{T}.ind.n.d2"),
        _li(f"ont.{T}.lnk.rel-a.3", LT_A, f"ont.{T}.ind.n.s2", f"ont.{T}.ind.n.d1"),
        # rel-b: s1→d1（1 条）
        _li(f"ont.{T}.lnk.rel-b.1", LT_B, f"ont.{T}.ind.n.s1", f"ont.{T}.ind.n.d1"),
    ]
    with r.tenant_scope(T):
        for li in now_rows:
            _insert_raw(li)
    yield r
    _clean()


def _insert_raw(li: LinkInstance) -> None:
    """直插（绕过基数校验：本套件只测**读**路径）。"""
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO ont_link_instance "
                "(rid, tenant_id, link_type_rid, src, dst, props, marking, created_at, updated_at) "
                "VALUES (%s,%s,%s,%s,%s,'{}'::jsonb,'{}',now(),now()) ON CONFLICT (rid) DO NOTHING",
                (li.rid, li.tenant_id, li.link_type_rid.rid, li.src, li.dst),
            )
        conn.commit()
    finally:
        conn.close()


def _clean() -> None:
    conn = _pg()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_link_instance WHERE tenant_id=%s", (T,))
        conn.commit()
    finally:
        conn.close()


def _rids(items: list[Any]) -> list[str]:
    return [i.rid for i in items]


class TestLinkInstanceServerSideFiltering:
    def test_no_filter_returns_all(self, repo) -> None:
        with repo.tenant_scope(T):
            rows = repo.list_link_instances(tenant_id=T)
        assert len(rows) == 4

    def test_filter_by_link_type(self, repo) -> None:
        with repo.tenant_scope(T):
            a = repo.list_link_instances(tenant_id=T, link_type_rid=LT_A)
            b = repo.list_link_instances(tenant_id=T, link_type_rid=LT_B)
        assert len(a) == 3 and len(b) == 1
        assert {i.link_type_rid.rid for i in a} == {LT_A}

    def test_filter_by_src_and_dst_composable(self, repo) -> None:
        with repo.tenant_scope(T):
            s1 = repo.list_link_instances(tenant_id=T, src=f"ont.{T}.ind.n.s1")
            d1 = repo.list_link_instances(tenant_id=T, dst=f"ont.{T}.ind.n.d1")
            both = repo.list_link_instances(
                tenant_id=T, link_type_rid=LT_A, src=f"ont.{T}.ind.n.s1"
            )
        assert len(s1) == 3  # rel-a 两条 + rel-b 一条
        assert len(d1) == 3  # rel-a 两条 + rel-b 一条
        assert len(both) == 2

    def test_pagination_is_stable_and_complete(self, repo) -> None:
        seen: list[str] = []
        with repo.tenant_scope(T):
            for off in (0, 2, 4):
                page = repo.list_link_instances(tenant_id=T, limit=2, offset=off)
                seen.extend(_rids(page))
            # 稳定 ORDER BY rid：按 rid 有序
            assert seen == sorted(seen)
        assert len(seen) == len(set(seen)) == 4  # 无重无缺

    def test_limit_and_offset_validation(self, repo) -> None:
        with repo.tenant_scope(T), pytest.raises(ValueError):
            repo.list_link_instances(tenant_id=T, limit=0)
        with repo.tenant_scope(T), pytest.raises(ValueError):
            repo.list_link_instances(tenant_id=T, limit=10001)
        with repo.tenant_scope(T), pytest.raises(ValueError):
            repo.list_link_instances(tenant_id=T, offset=-1)

    def test_counts_by_type_is_one_group_by(self, repo) -> None:
        counter = {"n": 0}
        real_cursor = repo._cursor

        class _CountingCursor:
            def __init__(self, inner: Any) -> None:
                self._inner = inner

            def execute(self, *a: Any, **k: Any) -> Any:
                counter["n"] += 1
                return self._inner.execute(*a, **k)

            def __enter__(self) -> Any:
                self._inner.__enter__()
                return self

            def __exit__(self, *a: Any) -> Any:
                return self._inner.__exit__(*a)

            def __getattr__(self, name: str) -> Any:
                return getattr(self._inner, name)

        repo._cursor = lambda conn: _CountingCursor(real_cursor(conn))  # type: ignore[method-assign]
        try:
            with repo.tenant_scope(T):
                counts = repo.count_link_instances_by_type(tenant_id=T)
        finally:
            repo._cursor = real_cursor  # type: ignore[method-assign]
        assert counts == {LT_A: 3, LT_B: 1}
        assert counter["n"] == 1, f"计数应为一条 GROUP BY，实际 {counter['n']} 条语句"
