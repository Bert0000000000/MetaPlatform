"""MODEL-WRITE-ATOMICITY —— 模型修改的原子性与发布期校验。

验收（目标 #1 / #2）：
1. **原子性**：ObjectType 行与由 `parent_class` 派生的 subclass 公理在**同一事务**；
   公理写失败 → 整体回滚（不得「先提交类型再吞掉公理异常」）；更新场景下旧版本保持。
2. **草稿宽松 / 发布严格**：schema WIP 可暂存未解析或不满足接口的引用；
   **发布**（`upsert_object_type` —— `apply-schema-wip` 复用它）必须完成接口一致性校验。
3. **读取失败不得视为通过**：校验所需的读取异常必须 fail-closed（拒绝落库）。

真库门控：专用测试库 + 专用租户。
"""

from __future__ import annotations

import os
import sys
from typing import Any

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.types.interface import Interface
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

PG_DSN = os.getenv("MODEL_AT_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont_test")
T = "modatomic"
BASE = f"ont.{T}.obj.base.v1"
CHILD = f"ont.{T}.obj.child.v1"
IFACE = f"ont.{T}.if.common.v1"
P_ID = f"ont.{T}.prop.cid.v1"
P_NAME = f"ont.{T}.prop.cname.v1"
P_COMMON = f"ont.{T}.prop.common.v1"


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


def _ot(
    rid: str,
    *,
    parent: str = "",
    interfaces: tuple[str, ...] = (),
    props: tuple[str, ...] = (P_ID, P_NAME),
    display_name: str = "t",
) -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(ClassRef(P_ID),),
        properties=tuple(_prop(p, pk=(p == P_ID)) for p in props),
        display_name=display_name,
        interfaces=tuple(ClassRef(i) for i in interfaces),
        parent_class=ClassRef(parent) if parent else None,
    )


@pytest.fixture()
def repo():
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    _clean()
    yield r
    _clean()


def _clean() -> None:
    conn = _pg()
    try:
        with conn.cursor() as cur:
            for tbl in ("ont_axiom", "ont_object_type", "ont_interface", "ont_schema_wip"):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
    finally:
        conn.close()


class TestModelWriteAtomicity:
    def test_axiom_failure_rolls_back_new_type(self, repo, monkeypatch) -> None:
        """注入公理写入故障 → 类型**整体不落库**（不得先提交类型）。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(BASE))

            def _boom(*_a: Any, **_k: Any) -> None:
                raise RuntimeError("simulated axiom write failure")

            monkeypatch.setattr(repo, "_sync_parent_axiom", _boom, raising=False)
            with pytest.raises(RuntimeError):
                repo.upsert_object_type(_ot(CHILD, parent=BASE))

        # 类型不得残留（原子性）
        with repo.tenant_scope(T):
            with pytest.raises(KeyError):
                repo.get_object_type(ClassRef(CHILD))
            # 也没有派生的 subclass 公理残留
            ax_rids = {r["rid"] for r in repo.list_axiom_records(T)}
            assert not any(CHILD in r for r in ax_rids), ax_rids

    def test_axiom_failure_preserves_previous_type(self, repo, monkeypatch) -> None:
        """更新场景：公理写失败 → 旧版本保持（不得落成"新类型 + 旧公理"的半成品）。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(CHILD, display_name="v1"))
            before = repo.get_object_type(ClassRef(CHILD))
            assert before.parent_class is None and before.display_name == "v1"

            def _boom(*_a: Any, **_k: Any) -> None:
                raise RuntimeError("simulated axiom write failure")

            monkeypatch.setattr(repo, "_sync_parent_axiom", _boom, raising=False)
            with pytest.raises(RuntimeError):
                repo.upsert_object_type(_ot(CHILD, parent=BASE, display_name="v2"))

            after = repo.get_object_type(ClassRef(CHILD))
        assert after.display_name == "v1", "失败后类型被改成了半成品"
        assert after.parent_class is None, "失败后 parent_class 被提交"

    def test_interface_read_failure_is_not_treated_as_pass(self, repo, monkeypatch) -> None:
        """接口一致性校验的**读取失败**必须 fail-closed，不得视为通过。"""
        with repo.tenant_scope(T):

            def _boom(*_a: Any, **_k: Any) -> None:
                raise RuntimeError("interface store unavailable")

            monkeypatch.setattr(repo, "list_interfaces", _boom)
            with pytest.raises(Exception) as ei:
                repo.upsert_object_type(_ot(CHILD))
            assert not isinstance(ei.value, KeyError)
        with repo.tenant_scope(T):
            with pytest.raises(KeyError):
                repo.get_object_type(ClassRef(CHILD))
            monkeypatch.undo()

    def test_draft_allows_violating_ref_but_publish_rejects(self, repo) -> None:
        """草稿可暂存不合规引用；发布（upsert_object_type）必须拒绝。"""
        with repo.tenant_scope(T):
            repo.upsert_interface(
                Interface(
                    rid=ClassRef(IFACE),
                    properties=(_prop(P_COMMON),),
                    required_links=(),
                )
            )
            # 声明 implements IFACE 但**缺** P_COMMON → 违规
            violating = _ot(CHILD, interfaces=(IFACE,), props=(P_ID, P_NAME))
            # 草稿：允许暂存
            saved = repo.save_schema_wip(CHILD, {"rid": CHILD, "display_name": "draft"}, "alice")
            assert saved["status"] == "staged"
            assert repo.get_schema_wip(CHILD)["rid"] == CHILD
            # 发布：必须拒绝
            with pytest.raises(ValueError, match="requires property"):
                repo.upsert_object_type(violating)
            # 补齐属性后发布成功（正对照）
            conforming = _ot(CHILD, interfaces=(IFACE,), props=(P_ID, P_NAME, P_COMMON))
            repo.upsert_object_type(conforming)
            assert repo.get_object_type(ClassRef(CHILD)).rid.rid == CHILD

    def test_parent_axiom_and_type_land_together(self, repo) -> None:
        """成功路径：类型与 subclass 公理同时落库，层级读回一致。"""
        with repo.tenant_scope(T):
            repo.upsert_object_type(_ot(BASE))
            repo.upsert_object_type(_ot(CHILD, parent=BASE))
            child = repo.get_object_type(ClassRef(CHILD))
            assert child.parent_class is not None and child.parent_class.rid == BASE
            ax = [r for r in repo.list_axiom_records(T) if r["kind"] == "subclass"]
            assert any(r["operands"] == [CHILD, BASE] and r["enabled"] for r in ax), ax
            hierarchy = repo.get_type_hierarchy()
        assert any(CHILD in str(row) for row in hierarchy)
