"""LINK-CARDINALITY-CONCURRENCY —— 关系基数校验与写入的跨进程并发保护。

验收（目标 #3 / #4）：
1. 基数检查与写入必须**同一事务**并具**数据库级**互斥：两个独立连接并发创建冲突关系，
   **最多一个成功**（不得只靠进程内检查的 TOCTOU）。
2. Action / edit-set 等**可达写入口**必须遵守同一套基数约束（不得绕过直插）。

手法：测试用「窗口放大器」把「校验 → 写入」之间的间隔拉长（仅测试内 sleep），
使 TOCTOU 可确定性复现——修复前两线程都会通过校验，修复后被 DB 锁串行化。
"""

from __future__ import annotations

import os
import sys
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.instances.link_instance import LinkInstance
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.link_type import Cardinality, Directionality, LinkType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

PG_DSN = os.getenv("LINKC_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont_test")
T = "linkconc"
OBJ_A = f"ont.{T}.obj.org.node.v1"
OBJ_B = f"ont.{T}.obj.org.peer.v1"
LINK = f"ont.{T}.link.rel.v1"
ACT = f"ont.{T}.act.org.link.v1"
P_ID = f"ont.{T}.prop.nid.v1"
S1 = f"ont.{T}.ind.node.n1"
S2 = f"ont.{T}.ind.node.n2"
D1 = f"ont.{T}.ind.peer.p1"
D2 = f"ont.{T}.ind.peer.p2"


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


def _prop(rid: str, *, pk: bool = False) -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id="string",
        nullable=not pk,
        primary_key=pk,
        title=rid.split(".")[-2],
        format=PropertyFormat.STRING,
    )


def _now() -> datetime:
    return datetime.now(UTC)


def _repo():
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    return r


def _clean() -> None:
    conn = _pg()
    try:
        with conn.cursor() as cur:
            for tbl in (
                "ont_link_instance",
                "ont_link_type",
                "ont_individual",
                "ont_action_type",
                "ont_object_type",
                "ont_axiom",
            ):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def repo():
    r = _repo()
    _clean()
    with r.tenant_scope(T):
        r.upsert_object_type(
            ObjectType(
                rid=ClassRef(OBJ_A),
                primary_key=(ClassRef(P_ID),),
                properties=(_prop(P_ID, pk=True),),
                display_name="node",
            )
        )
        r.upsert_object_type(
            ObjectType(
                rid=ClassRef(OBJ_B),
                primary_key=(ClassRef(P_ID),),
                properties=(_prop(P_ID, pk=True),),
                display_name="peer",
            )
        )
        for iid, cls in ((S1, OBJ_A), (S2, OBJ_A), (D1, OBJ_B), (D2, OBJ_B)):
            r.create_individual(
                Individual(
                    rid=iid,
                    class_rid=ClassRef(cls),
                    props=((ClassRef(P_ID), iid.rsplit(".", 1)[-1]),),
                    primary_key=iid.rsplit(".", 1)[-1],
                    created_at=_now(),
                    updated_at=_now(),
                    tenant_id=T,
                )
            )
        r.upsert_link_type(
            LinkType(
                rid=ClassRef(LINK),
                src=ClassRef(OBJ_A),
                dst=ClassRef(OBJ_B),
                cardinality=Cardinality.ONE_TO_ONE,
                directionality=Directionality.DIRECTED,
                link_properties=(),
            )
        )
        r.upsert_action_type(
            ActionType(
                rid=ClassRef(ACT),
                parameters=(),
                submission_criteria=(),
                side_effects=(),
                function_ref=ClassRef(f"ont.{T}.fn.x.v1"),
                on=(ClassRef(OBJ_A),),
                title="Link",
            )
        )
    yield r
    _clean()


def _li(rid_suffix: str, src: str, dst: str) -> LinkInstance:
    return LinkInstance(
        rid=f"ont.{T}.lnk.rel.{rid_suffix}",
        link_type_rid=ClassRef(LINK),
        src=src,
        dst=dst,
        props=(),
        created_at=_now(),
        tenant_id=T,
    )


def _widen(orig: Callable[..., Any]) -> Callable[..., Any]:
    """测试用窗口放大器：把「校验 → 写入」之间的间隔拉长，令 TOCTOU 可确定性复现。"""

    def wrapper(self: Any, *a: Any, **k: Any) -> Any:
        res = orig(self, *a, **k)
        time.sleep(0.6)
        return res

    return wrapper


def _count_links() -> int:
    conn = _pg()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM ont_link_instance WHERE tenant_id=%s", (T,))
            return int(cur.fetchone()[0])
    finally:
        conn.close()


class TestLinkCardinalityConcurrency:
    def test_concurrent_conflicting_links_only_one_succeeds(self, repo, monkeypatch) -> None:
        """验收：两个独立连接并发创建冲突关系（1:1 同 src）→ 最多一个成功。"""
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        monkeypatch.setattr(
            PgOntologyRepository,
            "_check_link_cardinality",
            _widen(PgOntologyRepository._check_link_cardinality),
        )
        outcomes: list[str] = []
        lock = threading.Lock()
        barrier = threading.Barrier(2)

        def worker(suffix: str, dst: str) -> None:
            r = _repo()
            with r.tenant_scope(T):
                barrier.wait(timeout=10)
                try:
                    r.create_link_instance(_li(suffix, S1, dst))  # 同 src → 冲突
                    out = "ok"
                except Exception as e:
                    out = type(e).__name__
            with lock:
                outcomes.append(out)

        threads = [
            threading.Thread(target=worker, args=("w1", D1)),
            threading.Thread(target=worker, args=("w2", D2)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert sorted(outcomes) != ["ok", "ok"], f"并发双写都成功了：{outcomes}"
        assert outcomes.count("ok") == 1, outcomes
        assert _count_links() == 1, "库里留下了多于一条冲突关系"

    def test_cardinality_enforced_sequentially(self, repo) -> None:
        """串行对照：第二条同 src 关系必须被基数规则拒绝。"""
        with repo.tenant_scope(T):
            repo.create_link_instance(_li("s1", S1, D1))
            with pytest.raises(ValueError, match="cardinality"):
                repo.create_link_instance(_li("s2", S1, D2))
        assert _count_links() == 1

    def test_edit_set_add_link_enforces_cardinality(self, repo) -> None:
        """目标 #4：Action/edit-set 的 add_link 必须走同一套基数约束（不得绕过直插）。"""
        with repo.tenant_scope(T):
            repo.create_link_instance(_li("base", S1, D1))
            with pytest.raises(Exception) as ei:
                repo.apply_edit_set_now(
                    ACT,
                    S2,
                    {},
                    [{"op": "add_link", "link_type_rid": LINK, "src": S2, "dst": D1}],
                    actor="tester",
                )
            assert "cardinality" in str(ei.value).lower(), ei.value
        # 冲突的 add_link 不得落库
        assert _count_links() == 1
